import os
from datetime import datetime, timedelta, timezone

import click
from flask.cli import with_appcontext
from sqlalchemy import inspect, text
from werkzeug.security import generate_password_hash

from ..models import (
    User,
    Course,
    Assignment,
    AssignmentIncludedGroup,
    Rubric,
    CriteriaDescription,
    Criterion,
    Submission,
    Review,
    GroupEvaluationSubmission,
    GroupEvaluationTarget,
    GroupEvaluationCriterion,
    User_Course,
    Group,
    GroupMember
)
from ..models.db import db
from werkzeug.security import generate_password_hash

from ..controllers.assignment_controller import _ensure_default_rubric_for_assignment


@click.command("init_db")
@with_appcontext
def init_db_command():
    """Initialize the database"""
    db.create_all()
    click.echo("Database is created")


@click.command("drop_db")
@with_appcontext
def drop_db_command():
    """Drop all database tables"""
    if click.confirm("Are you sure you want to drop all tables?"):
        db.drop_all()
        click.echo("Database tables dropped")


@click.command("drop_has_score_column")
@click.option("--yes", is_flag=True, help="Skip confirmation prompt")
@with_appcontext
def drop_has_score_column_command(yes: bool):
    """Drop legacy Criteria_Description.hasScore column if it exists.

    This repo removed the `hasScore` field entirely, but old SQLite/Postgres
    databases may still have the column. This command removes it without
    changing any other data.
    """

    table_name = CriteriaDescription.__tablename__
    engine = db.engine

    inspector = inspect(engine)
    if table_name not in inspector.get_table_names():
        click.echo(f"Table '{table_name}' not found; nothing to do.")
        return

    columns = {col["name"] for col in inspector.get_columns(table_name)}
    if "hasScore" in columns:
        column_name = "hasScore"
    elif "has_score" in columns:
        column_name = "has_score"
    else:
        click.echo(f"Column '{table_name}.hasScore' not present; nothing to do.")
        return

    if not yes:
        db_uri = engine.url.render_as_string(hide_password=True)
        if not click.confirm(
            f"This will DROP column '{column_name}' from '{table_name}' on: {db_uri}. Continue?"
        ):
            click.echo("Aborted")
            return

    dialect = engine.dialect.name

    with engine.begin() as conn:
        if dialect == "sqlite":
            # Prefer modern SQLite's DROP COLUMN, but fallback to a table rebuild.
            try:
                conn.execute(
                    text(f'ALTER TABLE "{table_name}" DROP COLUMN "{column_name}"')
                )
                click.echo(
                    f"Dropped '{column_name}' from '{table_name}' using ALTER TABLE."
                )
                return
            except Exception:
                tmp_table = f"{table_name}__new"

                conn.execute(text("PRAGMA foreign_keys=OFF;"))
                conn.execute(text(f'DROP TABLE IF EXISTS "{tmp_table}";'))

                # Recreate the table without the legacy column.
                conn.execute(
                    text(
                        f'''
                        CREATE TABLE "{tmp_table}" (
                            id INTEGER PRIMARY KEY,
                            "rubricID" INTEGER NOT NULL,
                            question VARCHAR(255),
                            "scoreMax" INTEGER,
                            FOREIGN KEY("rubricID") REFERENCES "Rubric"(id)
                        )
                        '''
                    )
                )
                conn.execute(
                    text(
                        f'''
                        INSERT INTO "{tmp_table}" (id, "rubricID", question, "scoreMax")
                        SELECT id, "rubricID", question, "scoreMax"
                        FROM "{table_name}";
                        '''
                    )
                )
                conn.execute(text(f'DROP TABLE "{table_name}";'))
                conn.execute(
                    text(f'ALTER TABLE "{tmp_table}" RENAME TO "{table_name}";')
                )
                conn.execute(
                    text(
                        f'CREATE INDEX IF NOT EXISTS "ix_{table_name}_rubricID" ON "{table_name}"("rubricID");'
                    )
                )
                conn.execute(text("PRAGMA foreign_keys=ON;"))

                click.echo(
                    f"Rebuilt '{table_name}' without '{column_name}' (SQLite fallback path)."
                )
                return

        if dialect in {"postgresql", "postgres"}:
            conn.execute(
                text(f'ALTER TABLE "{table_name}" DROP COLUMN IF EXISTS "{column_name}"')
            )
        elif dialect in {"mysql", "mariadb"}:
            # MySQL doesn't support DROP COLUMN IF EXISTS.
            conn.execute(text(f"ALTER TABLE `{table_name}` DROP COLUMN `{column_name}`"))
        else:
            # Generic ANSI-ish attempt.
            conn.execute(text(f'ALTER TABLE "{table_name}" DROP COLUMN "{column_name}"'))

    click.echo(f"Dropped '{column_name}' from '{table_name}'.")


