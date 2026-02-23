"""
Tests for voluntary password change workflow.

User Story: As a teacher, I want to change my password so that I can update my login information.

Acceptance Criteria:
- Given the teacher has a current password, when they submit a password change,
  the system updates it successfully
- Teacher receives confirmation that the password change occurred
- Updated credentials allow the teacher to log in immediately
"""

import json

import pytest
from werkzeug.security import generate_password_hash

from api.models import User


@pytest.fixture()
def create_teacher(db):
    """Fixture: create a teacher user using the test-managed DB session."""

    def _create(name="Teacher User", email="teacher@example.com", password="oldpass123"):
        user = User(
            name=name,
            email=email,
            hash_pass=generate_password_hash(password),
            role="teacher",
        )
        db.session.add(user)
        db.session.commit()
        return user

    return _create


@pytest.fixture()
def create_teacher_must_change(db):
    """Fixture: create a teacher with must_change_password=True using the test-managed DB session."""

    def _create(email="forced@example.com", password="temppass", name="Forced Teacher"):
        user = User(
            name=name,
            email=email,
            hash_pass=generate_password_hash(password),
            role="teacher",
            must_change_password=True,
        )
        db.session.add(user)
        db.session.commit()
        return user

    return _create


def _login(client, email, password):
    """Helper: log in and return the response (cookie is auto-stored)."""
    return client.post(
        "/auth/login",
        data=json.dumps({"email": email, "password": password}),
        headers={"Content-Type": "application/json"},
    )


# ── Happy-path tests ────────────────────────────────────────────


def test_teacher_can_change_password(test_client, create_teacher):
    """
    GIVEN a teacher with a current password
    WHEN they submit a valid password change (current + new password)
    THEN the system updates the password and returns a confirmation message
    """
    create_teacher()
    _login(test_client, "teacher@example.com", "oldpass123")

    response = test_client.patch(
        "/user/password",
        data=json.dumps({
            "current_password": "oldpass123",
            "new_password": "newpass456",
        }),
        headers={"Content-Type": "application/json"},
    )

    assert response.status_code == 200
    assert response.json["msg"] == "Password updated successfully"


def test_teacher_can_login_with_new_password(test_client, create_teacher):
    """
    GIVEN a teacher who has successfully changed their password
    WHEN they log in with the new password
    THEN authentication succeeds
    """
    create_teacher()
    _login(test_client, "teacher@example.com", "oldpass123")

    # Change password
    test_client.patch(
        "/user/password",
        data=json.dumps({
            "current_password": "oldpass123",
            "new_password": "newpass456",
        }),
        headers={"Content-Type": "application/json"},
    )

    # Log out, then log in with the NEW password
    test_client.post("/auth/logout")

    login_resp = _login(test_client, "teacher@example.com", "newpass456")
    assert login_resp.status_code == 200
    assert login_resp.json["role"] == "teacher"


def test_old_password_no_longer_works_after_change(test_client, create_teacher):
    """
    GIVEN a teacher who has changed their password
    WHEN they attempt to log in with the OLD password
    THEN authentication fails
    """
    create_teacher()
    _login(test_client, "teacher@example.com", "oldpass123")

    test_client.patch(
        "/user/password",
        data=json.dumps({
            "current_password": "oldpass123",
            "new_password": "newpass456",
        }),
        headers={"Content-Type": "application/json"},
    )

    test_client.post("/auth/logout")

    login_resp = _login(test_client, "teacher@example.com", "oldpass123")
    assert login_resp.status_code == 401


def test_teacher_without_must_change_flag_can_still_change(test_client, create_teacher):
    """
    GIVEN a teacher whose must_change_password flag is False (voluntary change)
    WHEN they submit a valid password change
    THEN the system allows it (not restricted to forced changes only)
    """
    teacher = create_teacher()
    assert teacher.must_change_password is False  # Precondition

    _login(test_client, "teacher@example.com", "oldpass123")

    response = test_client.patch(
        "/user/password",
        data=json.dumps({
            "current_password": "oldpass123",
            "new_password": "newpass456",
        }),
        headers={"Content-Type": "application/json"},
    )

    assert response.status_code == 200
    assert response.json["msg"] == "Password updated successfully"


