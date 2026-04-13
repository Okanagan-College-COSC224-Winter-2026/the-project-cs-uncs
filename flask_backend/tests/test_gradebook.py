"""Tests for gradebook endpoints: GET /class/<id>/gradebook and PATCH /class/<id>/gradebook/<student_id>/<assignment_id>."""

import json
import pytest
from werkzeug.security import generate_password_hash

from api.models import Assignment, Course, Submission, User, User_Course
from api.models.db import db as _db


def login_as(client, email, password):
    return client.post(
        "/auth/login",
        data=json.dumps({"email": email, "password": password}),
        headers={"Content-Type": "application/json"},
    )


@pytest.fixture
def make_user():
    def _make_user(role="student", email="user@example.com", password="pass", name="User"):
        user = User(name=name, email=email, hash_pass=generate_password_hash(password), role=role)
        _db.session.add(user)
        _db.session.commit()
        return user

    return _make_user


@pytest.fixture
def make_course():
    def _make_course(teacher_id, name="Course 1"):
        course = Course(teacherID=teacher_id, name=name)
        _db.session.add(course)
        _db.session.commit()
        return course

    return _make_course


@pytest.fixture
def make_assignment():
    def _make_assignment(course_id, name="Assignment 1"):
        assignment = Assignment(
            courseID=course_id,
            name=name,
            rubric_text=None,
            assignment_type="standard",
        )
        _db.session.add(assignment)
        _db.session.commit()
        return assignment

    return _make_assignment


def test_teacher_can_get_gradebook(test_client, make_user, make_course, make_assignment, enroll_user_in_course):
    teacher = make_user(role="teacher", email="t@example.com", password="tpass", name="Teacher")
    student = make_user(role="student", email="s@example.com", password="spass", name="Student")
    course = make_course(teacher_id=teacher.id)
    assignment = make_assignment(course_id=course.id)
    enroll_user_in_course(student.id, course.id)

    login_as(test_client, "t@example.com", "tpass")
    resp = test_client.get(f"/class/{course.id}/gradebook")
    assert resp.status_code == 200
    data = resp.json
    assert "assignments" in data
    assert "rows" in data
    assert len(data["assignments"]) == 1
    assert data["assignments"][0]["id"] == assignment.id
    assert len(data["rows"]) == 1
    assert data["rows"][0]["student"]["id"] == student.id
    assert data["rows"][0]["grades"][str(assignment.id)] is None


def test_gradebook_shows_existing_grade(test_client, make_user, make_course, make_assignment, enroll_user_in_course):
    teacher = make_user(role="teacher", email="t@example.com", password="tpass", name="Teacher")
    student = make_user(role="student", email="s@example.com", password="spass", name="Student")
    course = make_course(teacher_id=teacher.id)
    assignment = make_assignment(course_id=course.id)
    enroll_user_in_course(student.id, course.id)

    # Create a submission with a grade
    submission = Submission(path=None, studentID=student.id, assignmentID=assignment.id)
    submission.grade = 85.0
    _db.session.add(submission)
    _db.session.commit()

    login_as(test_client, "t@example.com", "tpass")
    resp = test_client.get(f"/class/{course.id}/gradebook")
    assert resp.status_code == 200
    assert resp.json["rows"][0]["grades"][str(assignment.id)] == 85.0


def test_teacher_can_update_grade(test_client, make_user, make_course, make_assignment, enroll_user_in_course):
    teacher = make_user(role="teacher", email="t@example.com", password="tpass", name="Teacher")
    student = make_user(role="student", email="s@example.com", password="spass", name="Student")
    course = make_course(teacher_id=teacher.id)
    assignment = make_assignment(course_id=course.id)
    enroll_user_in_course(student.id, course.id)

    login_as(test_client, "t@example.com", "tpass")
    resp = test_client.patch(
        f"/class/{course.id}/gradebook/{student.id}/{assignment.id}",
        data=json.dumps({"grade": 92.5}),
        headers={"Content-Type": "application/json"},
    )
    assert resp.status_code == 200
    assert resp.json["grade"] == 92.5

    # Confirm it shows in gradebook
    gb_resp = test_client.get(f"/class/{course.id}/gradebook")
    assert gb_resp.json["rows"][0]["grades"][str(assignment.id)] == 92.5