@click.command("add_users")
@with_appcontext
def add_users_command():
    """Add sample users and complete peer review setup to the database

    This creates:
    ORIGINAL USERS (password: 123456):
    - student@example.com (Example Student)
    - teacher@example.com (Example Teacher)
    - admin@example.com (Example Admin)

    PEER REVIEW USERS (password: 123456):
    - teacher@test.com (Professor Smith)
    - student1-4@test.com (Student 1-4)
    - 1 course (Introduction to Peer Review) with all students enrolled
    - 1 assignment with rubric (5 criteria)
    - 3 submissions (from students 2, 3, 4)
    - 3 review assignments (Student 1 reviews 2 students, Student 2 reviews 1 student)
    """
    click.echo("Creating sample users and peer review setup...")
    click.echo("=" * 60)

    # Create original example users (password: 123456)
    click.echo("\nCreating original example users...")
    original_users = [
        {
            "name": "Example Student",
            "email": "student@example.com",
            "password": "123456",
            "role": "student",
        },
        {
            "name": "Example Teacher",
            "email": "teacher@example.com",
            "password": "123456",
            "role": "teacher",
        },
        {
            "name": "Example Admin",
            "email": "admin@example.com",
            "password": "123456",
            "role": "admin",
        },
    ]

    for u in original_users:
        if not User.get_by_email(u["email"]):
            hashed = generate_password_hash(u["password"], method="pbkdf2:sha256")
            user = User(name=u["name"], email=u["email"], hash_pass=hashed, role=u["role"])
            User.create_user(user)
            click.echo(f"✓ Created {u['role']}: {user.email}")
        else:
            click.echo(f"✓ {u['role'].capitalize()} already exists: {u['email']}")

    # Create peer review teacher (password: 123456)
    click.echo("\nCreating peer review users...")
    teacher_email = "teacher@test.com"
    teacher = User.get_by_email(teacher_email)
    if not teacher:
        hashed = generate_password_hash("123456", method="pbkdf2:sha256")
        teacher = User(
            name="Professor Smith",
            email=teacher_email,
            hash_pass=hashed,
            role="teacher"
        )
        User.create_user(teacher)
        click.echo(f"✓ Created teacher: {teacher.email}")
    else:
        click.echo(f"✓ Teacher already exists: {teacher.email}")

    # Create peer review students (password: 123456)
    students = []
    for i in range(1, 5):
        email = f"student{i}@test.com"
        student = User.get_by_email(email)
        if not student:
            hashed = generate_password_hash("123456", method="pbkdf2:sha256")
            student = User(
                name=f"Student {i}",
                email=email,
                hash_pass=hashed,
                role="student"
            )
            User.create_user(student)
            click.echo(f"✓ Created student: {student.email}")
        else:
            click.echo(f"✓ Student already exists: {student.email}")
        students.append(student)

    # Create course
    course_name = "Introduction to Peer Review"
    course = Course.query.filter_by(teacherID=teacher.id, name=course_name).first()
    if not course:
        course = Course(
            teacherID=teacher.id,
            name=course_name
        )
        Course.create_course(course)
        click.echo(f"✓ Created course: {course.name} (ID: {course.id})")
    else:
        click.echo(f"✓ Course already exists: {course.name} (ID: {course.id})")

    # Enroll all students in the course
    enrolled_count = 0
    for student in students:
        existing_enrollment = User_Course.query.filter_by(
            userID=student.id,
            courseID=course.id
        ).first()
        if not existing_enrollment:
            enrollment = User_Course(userID=student.id, courseID=course.id)
            db.session.add(enrollment)
            enrolled_count += 1

    if enrolled_count > 0:
        db.session.commit()
        click.echo(f"✓ Enrolled {enrolled_count} students in the course")
    else:
        click.echo(f"✓ All students already enrolled")

    # Create assignment with due date ~1 month in the future
    assignment_name = "Essay Peer Review Assignment"
    assignment = Assignment.query.filter_by(
        courseID=course.id,
        name=assignment_name
    ).first()

    if not assignment:
        # Use naive datetimes consistently (the app stores naive timestamps)
        due_date = datetime.utcnow() + timedelta(days=37)
        assignment = Assignment(
            courseID=course.id,
            name=assignment_name,
            rubric_text="Please review your peer's essay",
            due_date=due_date
        )
        Assignment.create(assignment)
        click.echo(f"✓ Created assignment: {assignment.name} (ID: {assignment.id})")
        click.echo(f"  Due date: {assignment.due_date.strftime('%Y-%m-%d %H:%M:%S')}")
    else:
        click.echo(f"✓ Assignment already exists: {assignment.name} (ID: {assignment.id})")

    # Create rubric with criteria
    rubric = Rubric.query.filter_by(assignmentID=assignment.id).first()
    if not rubric:
        rubric = Rubric(assignmentID=assignment.id, canComment=True)
        db.session.add(rubric)
        db.session.commit()
        click.echo(f"✓ Created rubric (ID: {rubric.id})")

        # Add criteria
        criteria_list = [
            {
                "question": "Content Quality - Does the work demonstrate understanding of the topic?",
                "scoreMax": 10,
            },
            {
                "question": "Organization - Is the work well-structured and logical?",
                "scoreMax": 10,
            },
            {
                "question": "Clarity - Is the writing clear and easy to understand?",
                "scoreMax": 10,
            },
            {
                "question": "Completeness - Does the work address all requirements?",
                "scoreMax": 10,
            },
            {
                "question": "Overall Impression - What is your overall assessment?",
                "scoreMax": 10,
            }
        ]

        for crit_data in criteria_list:
            criterion = CriteriaDescription(
                rubricID=rubric.id,
                question=crit_data["question"],
                scoreMax=crit_data["scoreMax"],
            )
            db.session.add(criterion)

        db.session.commit()
        click.echo(f"✓ Added {len(criteria_list)} criteria to rubric")
    else:
        criteria_count = CriteriaDescription.query.filter_by(rubricID=rubric.id).count()
        click.echo(f"✓ Rubric already exists with {criteria_count} criteria")

    # Create submissions for students 2, 3, and 4
    submissions_created = 0
    for i, student in enumerate(students[1:], start=2):
        existing_submission = Submission.query.filter_by(
            studentID=student.id,
            assignmentID=assignment.id
        ).first()

        if not existing_submission:
            submission = Submission(
                path=f"/submissions/student{i}_essay.pdf",
                studentID=student.id,
                assignmentID=assignment.id,
                submitted_at=datetime.utcnow() - timedelta(days=10 - i),
            )
            Submission.create_submission(submission)
            submissions_created += 1

    if submissions_created > 0:
        click.echo(f"✓ Created {submissions_created} submissions")
    else:
        click.echo(f"✓ All submissions already exist")

    # Assign reviews: Student 1 reviews Students 2 and 3
    reviews_created = 0

    # Review 1: Student 1 → Student 2
    review1 = Review.query.filter_by(
        assignmentID=assignment.id,
        reviewerID=students[0].id,
        revieweeID=students[1].id
    ).first()

    if not review1:
        review1 = Review(
            assignmentID=assignment.id,
            reviewerID=students[0].id,
            revieweeID=students[1].id
        )
        Review.create_review(review1)
        reviews_created += 1
        click.echo(f"✓ Assigned review: {students[0].name} → {students[1].name}")

    # Review 2: Student 1 → Student 3
    review2 = Review.query.filter_by(
        assignmentID=assignment.id,
        reviewerID=students[0].id,
        revieweeID=students[2].id
    ).first()

    if not review2:
        review2 = Review(
            assignmentID=assignment.id,
            reviewerID=students[0].id,
            revieweeID=students[2].id
        )
        Review.create_review(review2)
        reviews_created += 1
        click.echo(f"✓ Assigned review: {students[0].name} → {students[2].name}")

    # Review 3: Student 2 → Student 3
    review3 = Review.query.filter_by(
        assignmentID=assignment.id,
        reviewerID=students[1].id,
        revieweeID=students[2].id
    ).first()

    if not review3:
        review3 = Review(
            assignmentID=assignment.id,
            reviewerID=students[1].id,
            revieweeID=students[2].id
        )
        Review.create_review(review3)
        reviews_created += 1
        click.echo(f"✓ Assigned review: {students[1].name} → {students[2].name}")

    if reviews_created == 0:
        click.echo(f"✓ All review assignments already exist")

    # Add more reviews to create a comprehensive test scenario
    # Review 4: Student 3 → Student 4
    review4 = Review.query.filter_by(
        assignmentID=assignment.id,
        reviewerID=students[2].id,
        revieweeID=students[3].id
    ).first()

    if not review4:
        review4 = Review(
            assignmentID=assignment.id,
            reviewerID=students[2].id,
            revieweeID=students[3].id
        )
        Review.create_review(review4)
        click.echo(f"✓ Assigned review: {students[2].name} → {students[3].name}")

    # Review 5: Student 2 → Student 4
    review5 = Review.query.filter_by(
        assignmentID=assignment.id,
        reviewerID=students[1].id,
        revieweeID=students[3].id
    ).first()

    if not review5:
        review5 = Review(
            assignmentID=assignment.id,
            reviewerID=students[1].id,
            revieweeID=students[3].id
        )
        Review.create_review(review5)
        click.echo(f"✓ Assigned review: {students[1].name} → {students[3].name}")

    # Review 6: Student 4 → Student 1
    review6 = Review.query.filter_by(
        assignmentID=assignment.id,
        reviewerID=students[3].id,
        revieweeID=students[0].id
    ).first()

    if not review6:
        review6 = Review(
            assignmentID=assignment.id,
            reviewerID=students[3].id,
            revieweeID=students[0].id
        )
        Review.create_review(review6)
        click.echo(f"✓ Assigned review: {students[3].name} → {students[0].name}")

    # Complete some reviews with criteria (for testing teacher overview)
    click.echo("\nAdding sample completed reviews...")

    # Get all criteria descriptions for the rubric
    criteria_descriptions = CriteriaDescription.query.filter_by(rubricID=rubric.id).all()

    if criteria_descriptions and review1:
        # Complete Review 1 (Student 1 → Student 2) with high scores
        existing_criteria = Criterion.query.filter_by(reviewID=review1.id).count()
        if existing_criteria == 0:
            for i, crit_desc in enumerate(criteria_descriptions):
                criterion = Criterion(
                    reviewID=review1.id,
                    criterionRowID=crit_desc.id,
                    grade=9 if i < 3 else 8,
                    comments=f"Excellent work on {crit_desc.question.split('-')[0].strip().lower()}!"
                )
                db.session.add(criterion)
            review1.completed = True
            if not review1.completed_at:
                review1.completed_at = datetime.utcnow() - timedelta(days=7)
            db.session.commit()
            click.echo(f"✓ Completed review: {students[0].name} → {students[1].name}")

    if criteria_descriptions and review3:
        # Complete Review 3 (Student 2 → Student 3) with medium scores
        existing_criteria = Criterion.query.filter_by(reviewID=review3.id).count()
        if existing_criteria == 0:
            for i, crit_desc in enumerate(criteria_descriptions):
                criterion = Criterion(
                    reviewID=review3.id,
                    criterionRowID=crit_desc.id,
                    grade=7 if i % 2 == 0 else 8,
                    comments=f"Good job, but could improve {crit_desc.question.split('-')[0].strip().lower()}."
                )
                db.session.add(criterion)
            review3.completed = True
            if not review3.completed_at:
                review3.completed_at = datetime.utcnow() - timedelta(days=6)
            db.session.commit()
            click.echo(f"✓ Completed review: {students[1].name} → {students[2].name}")

    if criteria_descriptions and review4:
        # Complete Review 4 (Student 3 → Student 4)
        existing_criteria = Criterion.query.filter_by(reviewID=review4.id).count()
        if existing_criteria == 0:
            for i, crit_desc in enumerate(criteria_descriptions):
                criterion = Criterion(
                    reviewID=review4.id,
                    criterionRowID=crit_desc.id,
                    grade=9,
                    comments="Outstanding work!"
                )
                db.session.add(criterion)
            review4.completed = True
            if not review4.completed_at:
                review4.completed_at = datetime.utcnow() - timedelta(days=5)
            db.session.commit()
            click.echo(f"✓ Completed review: {students[2].name} → {students[3].name}")

    if criteria_descriptions and review6:
        # Complete Review 6 (Student 4 → Student 1)
        existing_criteria = Criterion.query.filter_by(reviewID=review6.id).count()
        if existing_criteria == 0:
            for i, crit_desc in enumerate(criteria_descriptions):
                criterion = Criterion(
                    reviewID=review6.id,
                    criterionRowID=crit_desc.id,
                    grade=8,
                    comments="Very good work overall."
                )
                db.session.add(criterion)
            review6.completed = True
            if not review6.completed_at:
                review6.completed_at = datetime.utcnow() - timedelta(days=4)
            db.session.commit()
            click.echo(f"✓ Completed review: {students[3].name} → {students[0].name}")

    click.echo("=" * 60)
    click.echo("Setup complete!")
    click.echo("=" * 60)
    click.echo("\n📋 CREDENTIALS (password: 123456):")
    click.echo("\nOriginal Users:")
    click.echo("  student@example.com | teacher@example.com | admin@example.com")
    click.echo("\nPeer Review Users:")
    click.echo("  teacher@test.com")
    click.echo("  student1@test.com | student2@test.com | student3@test.com | student4@test.com")

    # ---------------------------------------------------------------------
    # Additional seed data for group testing
    # ---------------------------------------------------------------------
    click.echo("\n" + "=" * 60)
    click.echo("Seeding additional group-testing data...")

    def _utc_now_naive():
        return datetime.now(timezone.utc).replace(tzinfo=None)

    def _date_only_end_of_day(d):
        return datetime(d.year, d.month, d.day, 23, 59, 59)

    group_teacher = User.get_by_email("teacher@example.com")
    if not group_teacher:
        click.echo(
            "Error: teacher@example.com not found; cannot seed group-testing courses.",
            err=True,
        )
        click.echo("")
        return

    # Create a bunch of additional students (password: 123456)
    group_test_students = []
    seeded_students = [
        {"name": "Annie Adams", "email": "annie@test.com"},
        {"name": "Ben Baker", "email": "ben@test.com"},
        {"name": "Casey Carter", "email": "casey@test.com"},
        {"name": "Drew Diaz", "email": "drew@test.com"},
        {"name": "Evan Evans", "email": "evan@test.com"},
        {"name": "Finn Foster", "email": "finn@test.com"},
        {"name": "Gabe Garcia", "email": "gabe@test.com"},
        {"name": "Harper Hughes", "email": "harper@test.com"},
        {"name": "Ivy Ito", "email": "ivy@test.com"},
        {"name": "Jules Johnson", "email": "jules@test.com"},
        {"name": "Kai Kim", "email": "kai@test.com"},
        {"name": "Logan Lee", "email": "logan@test.com"},
        {"name": "Morgan Miller", "email": "morgan@test.com"},
        {"name": "Nico Nguyen", "email": "nico@test.com"},
        {"name": "Oakley Ortiz", "email": "oakley@test.com"},
        {"name": "Priya Patel", "email": "priya@test.com"},
        {"name": "Quinn Quinn", "email": "quinn@test.com"},
        {"name": "Riley Rivera", "email": "riley@test.com"},
    ]

    def _unique_email(base_email: str) -> str:
        if not User.get_by_email(base_email):
            return base_email
        local, domain = base_email.split("@", 1)
        for n in range(2, 100):
            candidate = f"{local}{n}@{domain}"
            if not User.get_by_email(candidate):
                return candidate
        for n in range(1, 100):
            candidate = f"{local}_legacy{n}@{domain}"
            if not User.get_by_email(candidate):
                return candidate
        return f"{local}_legacy999@{domain}"

    for i, spec in enumerate(seeded_students, start=1):
        desired_name = spec["name"]
        desired_email = spec["email"]

        legacy_emails = [
            f"groupstudent{i:02d}@test.com",
            f"student{i:02d}@test.com",
        ]

        student = User.get_by_email(desired_email)
        legacy_student = None
        legacy_students = [User.get_by_email(le) for le in legacy_emails]

        if student:
            if student.name != desired_name:
                student.name = desired_name
                student.update()
            for legacy in legacy_students:
                if legacy and legacy.id != student.id:
                    old_email = legacy.email
                    legacy.name = desired_name
                    local, domain = desired_email.split("@", 1)
                    legacy.email = _unique_email(f"{local}_legacy{i}@{domain}")
                    legacy.update()
                    click.echo(f"✓ Updated student: {old_email} -> {legacy.email}")
            click.echo(f"✓ Student already exists: {student.email}")
            group_test_students.append(student)
            continue

        for legacy in legacy_students:
            if legacy:
                legacy_student = legacy
                break

        if legacy_student:
            legacy_student.name = desired_name
            legacy_student.email = _unique_email(desired_email)
            legacy_student.update()
            click.echo(f"✓ Updated student: {legacy_student.email}")
            group_test_students.append(legacy_student)
            continue

        hashed = generate_password_hash("123456", method="pbkdf2:sha256")
        created = User(
            name=desired_name,
            email=_unique_email(desired_email),
            hash_pass=hashed,
            role="student",
        )
        User.create_user(created)
        click.echo(f"✓ Created student: {created.email}")
        group_test_students.append(created)

    # Create a few sample classes/courses taught by the example teacher.
    # If legacy group-testing courses exist, rename them to the COSC courses.
    legacy_to_new_course_names = {
        "Group Testing 101 - Section A": "COSC 224",
        "Group Testing 101 - Section B": "COSC 205",
        "Group Testing 101 - Section C": "COSC 211",
    }

    for legacy_name, new_name in legacy_to_new_course_names.items():
        legacy_course = Course.get_by_name_teacher(legacy_name, group_teacher.id)
        if legacy_course and legacy_course.name != new_name:
            legacy_course.name = new_name
            db.session.commit()
            click.echo(f"✓ Renamed course: {legacy_name} -> {new_name} (ID: {legacy_course.id})")

    group_test_course_names = ["COSC 224", "COSC 205", "COSC 211", "COSC 232"]

    group_test_courses = []
    for course_name in group_test_course_names:
        course = Course.get_by_name_teacher(course_name, group_teacher.id)
        if not course:
            course = Course(teacherID=group_teacher.id, name=course_name)
            Course.create_course(course)
            click.echo(f"✓ Created course: {course.name} (ID: {course.id})")
        else:
            click.echo(f"✓ Course already exists: {course.name} (ID: {course.id})")
        group_test_courses.append(course)

    # Enroll students into courses (idempotent)
    # COSC 224: enroll all group-test students
    cosc_224 = group_test_courses[0]
    enrolled = 0
    for student in group_test_students:
        if not User_Course.get(student.id, cosc_224.id):
            db.session.add(User_Course(userID=student.id, courseID=cosc_224.id))
            enrolled += 1
    if enrolled:
        db.session.commit()
        click.echo(f"✓ Enrolled {enrolled} students into '{cosc_224.name}'")
    else:
        click.echo(f"✓ All students already enrolled in '{cosc_224.name}'")

    # COSC 205: enroll first 12 students
    cosc_205 = group_test_courses[1]
    enrolled = 0
    for student in group_test_students[:12]:
        if not User_Course.get(student.id, cosc_205.id):
            db.session.add(User_Course(userID=student.id, courseID=cosc_205.id))
            enrolled += 1
    if enrolled:
        db.session.commit()
        click.echo(f"✓ Enrolled {enrolled} students into '{cosc_205.name}'")
    else:
        click.echo(f"✓ Students already enrolled in '{cosc_205.name}'")

    # COSC 211: enroll last 8 students
    cosc_211 = group_test_courses[2]
    enrolled = 0
    for student in group_test_students[-8:]:
        if not User_Course.get(student.id, cosc_211.id):
            db.session.add(User_Course(userID=student.id, courseID=cosc_211.id))
            enrolled += 1
    if enrolled:
        db.session.commit()
        click.echo(f"✓ Enrolled {enrolled} students into '{cosc_211.name}'")
    else:
        click.echo(f"✓ Students already enrolled in '{cosc_211.name}'")

    # COSC 232: enroll a subset (first 8 students)
    cosc_232 = group_test_courses[3]
    enrolled = 0
    for student in group_test_students[:8]:
        if not User_Course.get(student.id, cosc_232.id):
            db.session.add(User_Course(userID=student.id, courseID=cosc_232.id))
            enrolled += 1
    if enrolled:
        db.session.commit()
        click.echo(f"✓ Enrolled {enrolled} students into '{cosc_232.name}'")
    else:
        click.echo(f"✓ Students already enrolled in '{cosc_232.name}'")

    # Pre-create a few groups in COSC 224, leaving some students unassigned
    click.echo(f"\nCreating sample groups in '{cosc_224.name}'...")
    group_specs = [
        ("Alpha", group_test_students[0:4]),
        ("Beta", group_test_students[4:8]),
        ("Gamma", group_test_students[8:12]),
        ("Delta", group_test_students[12:15]),
        ("Epsilon", group_test_students[15:18]),
    ]

    for group_name, members in group_specs:
        group = Group.query.filter_by(course_id=cosc_224.id, name=group_name).first()
        if not group:
            group = Group.create(name=group_name, course_id=cosc_224.id)
            click.echo(f"✓ Created group: {group.name} (ID: {group.id})")
        else:
            click.echo(f"✓ Group already exists: {group.name} (ID: {group.id})")

        added_members = 0
        for student in members:
            existing_member = GroupMember.query.filter_by(
                group_id=group.id, user_id=student.id
            ).first()
            if existing_member:
                continue
            db.session.add(GroupMember(group_id=group.id, user_id=student.id))
            added_members += 1

        if added_members:
            db.session.commit()
            click.echo(f"  - Added {added_members} members to '{group.name}'")

    click.echo("\nGroup-testing seed data ready.")
    click.echo("Try logging in as:")
    click.echo("  teacher@example.com (teacher)")
    click.echo("  annie@test.com (student)")
    click.echo("")

    # ---------------------------------------------------------------------
    # Showcase/demo data: seed all COSC courses with sane due dates
    # ---------------------------------------------------------------------
    click.echo("Seeding COSC course demo data (~12 assignments per course)...")

    def _get_or_create_review(assignment_id: int, reviewer_id: int, reviewee_id: int) -> Review:
        existing = Review.get_by_reviewer_reviewee_assignment(reviewer_id, reviewee_id, assignment_id)
        if existing:
            return existing
        review = Review(assignmentID=assignment_id, reviewerID=reviewer_id, revieweeID=reviewee_id)
        Review.create_review(review)
        return review

    def _ensure_review_completed(
        review: Review,
        rubric_id: int,
        *,
        score: int,
        comment_prefix: str,
        completed_at: datetime,
    ) -> bool:
        existing = Criterion.query.filter_by(reviewID=review.id).count()
        criteria_rows = (
            CriteriaDescription.query.filter_by(rubricID=rubric_id)
            .order_by(CriteriaDescription.id.asc())
            .all()
        )
        if not criteria_rows:
            return False

        if existing == 0:
            for row in criteria_rows:
                db.session.add(
                    Criterion(
                        reviewID=review.id,
                        criterionRowID=row.id,
                        grade=score,
                        comments=f"{comment_prefix}",
                    )
                )

        review.completed = True
        if not review.completed_at:
            review.completed_at = completed_at
        db.session.commit()
        return True

    def _get_group_members(group_id: int) -> list[User]:
        return (
            User.query.join(GroupMember, GroupMember.user_id == User.id)
            .filter(GroupMember.group_id == group_id)
            .order_by(User.id.asc())
            .all()
        )

    def _get_course_students(course_id: int) -> list[User]:
        return (
            User.query.join(User_Course, User_Course.userID == User.id)
            .filter(User_Course.courseID == course_id)
            .filter(User.role == "student")
            .order_by(User.id.asc())
            .all()
        )

    def _upsert_assignment(
        *,
        course_id: int,
        name: str,
        rubric_text: str,
        due_date: datetime,
        assignment_type: str,
        description: str,
    ) -> Assignment:
        assignment = Assignment.query.filter_by(courseID=course_id, name=name).first()
        if not assignment:
            assignment = Assignment(
                courseID=course_id,
                name=name,
                rubric_text=rubric_text,
                due_date=due_date,
                description=description,
                assignment_type=assignment_type,
            )
            Assignment.create(assignment)
            click.echo(f"✓ Created assignment: {name}")
        else:
            assignment.rubric_text = rubric_text
            assignment.due_date = due_date
            assignment.assignment_type = assignment_type
            assignment.description = description
            assignment.update()
        return assignment

    def _seed_standard_submissions(*, assignments: list[Assignment], students: list[User], path_prefix: str):
        for a_idx, assignment in enumerate(assignments, start=1):
            if not assignment.due_date:
                continue

            is_past = assignment.due_date < datetime.utcnow()
            for s_idx, student in enumerate(students):
                # Ensure we have a mix of done and todo.
                if is_past:
                    should_submit = ((s_idx + a_idx) % 3) != 0
                else:
                    should_submit = ((s_idx + a_idx) % 6) == 0

                if not should_submit:
                    continue

                is_late = is_past and ((s_idx + a_idx) % 5) == 0
                submitted_at = (
                    assignment.due_date + timedelta(hours=6)
                    if is_late
                    else assignment.due_date - timedelta(hours=2)
                )

                existing = Submission.query.filter_by(
                    studentID=student.id, assignmentID=assignment.id
                ).first()
                if not existing:
                    db.session.add(
                        Submission(
                            path=(
                                f"/seed/{path_prefix}/{student.email.replace('@', '_')}_a{a_idx:02d}.pdf"
                            ),
                            studentID=student.id,
                            assignmentID=assignment.id,
                            submitted_at=submitted_at,
                        )
                    )
                else:
                    if existing.submitted_at != submitted_at:
                        existing.submitted_at = submitted_at
                    if not existing.path:
                        existing.path = (
                            f"/seed/{path_prefix}/{student.email.replace('@', '_')}_a{a_idx:02d}.pdf"
                        )

            db.session.commit()

    course_groups = Group.query.filter_by(course_id=cosc_224.id).order_by(Group.id.asc()).all()
    # COSC 224: keep this course demo-heavy (standard + individual peer eval + group peer eval)
    click.echo("Seeding COSC 224 demo timeline (12 assignments; mostly upcoming)...")

    # If you previously seeded 8 weeks (24 assignments), remove the extra weeks to keep the DB tidy.
    for week_num in range(5, 50):
        for suffix in [": Weekly Update", ": Individual Peer Evaluation", ": Group Peer Evaluation"]:
            old_name = f"Week {week_num}{suffix}"
            old = Assignment.query.filter_by(courseID=cosc_224.id, name=old_name).first()
            if not old:
                continue

            if (old.assignment_type or "standard") == "peer_eval_group":
                subs = GroupEvaluationSubmission.query.filter_by(assignment_id=old.id).all()
                for s in subs:
                    db.session.delete(s)
                AssignmentIncludedGroup.query.filter_by(assignment_id=old.id).delete()
                db.session.commit()

            db.session.delete(old)
            db.session.commit()

    today = datetime.utcnow().date()
    current_monday = today - timedelta(days=today.weekday())
    cosc_224_week_offsets = [-1, 0, 1, 2]  # 1 past week + current + 2 upcoming weeks

    cosc_224_assignments: list[Assignment] = []
    for week_index, week_offset in enumerate(cosc_224_week_offsets, start=1):
        week_monday = current_monday + timedelta(weeks=week_offset)
        due_standard = _date_only_end_of_day(week_monday + timedelta(days=4))
        due_peer = _date_only_end_of_day(week_monday + timedelta(days=6))

        cosc_224_assignments.append(
            _upsert_assignment(
                course_id=cosc_224.id,
                name=f"Week {week_index}: Weekly Update",
                rubric_text="Submit a short weekly update as a PDF.",
                due_date=due_standard,
                assignment_type="standard",
                description="Weekly check-in: progress, blockers, and next steps.",
            )
        )

        ind = _upsert_assignment(
            course_id=cosc_224.id,
            name=f"Week {week_index}: Individual Peer Evaluation",
            rubric_text="Rate each teammate using the rubric.",
            due_date=due_peer,
            assignment_type="peer_eval_individual",
            description="Complete an individual peer evaluation for each of your teammates.",
        )
        cosc_224_assignments.append(ind)

        grp = _upsert_assignment(
            course_id=cosc_224.id,
            name=f"Week {week_index}: Group Peer Evaluation",
            rubric_text="As a group, evaluate the other groups using the rubric.",
            due_date=due_peer,
            assignment_type="peer_eval_group",
            description="Submit one group-level evaluation on behalf of your team.",
        )
        cosc_224_assignments.append(grp)

        for a in [ind, grp]:
            existing = Rubric.query.filter_by(assignmentID=a.id).first()
            if not existing:
                _ensure_default_rubric_for_assignment(a)

        if len(course_groups) >= 2:
            AssignmentIncludedGroup.query.filter_by(assignment_id=grp.id).delete()
            for g in course_groups:
                db.session.add(AssignmentIncludedGroup(assignment_id=grp.id, group_id=g.id))
            db.session.commit()

    click.echo("\nSeeding COSC 224 activity (submissions + peer evals)...")

    cosc_224_students = _get_course_students(cosc_224.id)
    standard_assignments = [
        a for a in cosc_224_assignments if (a.assignment_type or "standard") == "standard"
    ]
    _seed_standard_submissions(
        assignments=standard_assignments,
        students=cosc_224_students,
        path_prefix="cosc224",
    )

    # Individual peer eval: create teammate review tasks and complete a mix.
    individual_assignments = [
        a for a in cosc_224_assignments if (a.assignment_type or "standard") == "peer_eval_individual"
    ]
    for week_index, assignment in enumerate(individual_assignments, start=1):
        rubric = Rubric.query.filter_by(assignmentID=assignment.id).first()
        if not rubric or not assignment.due_date:
            continue

        week_is_past = assignment.due_date < datetime.utcnow()
        for group_idx, group in enumerate(course_groups):
            members = _get_group_members(group.id)
            if len(members) < 2:
                continue
            # Create review tasks (everyone reviews everyone else in their group).
            for reviewer in members:
                for reviewee in members:
                    if reviewer.id == reviewee.id:
                        continue
                    _get_or_create_review(assignment.id, reviewer.id, reviewee.id)

        db.session.commit()

        if not week_is_past:
            continue

        # Complete a deterministic mix of reviews (some fully done, some partial, some none).
        for group_idx, group in enumerate(course_groups):
            members = _get_group_members(group.id)
            if len(members) < 2:
                continue

            for reviewer_idx, reviewer in enumerate(members):
                mode = (week_index + group_idx + reviewer_idx) % 3  # 0=all, 1=partial, 2=none
                assigned = Review.query.filter_by(assignmentID=assignment.id, reviewerID=reviewer.id).order_by(Review.id.asc()).all()
                if not assigned:
                    continue

                completed_at = assignment.due_date + timedelta(hours=4) if mode == 1 else assignment.due_date - timedelta(hours=3)
                to_complete = assigned if mode == 0 else assigned[:1] if mode == 1 else []

                for r in to_complete:
                    _ensure_review_completed(
                        r,
                        rubric.id,
                        score=5 if (reviewer_idx + week_index) % 2 == 0 else 4,
                        comment_prefix="Helpful feedback:",
                        completed_at=completed_at,
                    )

        # Backfill completed_at for any already-completed seeded reviews.
        for r in Review.query.filter_by(assignmentID=assignment.id, completed=True).all():
            if not r.completed_at:
                r.completed_at = assignment.due_date - timedelta(hours=1)
        db.session.commit()

    # Group peer eval: seed some group submissions and rubric responses.
    group_assignments = [
        a for a in cosc_224_assignments if (a.assignment_type or "standard") == "peer_eval_group"
    ]
    for week_index, assignment in enumerate(group_assignments, start=1):
        rubric = Rubric.query.filter_by(assignmentID=assignment.id).first()
        if not rubric or not assignment.due_date:
            continue
        week_is_past = assignment.due_date < datetime.utcnow()
        if not week_is_past:
            continue

        rows = (
            CriteriaDescription.query.filter_by(rubricID=rubric.id)
            .order_by(CriteriaDescription.id.asc())
            .all()
        )
        if not rows:
            continue

        for group_idx, reviewer_group in enumerate(course_groups):
            members = _get_group_members(reviewer_group.id)
            if not members:
                continue

            should_submit = ((week_index + group_idx) % 3) != 0
            if not should_submit:
                continue

            is_late = ((week_index + group_idx) % 4) == 0
            submitted_at = assignment.due_date + timedelta(hours=6) if is_late else assignment.due_date - timedelta(hours=2)

            sub = GroupEvaluationSubmission.get_by_assignment_and_group(assignment.id, reviewer_group.id)
            if not sub:
                sub = GroupEvaluationSubmission(
                    assignment_id=assignment.id,
                    reviewer_group_id=reviewer_group.id,
                    submitted_by_user_id=members[0].id,
                    submitted_at=submitted_at,
                )
                db.session.add(sub)
                db.session.commit()
            else:
                if sub.submitted_at != submitted_at:
                    sub.submitted_at = submitted_at
                    db.session.commit()

            existing_targets = sub.targets.count() if hasattr(sub.targets, "count") else 0
            if existing_targets:
                continue

            for reviewee_group in course_groups:
                if reviewee_group.id == reviewer_group.id:
                    continue
                target = GroupEvaluationTarget(submission_id=sub.id, reviewee_group_id=reviewee_group.id)
                db.session.add(target)
                db.session.commit()

                for row in rows:
                    db.session.add(
                        GroupEvaluationCriterion(
                            target_id=target.id,
                            criterionRowID=row.id,
                            grade=4,
                            comments=None,
                        )
                    )

            db.session.commit()

    # ---------------------------------------------------------------------
    # COSC 205/211/232: seed ~12 standard assignments each, mostly upcoming.
    # ---------------------------------------------------------------------
    click.echo("\nSeeding COSC 205/211/232 standard assignments...")

    def _seed_standard_assignments_for_course(
        *,
        course: Course,
        title_prefix: str,
        count: int,
        path_prefix: str,
    ) -> list[Assignment]:
        due_dates: list[datetime] = []
        base_date = datetime.utcnow().date()
        # A couple past due for demo, the rest in the future.
        due_dates.append(_date_only_end_of_day(base_date - timedelta(days=10)))
        due_dates.append(_date_only_end_of_day(base_date - timedelta(days=3)))
        for i in range(max(0, count - 2)):
            due_dates.append(_date_only_end_of_day(base_date + timedelta(days=3 + i * 7)))
        due_dates = due_dates[:count]

        assignments: list[Assignment] = []
        for i in range(count):
            assignments.append(
                _upsert_assignment(
                    course_id=course.id,
                    name=f"{title_prefix} {i + 1}",
                    rubric_text=f"{title_prefix} submission.",
                    due_date=due_dates[i],
                    assignment_type="standard",
                    description=f"Seeded {title_prefix.lower()} assignment for demo/testing.",
                )
            )

        students = _get_course_students(course.id)
        _seed_standard_submissions(assignments=assignments, students=students, path_prefix=path_prefix)
        return assignments

    _seed_standard_assignments_for_course(
        course=cosc_205,
        title_prefix="Homework",
        count=11,
        path_prefix="cosc205",
    )
    _seed_standard_assignments_for_course(
        course=cosc_211,
        title_prefix="Lab",
        count=12,
        path_prefix="cosc211",
    )
    _seed_standard_assignments_for_course(
        course=cosc_232,
        title_prefix="Problem Set",
        count=12,
        path_prefix="cosc232",
    )

    # COSC 205: add a small peer-eval individual example in a different class
    cosc_205_ind_name = "Individual Peer Evaluation (HW Team)"
    cosc_205_ind = Assignment.query.filter_by(courseID=cosc_205.id, name=cosc_205_ind_name).first()
    if not cosc_205_ind:
        cosc_205_ind = Assignment(
            courseID=cosc_205.id,
            name=cosc_205_ind_name,
            rubric_text="Rate each teammate using the rubric.",
            description=(
                "Individual peer evaluation for your homework team.\n"
                "Your assigned list reflects your current teammates."
            ),
            due_date=_date_only_end_of_day((datetime.now().date() + timedelta(days=21))),
            assignment_type="peer_eval_individual",
        )
        Assignment.create(cosc_205_ind)

    if cosc_205_ind:
        existing = Rubric.query.filter_by(assignmentID=cosc_205_ind.id).first()
        if not existing:
            _ensure_default_rubric_for_assignment(cosc_205_ind)

        # Ensure COSC 205 has at least 2 simple groups for teammate relationships.
        red = Group.query.filter_by(course_id=cosc_205.id, name="Red").first()
        blue = Group.query.filter_by(course_id=cosc_205.id, name="Blue").first()
        if not red:
            red = Group.create(name="Red", course_id=cosc_205.id)
        if not blue:
            blue = Group.create(name="Blue", course_id=cosc_205.id)

        evan = User.get_by_email("evan@test.com")
        finn = User.get_by_email("finn@test.com")
        gabe = User.get_by_email("gabe@test.com")
        if evan and finn and gabe:
            for u in [evan, finn]:
                if not GroupMember.query.filter_by(group_id=red.id, user_id=u.id).first():
                    db.session.add(GroupMember(group_id=red.id, user_id=u.id))
            if not GroupMember.query.filter_by(group_id=blue.id, user_id=gabe.id).first():
                db.session.add(GroupMember(group_id=blue.id, user_id=gabe.id))
            db.session.commit()

            cosc_205_rubric = Rubric.query.filter_by(assignmentID=cosc_205_ind.id).first()
            if cosc_205_rubric:
                rr = _get_or_create_review(cosc_205_ind.id, evan.id, finn.id)
                did = _ensure_review_completed(
                    rr,
                    cosc_205_rubric.id,
                    score=5,
                    comment_prefix="Great teammate:",
                    completed_at=(
                        (cosc_205_ind.due_date or datetime.utcnow()) - timedelta(hours=2)
                    ),
                )
                if did:
                    click.echo("✓ Seeded completed individual peer eval in COSC 205 (Evan → Finn)")
                else:
                    click.echo("✓ COSC 205 individual peer eval example already seeded")



