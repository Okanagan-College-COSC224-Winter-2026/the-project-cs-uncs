"""Tests for profile photo upload/fetch."""

import io
import json

import pytest
from werkzeug.security import generate_password_hash

from api.models import User
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


def test_user_photo_upload_and_fetch(test_client, make_user):
    make_user(role="student", email="s@example.com", password="spass", name="Student")

    login_as(test_client, "s@example.com", "spass")

    # No photo yet
    resp0 = test_client.get("/user/photo")
    assert resp0.status_code == 404

    upload_resp = test_client.post(
        "/user/photo",
        data={"file": (io.BytesIO(b"fakepng"), "avatar.png")},
        content_type="multipart/form-data",
    )
    assert upload_resp.status_code == 200

    resp1 = test_client.get("/user/photo")
    assert resp1.status_code == 200
    assert resp1.data == b"fakepng"