def test_teacher_can_clear_grade(test_client, make_user, make_course, make_assignment, enroll_user_in_course):
    teacher = make_user(role="teacher", email="t@example.com", password="tpass", name="Teacher")
    student = make_user(role="student", email="s@example.com", password="spass", name="Student")
    course = make_course(teacher_id=teacher.id)
    assignment = make_assignment(course_id=course.id)
    enroll_user_in_course(student.id, course.id)

    # Set grade first
    login_as(test_client, "t@example.com", "tpass")
    test_client.patch(
        f"/class/{course.id}/gradebook/{student.id}/{assignment.id}",
        data=json.dumps({"grade": 75.0}),
        headers={"Content-Type": "application/json"},
    )

    # Clear the grade
    resp = test_client.patch(
        f"/class/{course.id}/gradebook/{student.id}/{assignment.id}",
        data=json.dumps({"grade": None}),
        headers={"Content-Type": "application/json"},
    )
    assert resp.status_code == 200
    assert resp.json["grade"] is None


def test_student_cannot_access_gradebook(test_client, make_user, make_course, enroll_user_in_course):
    teacher = make_user(role="teacher", email="t@example.com", password="tpass", name="Teacher")
    student = make_user(role="student", email="s@example.com", password="spass", name="Student")
    course = make_course(teacher_id=teacher.id)
    enroll_user_in_course(student.id, course.id)

    login_as(test_client, "s@example.com", "spass")
    resp = test_client.get(f"/class/{course.id}/gradebook")
    assert resp.status_code == 403


def test_student_cannot_update_grade(test_client, make_user, make_course, make_assignment, enroll_user_in_course):
    teacher = make_user(role="teacher", email="t@example.com", password="tpass", name="Teacher")
    student = make_user(role="student", email="s@example.com", password="spass", name="Student")
    course = make_course(teacher_id=teacher.id)
    assignment = make_assignment(course_id=course.id)
    enroll_user_in_course(student.id, course.id)

    login_as(test_client, "s@example.com", "spass")
    resp = test_client.patch(
        f"/class/{course.id}/gradebook/{student.id}/{assignment.id}",
        data=json.dumps({"grade": 100}),
        headers={"Content-Type": "application/json"},
    )
    assert resp.status_code == 403


def test_update_grade_negative_rejected(test_client, make_user, make_course, make_assignment, enroll_user_in_course):
    teacher = make_user(role="teacher", email="t@example.com", password="tpass", name="Teacher")
    student = make_user(role="student", email="s@example.com", password="spass", name="Student")
    course = make_course(teacher_id=teacher.id)
    assignment = make_assignment(course_id=course.id)
    enroll_user_in_course(student.id, course.id)

    login_as(test_client, "t@example.com", "tpass")
    resp = test_client.patch(
        f"/class/{course.id}/gradebook/{student.id}/{assignment.id}",
        data=json.dumps({"grade": -5}),
        headers={"Content-Type": "application/json"},
    )
    assert resp.status_code == 400


def test_other_teacher_cannot_access_gradebook(test_client, make_user, make_course, enroll_user_in_course):
    teacher1 = make_user(role="teacher", email="t1@example.com", password="t1pass", name="Teacher1")
    teacher2 = make_user(role="teacher", email="t2@example.com", password="t2pass", name="Teacher2")
    course = make_course(teacher_id=teacher1.id)

    login_as(test_client, "t2@example.com", "t2pass")
    resp = test_client.get(f"/class/{course.id}/gradebook")
    assert resp.status_code == 403
