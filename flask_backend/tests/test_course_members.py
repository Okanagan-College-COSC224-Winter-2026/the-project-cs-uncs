"""Tests for course members endpoint."""

import json

import pytest
from werkzeug.security import generate_password_hash

from api.models import Course, User
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


def test_course_teacher_can_fetch_members(test_client, make_user, enroll_user_in_course):
    teacher = make_user(role="teacher", email="t@example.com", password="tpass", name="Teacher")
    student = make_user(role="student", email="s@example.com", password="spass", name="Student")

    course = Course(teacherID=teacher.id, name="History")
    _db.session.add(course)
    _db.session.commit()

    enroll_user_in_course(student.id, course.id)

    login_as(test_client, "t@example.com", "tpass")

    resp = test_client.post(
        "/class/members",
        data=json.dumps({"id": course.id}),
        headers={"Content-Type": "application/json"},
    )

    assert resp.status_code == 200
    assert any(m["id"] == student.id for m in resp.json)


def test_non_enrolled_student_cannot_fetch_members(test_client, make_user):
    teacher = make_user(role="teacher", email="t@example.com", password="tpass", name="Teacher")
    student = make_user(role="student", email="s@example.com", password="spass", name="Student")

    course = Course(teacherID=teacher.id, name="History")
    _db.session.add(course)
    _db.session.commit()

    login_as(test_client, "s@example.com", "spass")

    resp = test_client.post(
        "/class/members",
        data=json.dumps({"id": course.id}),
        headers={"Content-Type": "application/json"},
    )

    assert resp.status_code == 403


def test_course_teacher_can_remove_member(test_client, make_user, enroll_user_in_course):
    teacher = make_user(role="teacher", email="t@example.com", password="tpass", name="Teacher")
    student = make_user(role="student", email="s@example.com", password="spass", name="Student")

    course = Course(teacherID=teacher.id, name="History")
    _db.session.add(course)
    _db.session.commit()

    enroll_user_in_course(student.id, course.id)

    login_as(test_client, "t@example.com", "tpass")

    resp = test_client.post(
        "/class/remove_member",
        data=json.dumps({"class_id": course.id, "user_id": student.id}),
        headers={"Content-Type": "application/json"},
    )
    assert resp.status_code == 200

    members_resp = test_client.post(
        "/class/members",
        data=json.dumps({"id": course.id}),
        headers={"Content-Type": "application/json"},
    )
    assert members_resp.status_code == 200
    assert not any(m["id"] == student.id for m in members_resp.json)


def test_student_cannot_remove_member(test_client, make_user, enroll_user_in_course):
    teacher = make_user(role="teacher", email="t@example.com", password="tpass", name="Teacher")
    student = make_user(role="student", email="s@example.com", password="spass", name="Student")

    course = Course(teacherID=teacher.id, name="History")
    _db.session.add(course)
    _db.session.commit()

    enroll_user_in_course(student.id, course.id)

    login_as(test_client, "s@example.com", "spass")

    resp = test_client.post(
        "/class/remove_member",
        data=json.dumps({"class_id": course.id, "user_id": student.id}),
        headers={"Content-Type": "application/json"},
    )
    assert resp.status_code == 403
