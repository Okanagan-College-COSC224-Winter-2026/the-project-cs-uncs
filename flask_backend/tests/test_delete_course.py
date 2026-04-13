"""Tests for deleting courses."""

import json

import pytest
from werkzeug.security import generate_password_hash

from api.models import Course, User
from api.models.db import db as _db


@pytest.fixture
def make_user(dbsession):
    def _make_user(role="student", email="user@example.com", password="pass", name="User"):
        user = User(
            name=name,
            email=email,
            hash_pass=generate_password_hash(password),
            role=role,
        )
        _db.session.add(user)
        _db.session.commit()
        return user

    return _make_user


def _login(test_client, email: str, password: str):
    return test_client.post(
        "/auth/login",
        data=json.dumps({"email": email, "password": password}),
        headers={"Content-Type": "application/json"},
    )


def test_teacher_can_delete_own_course(test_client, make_user):
    teacher = make_user(role="teacher", email="t@example.com", password="tpass", name="Teacher")
    _login(test_client, teacher.email, "tpass")

    resp = test_client.post(
        "/class/create_class",
        data=json.dumps({"name": "Delete Me"}),
        headers={"Content-Type": "application/json"},
    )
    class_id = resp.json["class"]["id"]

    delete_resp = test_client.delete(
        f"/class/delete_class/{class_id}",
        headers={"Content-Type": "application/json"},
    )

    assert delete_resp.status_code == 200
    assert delete_resp.json["msg"] == "Class deleted"
    assert Course.get_by_id(class_id) is None


def test_teacher_cannot_delete_other_teachers_course(test_client, make_user):
    owner = make_user(role="teacher", email="owner@example.com", password="opass", name="Owner")
    other = make_user(role="teacher", email="other@example.com", password="tpass", name="Other")

    _login(test_client, owner.email, "opass")
    resp = test_client.post(
        "/class/create_class",
        data=json.dumps({"name": "Owners Class"}),
        headers={"Content-Type": "application/json"},
    )
    class_id = resp.json["class"]["id"]

    _login(test_client, other.email, "tpass")
    delete_resp = test_client.delete(
        f"/class/delete_class/{class_id}",
        headers={"Content-Type": "application/json"},
    )

    assert delete_resp.status_code == 403
    assert "Unauthorized" in delete_resp.json["msg"]
    assert Course.get_by_id(class_id) is not None


def test_admin_can_delete_any_course(test_client, make_user):
    owner = make_user(role="teacher", email="owner@example.com", password="opass", name="Owner")
    admin = make_user(role="admin", email="admin@example.com", password="apass", name="Admin")

    _login(test_client, owner.email, "opass")
    resp = test_client.post(
        "/class/create_class",
        data=json.dumps({"name": "Admin Deletes"}),
        headers={"Content-Type": "application/json"},
    )
    class_id = resp.json["class"]["id"]

    _login(test_client, admin.email, "apass")
    delete_resp = test_client.delete(
        f"/class/delete_class/{class_id}",
        headers={"Content-Type": "application/json"},
    )

    assert delete_resp.status_code == 200
    assert Course.get_by_id(class_id) is None


def test_unauthenticated_user_cannot_delete_course(test_client, make_user):
    teacher = make_user(role="teacher", email="t@example.com", password="tpass", name="Teacher")
    _login(test_client, teacher.email, "tpass")
    resp = test_client.post(
        "/class/create_class",
        data=json.dumps({"name": "No Auth Delete"}),
        headers={"Content-Type": "application/json"},
    )
    class_id = resp.json["class"]["id"]

    # New client without cookies
    other_client = test_client.application.test_client()
    delete_resp = other_client.delete(
        f"/class/delete_class/{class_id}",
        headers={"Content-Type": "application/json"},
    )

    assert delete_resp.status_code == 401


def test_delete_nonexistent_course(test_client, make_user):
    teacher = make_user(role="teacher", email="t@example.com", password="tpass", name="Teacher")
    _login(test_client, teacher.email, "tpass")

    delete_resp = test_client.delete(
        "/class/delete_class/99999",
        headers={"Content-Type": "application/json"},
    )

    assert delete_resp.status_code == 404
    assert delete_resp.json["msg"] == "Class not found"
