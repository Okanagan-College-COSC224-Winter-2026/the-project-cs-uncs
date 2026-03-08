import os
from datetime import datetime, timedelta, timezone

import click
from flask.cli import with_appcontext
from werkzeug.security import generate_password_hash

from ..models import (
    User,
    Course,
    Assignment,
    Rubric,
    CriteriaDescription,
    Submission,
    Review,
    User_Course
)
from ..models.db import db


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

    click.echo("=" * 60)
    click.echo("Setup complete!")
    click.echo("=" * 60)
    click.echo("\n📋 ALL CREDENTIALS (password: 123456):")
    click.echo("-" * 60)
    click.echo("\nORIGINAL EXAMPLE USERS:")
    click.echo("  Student: student@example.com")
    click.echo("  Teacher: teacher@example.com")
    click.echo("  Admin:   admin@example.com")
    click.echo("\nPEER REVIEW USERS:")
    click.echo("  Teacher: teacher@test.com")
    click.echo("  Students:")
    for i in range(1, 5):
        click.echo(f"    - student{i}@test.com")
    click.echo("-" * 60)
    click.echo(f"\nPeer Review Course ID: {course.id}")
    click.echo(f"Assignment ID: {assignment.id}")
    click.echo(f"\n{students[0].name} has 2 reviews assigned")
    click.echo(f"{students[1].name} has 1 review assigned")
    click.echo(f"{students[2].name} and {students[3].name} have 0 reviews assigned")
    click.echo("\n🚀 To test peer reviews:")
    click.echo("1. Start backend: flask run")
    click.echo("2. Start frontend: cd ../frontend && npm run dev")
    click.echo("3. Login as student1@test.com (password: 123456)")
    click.echo(f"4. Navigate to assignment {assignment.id}")
    click.echo("5. Click 'View Peer Reviews' and complete a review!")
    click.echo("")


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