# ── Validation / error tests ────────────────────────────────────


def test_change_password_wrong_current_password(test_client, create_teacher):
    """
    GIVEN a teacher attempting to change their password
    WHEN the current password is incorrect
    THEN the system returns 401
    """
    create_teacher()
    _login(test_client, "teacher@example.com", "oldpass123")

    response = test_client.patch(
        "/user/password",
        data=json.dumps({
            "current_password": "WRONG",
            "new_password": "newpass456",
        }),
        headers={"Content-Type": "application/json"},
    )

    assert response.status_code == 401
    assert response.json["msg"] == "Current password is incorrect"


def test_change_password_missing_current_password(test_client, create_teacher):
    """
    GIVEN a teacher attempting to change their password
    WHEN the current password field is missing
    THEN the system returns 400
    """
    create_teacher()
    _login(test_client, "teacher@example.com", "oldpass123")

    response = test_client.patch(
        "/user/password",
        data=json.dumps({"new_password": "newpass456"}),
        headers={"Content-Type": "application/json"},
    )

    assert response.status_code == 400
    assert "Current password is required" in response.json["msg"]


def test_change_password_missing_new_password(test_client, create_teacher):
    """
    GIVEN a teacher attempting to change their password
    WHEN the new password field is missing
    THEN the system returns 400
    """
    create_teacher()
    _login(test_client, "teacher@example.com", "oldpass123")

    response = test_client.patch(
        "/user/password",
        data=json.dumps({"current_password": "oldpass123"}),
        headers={"Content-Type": "application/json"},
    )

    assert response.status_code == 400
    assert "New password is required" in response.json["msg"]


def test_change_password_too_short(test_client, create_teacher):
    """
    GIVEN a teacher attempting to change their password
    WHEN the new password is shorter than 6 characters
    THEN the system returns 400
    """
    create_teacher()
    _login(test_client, "teacher@example.com", "oldpass123")

    response = test_client.patch(
        "/user/password",
        data=json.dumps({
            "current_password": "oldpass123",
            "new_password": "abc",
        }),
        headers={"Content-Type": "application/json"},
    )

    assert response.status_code == 400
    assert "at least 6 characters" in response.json["msg"]


def test_change_password_requires_authentication(test_client):
    """
    GIVEN no authentication
    WHEN a password change request is made
    THEN the system returns 401
    """
    response = test_client.patch(
        "/user/password",
        data=json.dumps({
            "current_password": "oldpass123",
            "new_password": "newpass456",
        }),
        headers={"Content-Type": "application/json"},
    )

    assert response.status_code == 401


def test_change_password_requires_json(test_client, create_teacher):
    """
    GIVEN a logged-in teacher
    WHEN a password change request is made without JSON content type
    THEN the system returns 400
    """
    create_teacher()
    _login(test_client, "teacher@example.com", "oldpass123")

    response = test_client.patch("/user/password")

    assert response.status_code == 400


# ── Other roles can also change passwords ────────────────────────


def test_student_can_also_change_password(test_client):
    """
    GIVEN a student user (password change is not role-restricted)
    WHEN they submit a valid password change
    THEN the system allows it
    """
    # Register creates a student
    test_client.post(
        "/auth/register",
        data=json.dumps({
            "name": "Student User",
            "password": "oldpass123",
            "email": "student@example.com",
        }),
        headers={"Content-Type": "application/json"},
    )
    _login(test_client, "student@example.com", "oldpass123")

    response = test_client.patch(
        "/user/password",
        data=json.dumps({
            "current_password": "oldpass123",
            "new_password": "newpass456",
        }),
        headers={"Content-Type": "application/json"},
    )

    assert response.status_code == 200
    assert response.json["msg"] == "Password updated successfully"


