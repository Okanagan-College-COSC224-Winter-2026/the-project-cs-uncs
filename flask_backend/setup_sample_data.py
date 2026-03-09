"""
Quick setup script to create sample data for testing the peer review feature.
This creates a teacher, students, a course, an assignment, and assigns reviews.
"""

from api import create_app
from api.models import User, Course, Assignment, Review, Submission
from api.models.db import db
from werkzeug.security import generate_password_hash
from datetime import datetime, timedelta, timezone

app = create_app()

with app.app_context():
    print("Creating sample data for peer review testing...")

    # Create teacher
    teacher = User(
        name="Professor Smith",
        email="teacher@test.com",
        hash_pass=generate_password_hash("password123"),
        role="teacher"
    )
    User.create_user(teacher)
    print(f"✓ Created teacher: {teacher.email}")

    # Create students
    students = []
    for i in range(1, 5):
        student = User(
            name=f"Student {i}",
            email=f"student{i}@test.com",
            hash_pass=generate_password_hash("password123"),
            role="student"
        )
        User.create_user(student)
        students.append(student)
        print(f"✓ Created student: {student.email}")

    # Create course
    course = Course(
        teacherID=teacher.id,
        name="Introduction to Peer Review"
    )
    Course.create_course(course)
    print(f"✓ Created course: {course.name} (ID: {course.id})")

    # Enroll all students in the course
    from api.models import User_Course
    for student in students:
        enrollment = User_Course(userID=student.id, courseID=course.id)
        db.session.add(enrollment)
    db.session.commit()
    print(f"✓ Enrolled {len(students)} students in the course")

    # Create assignment with due date 7 days in the future
    due_date = datetime.now(timezone.utc) + timedelta(days=7)
    assignment = Assignment(
        courseID=course.id,
        name="Essay Peer Review Assignment",
        rubric_text="Please review your peer's essay",
        due_date=due_date
    )
    Assignment.create(assignment)
    print(f"✓ Created assignment: {assignment.name} (ID: {assignment.id})")
    print(f"  Due date: {assignment.due_date}")

    # Create submissions for students 2, 3, and 4
    for i, student in enumerate(students[1:], start=2):
        submission = Submission(
            path=f"/submissions/student{i}_essay.pdf",
            studentID=student.id,
            assignmentID=assignment.id
        )
        Submission.create_submission(submission)
        print(f"✓ Created submission for {student.name}")

    # Assign reviews: Student 1 reviews Students 2 and 3
    review1 = Review(
        assignmentID=assignment.id,
        reviewerID=students[0].id,  # Student 1
        revieweeID=students[1].id   # reviews Student 2
    )
    Review.create_review(review1)
    print(f"✓ Assigned review: {students[0].name} → {students[1].name}")

    review2 = Review(
        assignmentID=assignment.id,
        reviewerID=students[0].id,  # Student 1
        revieweeID=students[2].id   # reviews Student 3
    )
    Review.create_review(review2)
    print(f"✓ Assigned review: {students[0].name} → {students[2].name}")

    # Also assign Student 2 to review Student 3
    review3 = Review(
        assignmentID=assignment.id,
        reviewerID=students[1].id,  # Student 2
        revieweeID=students[2].id   # reviews Student 3
    )
    Review.create_review(review3)
    print(f"✓ Assigned review: {students[1].name} → {students[2].name}")

    print("\n" + "="*60)
    print("Sample data created successfully!")
    print("="*60)
    print("\nTest credentials:")
    print("-" * 60)
    print("Teacher:")
    print(f"  Email: teacher@test.com")
    print(f"  Password: password123")
    print("\nStudents:")
    for i in range(1, 5):
        print(f"  Email: student{i}@test.com")
        print(f"  Password: password123")
    print("-" * 60)
    print(f"\nCourse ID: {course.id}")
    print(f"Assignment ID: {assignment.id}")
    print(f"\nStudent 1 has 2 reviews assigned")
    print(f"Student 2 has 1 review assigned")
    print(f"Students 3 and 4 have 0 reviews assigned")
    print("\nTo test:")
    print("1. Start backend: flask run")
    print("2. Start frontend: cd frontend && npm run dev")
    print("3. Login as student1@test.com")
    print(f"4. Navigate to /assignment/{assignment.id}/reviews")
    print("5. Complete a peer review!")