@click.command("create_admin")
@with_appcontext
def create_admin_command():
    """Create an admin user"""
    name = click.prompt("Admin name")
    email = click.prompt("Admin email")
    password = click.prompt("Password", hide_input=True, confirmation_prompt=True)

    # Check if user already exists
    if User.get_by_email(email):
        click.echo(f"Error: User with email '{email}' already exists", err=True)
        return

    # Create admin user
    hashed = generate_password_hash(password, method="pbkdf2:sha256")
    admin = User(name=name, email=email, hash_pass=hashed, role="admin")
    User.create_user(admin)
    click.echo(f"Admin user '{email}' created successfully")


@click.command("ensure_admin")
@with_appcontext
def ensure_admin_command():
    """Ensure a default admin exists using environment variables.

    Requires DEFAULT_ADMIN_NAME, DEFAULT_ADMIN_EMAIL, DEFAULT_ADMIN_PASSWORD.
    Safe to run repeatedly; updates role/password if the user already exists.
    """

    name = os.environ.get("DEFAULT_ADMIN_NAME")
    email = os.environ.get("DEFAULT_ADMIN_EMAIL")
    password = os.environ.get("DEFAULT_ADMIN_PASSWORD")

    if not all([name, email, password]):
        click.echo(
            "DEFAULT_ADMIN_* environment variables not fully set; skipping admin bootstrap"
        )
        return

    assert name is not None
    assert email is not None
    assert password is not None

    existing_user = User.get_by_email(email)
    hashed = generate_password_hash(password, method="pbkdf2:sha256")

    if existing_user:
        if existing_user.role != "admin" or existing_user.hash_pass != hashed:
            existing_user.role = "admin"
            existing_user.hash_pass = hashed
            existing_user.update()
            click.echo(f"Updated existing user '{email}' to admin role")
        else:
            click.echo(f"Admin user '{email}' already exists; no changes made")
        return

    admin = User(name=name, email=email, hash_pass=hashed, role="admin")
    User.create_user(admin)
    click.echo(f"Admin user '{email}' created successfully")


