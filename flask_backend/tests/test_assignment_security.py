"""Security-focused tests for assignment access control endpoints."""

import datetime
import json
from pathlib import Path

from werkzeug.security import generate_password_hash

from api.models import Assignment, Course, User, User_Course
from api.models.db import db as _db


def _create_user(*, name, email, password, role):
    user = User(name=name, email=email, hash_pass=generate_password_hash(password), role=role)
    _db.session.add(user)
    _db.session.commit()
    return user


def _login(client, email, password):
    return client.post(
        "/auth/login",
        data=json.dumps({"email": email, "password": password}),
        headers={"Content-Type": "application/json"},
    )


def test_non_attached_teacher_cannot_access_other_course_assignments(test_client):
    owner_teacher = _create_user(
        name="Owner Teacher",
        email="owner.teacher@example.com",
        password="owner-pass",
        role="teacher",
    )
    other_teacher = _create_user(
        name="Other Teacher",
        email="other.teacher@example.com",
        password="other-pass",
        role="teacher",
    )

    course = Course(teacherID=owner_teacher.id, name="Secure Course")
    _db.session.add(course)
    _db.session.commit()

    assignment = Assignment(
        courseID=course.id,
        name="Confidential Assignment",
        rubric_text="Rubric",
        due_date=datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None) + datetime.timedelta(days=7),
    )
    _db.session.add(assignment)
    _db.session.commit()

    _login(test_client, other_teacher.email, "other-pass")

    list_response = test_client.get(f"/assignment/{course.id}")
    assert list_response.status_code == 403

    details_response = test_client.get(f"/assignment/details/{assignment.id}")
    assert details_response.status_code == 403


def test_enrolled_student_can_access_course_assignments(test_client):
    owner_teacher = _create_user(
        name="Owner Teacher",
        email="owner2.teacher@example.com",
        password="owner-pass",
        role="teacher",
    )
    student = _create_user(
        name="Enrolled Student",
        email="enrolled.student@example.com",
        password="student-pass",
        role="student",
    )

    course = Course(teacherID=owner_teacher.id, name="Student Access Course")
    _db.session.add(course)
    _db.session.commit()

    _db.session.add(User_Course(userID=student.id, courseID=course.id))
    _db.session.add(
        Assignment(
            courseID=course.id,
            name="Visible Assignment",
            rubric_text="Rubric",
            due_date=datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None) + datetime.timedelta(days=7),
        )
    )
    _db.session.commit()

    _login(test_client, student.email, "student-pass")

    list_response = test_client.get(f"/assignment/{course.id}")
    assert list_response.status_code == 200


def test_attached_teacher_and_admin_can_download_assignment_attachment(test_client):
    owner_teacher = _create_user(
        name="Attachment Teacher",
        email="attachment.teacher@example.com",
        password="owner-pass",
        role="teacher",
    )
    admin = _create_user(
        name="Admin User",
        email="admin.attachment@example.com",
        password="admin-pass",
        role="admin",
    )

    course = Course(teacherID=owner_teacher.id, name="Attachment Course")
    _db.session.add(course)
    _db.session.commit()

    storage_name = "attachment_test.txt"
    assignment = Assignment(
        courseID=course.id,
        name="Attachment Assignment",
        rubric_text="Rubric",
        due_date=datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None) + datetime.timedelta(days=7),
        attachment_original_name="syllabus.txt",
        attachment_storage_name=storage_name,
    )
    _db.session.add(assignment)
    _db.session.commit()

    uploads_dir = Path(test_client.application.instance_path) / "uploads"
    uploads_dir.mkdir(parents=True, exist_ok=True)
    (uploads_dir / storage_name).write_bytes(b"secure assignment attachment")

    _login(test_client, owner_teacher.email, "owner-pass")
    teacher_response = test_client.get(f"/assignment/attachment/{assignment.id}")
    assert teacher_response.status_code == 200

    _login(test_client, admin.email, "admin-pass")
    admin_response = test_client.get(f"/assignment/attachment/{assignment.id}")
    assert admin_response.status_code == 200