def test_forced_password_change_still_works(test_client, db):
    """
    GIVEN a teacher with must_change_password=True (admin-created account)
    WHEN they change their password
    THEN the must_change_password flag is cleared
    """
    user = User(
        name="New Teacher",
        email="newteacher@example.com",
        hash_pass=generate_password_hash("temppass"),
        role="teacher",
        must_change_password=True,
    )
    db.session.add(user)
    db.session.commit()

    _login(test_client, "newteacher@example.com", "temppass")

    response = test_client.patch(
        "/user/password",
        data=json.dumps({
            "current_password": "temppass",
            "new_password": "permanent123",
        }),
        headers={"Content-Type": "application/json"},
    )

    assert response.status_code == 200

    # Verify must_change_password flag is now False
    updated_user = User.get_by_email("newteacher@example.com")
    assert updated_user.must_change_password is False


# ── Enforcement: must_change_password blocks other actions ───────


def test_must_change_blocks_create_class(test_client, create_teacher_must_change):
    """
    GIVEN a teacher who has not changed their temporary password
    WHEN they try to create a class
    THEN the system rejects with 403 and a password-change-required message
    """
    create_teacher_must_change()
    _login(test_client, "forced@example.com", "temppass")

    response = test_client.post(
        "/class/create_class",
        data=json.dumps({"name": "My Class"}),
        headers={"Content-Type": "application/json"},
    )

    assert response.status_code == 403
    assert "password" in response.json["msg"].lower()


def test_must_change_blocks_list_classes(test_client, create_teacher_must_change):
    """
    GIVEN a teacher who has not changed their temporary password
    WHEN they try to list classes
    THEN the system rejects with 403
    """
    create_teacher_must_change()
    _login(test_client, "forced@example.com", "temppass")

    response = test_client.get("/class/classes")

    assert response.status_code == 403
    assert "password" in response.json["msg"].lower()


def test_must_change_allows_get_current_user(test_client, create_teacher_must_change):
    """
    GIVEN a teacher who has not changed their temporary password
    WHEN they fetch their own user info (GET /user/)
    THEN the system allows it (needed by frontend to detect the flag)
    """
    create_teacher_must_change()
    _login(test_client, "forced@example.com", "temppass")

    response = test_client.get("/user/")

    assert response.status_code == 200
    assert response.json["must_change_password"] is True


def test_must_change_allows_change_password(test_client, create_teacher_must_change):
    """
    GIVEN a teacher who has not changed their temporary password
    WHEN they submit a password change
    THEN the system allows it
    """
    create_teacher_must_change()
    _login(test_client, "forced@example.com", "temppass")

    response = test_client.patch(
        "/user/password",
        data=json.dumps({
            "current_password": "temppass",
            "new_password": "newperm123",
        }),
        headers={"Content-Type": "application/json"},
    )

    assert response.status_code == 200


def test_must_change_allows_logout(test_client, create_teacher_must_change):
    """
    GIVEN a teacher who has not changed their temporary password
    WHEN they log out
    THEN the system allows it
    """
    create_teacher_must_change()
    _login(test_client, "forced@example.com", "temppass")

    response = test_client.post("/auth/logout")

    assert response.status_code == 200


def test_after_changing_password_endpoints_unblocked(test_client, create_teacher_must_change):
    """
    GIVEN a teacher who changes their temporary password
    WHEN they subsequently try to create a class
    THEN the system allows it (no longer blocked)
    """
    create_teacher_must_change()
    _login(test_client, "forced@example.com", "temppass")

    # Change password first
    test_client.patch(
        "/user/password",
        data=json.dumps({
            "current_password": "temppass",
            "new_password": "newperm123",
        }),
        headers={"Content-Type": "application/json"},
    )

    # Now create a class — should succeed
    response = test_client.post(
        "/class/create_class",
        data=json.dumps({"name": "My Class"}),
        headers={"Content-Type": "application/json"},
    )

    assert response.status_code == 201