@click.command("add_sample_courses")
@with_appcontext
def add_sample_courses_command():
    """Add sample courses and assignments to the database"""
    # Get the teacher user (or create one if it doesn't exist)
    teacher = User.get_by_email("teacher@example.com")
    if not teacher:
        click.echo("Error: Teacher user 'teacher@example.com' not found. Run 'flask add_users' first.", err=True)
        return

    # Define sample courses
    sample_courses = [
        {"name": "COSC 404 Advanced Database Management Systems"},
        {"name": "COSC 470 Software Engineering"},
        {"name": "COSC 360 Server Platform As A Service"},
    ]

    for course_data in sample_courses:
        # Check if course already exists
        existing_course = Course.get_by_name_teacher(course_data["name"], teacher.id)
        if existing_course:
            click.echo(f"Course '{course_data['name']}' already exists")
            continue

        # Create course
        course = Course(teacherID=teacher.id, name=course_data["name"])
        Course.create_course(course)
        click.echo(f"Course '{course.name}' created (id={course.id})")

        # Add an example assignment to the course
        assignment = Assignment(
            courseID=course.id,
            name="Example Assignment",
            rubric_text="Example rubric",
            # due_date=None
            # due_date is currently not in the Assignment table
        )
        Assignment.create(assignment)
        click.echo(f"  - Assignment 'Example Assignment' added to '{course.name}'")

    click.echo("Sample courses and assignments created successfully")


def init_app(app):
    """Register CLI commands with the Flask app"""
    app.cli.add_command(init_db_command)
    app.cli.add_command(drop_db_command)
    app.cli.add_command(drop_has_score_column_command)
    app.cli.add_command(add_users_command)
    app.cli.add_command(create_admin_command)
    app.cli.add_command(ensure_admin_command)
    app.cli.add_command(add_sample_courses_command)
    # Bulk-create sample users: `flask add_many_users --count 30`
    @click.command("add_many_users")
    @click.option("--count", default=30, help="Number of users to create")
    @with_appcontext
    def add_many_users_command(count: int):
        """Add many test users of the form 'Student X' with email studentX@email.com"""
        click.echo(f"Creating {count} users...")
        created = 0
        for i in range(1, count + 1):
            name = f"Student {i}"
            email = f"student{i}@email.com"
            if User.get_by_email(email):
                click.echo(f"- already exists: {email}")
                continue
            hashed = generate_password_hash("123456", method="pbkdf2:sha256")
            user = User(name=name, email=email, hash_pass=hashed, role="student")
            User.create_user(user)
            created += 1
            click.echo(f"- created: {email}")

        click.echo(f"Done. Created {created} new users.")

    app.cli.add_command(add_many_users_command)
