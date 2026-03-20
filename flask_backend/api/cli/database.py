import os
from datetime import datetime, timedelta, timezone

import click
from flask.cli import with_appcontext
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

    # Create assignment with due date 7 days in the future
    assignment_name = "Essay Peer Review Assignment"
    assignment = Assignment.query.filter_by(
        courseID=course.id,
        name=assignment_name
    ).first()

    if not assignment:
        due_date = datetime.now(timezone.utc) + timedelta(days=7)
        assignment = Assignment(
            courseID=course.id,
            name=assignment_name,
            rubric_text="Please review your peer's essay",
            due_date=due_date
        )
        Assignment.create(assignment)
        click.echo(f"✓ Created assignment: {assignment.name} (ID: {assignment.id})")
        click.echo(f"  Due date: {assignment.due_date.strftime('%Y-%m-%d %H:%M:%S %Z')}")
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
                "hasScore": True
            },
            {
                "question": "Organization - Is the work well-structured and logical?",
                "scoreMax": 10,
                "hasScore": True
            },
            {
                "question": "Clarity - Is the writing clear and easy to understand?",
                "scoreMax": 10,
                "hasScore": True
            },
            {
                "question": "Completeness - Does the work address all requirements?",
                "scoreMax": 10,
                "hasScore": True
            },
            {
                "question": "Overall Impression - What is your overall assessment?",
                "scoreMax": 10,
                "hasScore": True
            }
        ]

        for crit_data in criteria_list:
            criterion = CriteriaDescription(
                rubricID=rubric.id,
                question=crit_data["question"],
                scoreMax=crit_data["scoreMax"],
                hasScore=crit_data["hasScore"]
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
                assignmentID=assignment.id
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
    # Showcase assignments with different states/features
    # ---------------------------------------------------------------------
    click.echo("Seeding showcase assignments...")

    showcase = [
        {
            "course": cosc_224,
            "name": "Week 1 Project Proposal",
            "assignment_type": "standard",
            "due_date": _utc_now_naive() + timedelta(days=14),
            "rubric_text": "Submit your proposal as a PDF.",
        },
        {
            "course": cosc_224,
            "name": "Sprint Checkpoint",
            "assignment_type": "standard",
            "due_date": _utc_now_naive() + timedelta(days=2),
            "rubric_text": "Short progress update and next steps.",
        },
        {
            "course": cosc_224,
            "name": "Individual Peer Evaluation",
            "assignment_type": "peer_eval_individual",
            "due_date": _date_only_end_of_day((datetime.now().date() + timedelta(days=1))),
            "rubric_text": "Rate each teammate using the rubric.",
        },
        {
            "course": cosc_224,
            "name": "Group Peer Evaluation",
            "assignment_type": "peer_eval_group",
            "due_date": _date_only_end_of_day(datetime.now().date()),
            "rubric_text": "As a group, evaluate the other groups using the rubric.",
        },
        {
            "course": cosc_224,
            "name": "Optional Reflection (No Due Date)",
            "assignment_type": "standard",
            "due_date": None,
            "rubric_text": "Optional reflection (no due date).",
        },
        {
            "course": cosc_224,
            "name": "Past due",
            "assignment_type": "standard",
            "due_date": _utc_now_naive() - timedelta(days=2),
            "rubric_text": "Showcase assignment that is already past due.",
        },
        {
            "course": cosc_205,
            "name": "Homework 1",
            "assignment_type": "standard",
            "due_date": _utc_now_naive() + timedelta(days=14),
            "rubric_text": "Homework submission.",
        },
        {
            "course": cosc_205,
            "name": "Homework 2",
            "assignment_type": "standard",
            "due_date": _utc_now_naive() + timedelta(days=2),
            "rubric_text": "Second homework submission.",
        },
        {
            "course": cosc_205,
            "name": "Reading Reflection (No Due Date)",
            "assignment_type": "standard",
            "due_date": None,
            "rubric_text": "Optional reading reflection.",
        },
        {
            "course": cosc_211,
            "name": "Lab 1",
            "assignment_type": "standard",
            "due_date": _utc_now_naive() + timedelta(days=2),
            "rubric_text": "Lab submission.",
        },
        {
            "course": cosc_211,
            "name": "Lab 2",
            "assignment_type": "standard",
            "due_date": _utc_now_naive() + timedelta(days=14),
            "rubric_text": "Second lab submission.",
        },
        {
            "course": cosc_211,
            "name": "Checkpoint Quiz",
            "assignment_type": "standard",
            "due_date": _date_only_end_of_day((datetime.now().date() + timedelta(days=1))),
            "rubric_text": "Quick quiz (due tomorrow).",
        },
        {
            "course": cosc_232,
            "name": "Mini Project (No Due Date)",
            "assignment_type": "standard",
            "due_date": None,
            "rubric_text": "Mini project kickoff.",
        },
        {
            "course": cosc_232,
            "name": "Problem Set 1",
            "assignment_type": "standard",
            "due_date": _utc_now_naive() + timedelta(days=14),
            "rubric_text": "Problem set submission.",
        },
        {
            "course": cosc_232,
            "name": "Problem Set 2",
            "assignment_type": "standard",
            "due_date": _utc_now_naive() + timedelta(days=2),
            "rubric_text": "Second problem set submission.",
        },
    ]

    for spec in showcase:
        course = spec["course"]
        name = spec["name"]
        assignment = Assignment.query.filter_by(courseID=course.id, name=name).first()
        if not assignment:
            assignment = Assignment(
                courseID=course.id,
                name=name,
                rubric_text=spec["rubric_text"],
                due_date=spec["due_date"],
                assignment_type=spec["assignment_type"],
            )
            Assignment.create(assignment)
            click.echo(f"✓ Created assignment: {course.name} -> {assignment.name} (ID: {assignment.id})")
        else:
            assignment.rubric_text = spec["rubric_text"]
            assignment.due_date = spec["due_date"]
            assignment.assignment_type = spec["assignment_type"]
            assignment.update()
            click.echo(f"✓ Assignment already exists (updated): {course.name} -> {assignment.name} (ID: {assignment.id})")

        if assignment.assignment_type in {"peer_eval_group", "peer_eval_individual"}:
            _ensure_default_rubric_for_assignment(assignment)

        if assignment.assignment_type == "peer_eval_group":
            course_groups = Group.query.filter_by(course_id=course.id).all()
            if len(course_groups) >= 2:
                AssignmentIncludedGroup.query.filter_by(assignment_id=assignment.id).delete()
                for g in course_groups:
                    db.session.add(AssignmentIncludedGroup(assignment_id=assignment.id, group_id=g.id))
                db.session.commit()
                click.echo(f"  - Included {len(course_groups)} groups for group peer eval")



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
