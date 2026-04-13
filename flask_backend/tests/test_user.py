"""
Tests for user management endpoints
"""

import json


def test_get_current_user(test_client):
    """
    GIVEN a logged-in user
    WHEN GET /user/ is called
    THEN the current user's information should be returned
    """
    # Register and login
    test_client.post(
        "/auth/register",
        data=json.dumps({"name": "testuser", "password": "123456", "email": "test@example.com"}),
        headers={"Content-Type": "application/json"},
    )

    test_client.post(
        "/auth/login",
        data=json.dumps({"email": "test@example.com", "password": "123456"}),
        headers={"Content-Type": "application/json"},
    )
    # Cookie is automatically stored in test_client

    # Get current user
    response = test_client.get("/user/")

    assert response.status_code == 200
    assert response.json["name"] == "testuser"
    assert response.json["email"] == "test@example.com"
    assert response.json["id"] is not None
    assert response.json["role"] == "student"  # Default role
    assert response.json["preferred_name"] == "testuser"  # Defaults to name
    assert response.json["preferred_pronouns"] == "Not specified"
    assert "password" not in response.json  # Password should not be exposed


def test_get_current_user_unauthorized(test_client):
    """
    GIVEN no authentication token
    WHEN GET /user/ is called
    THEN it should return 401
    """
    response = test_client.get("/user/")
    assert response.status_code == 401


def test_update_current_user(test_client):
    """
    GIVEN a logged-in user
    WHEN PUT /user/ is called with updated information
    THEN the user's information should be updated
    """
    # Register and login
    test_client.post(
        "/auth/register",
        data=json.dumps({"name": "testuser", "password": "123456", "email": "test@example.com"}),
        headers={"Content-Type": "application/json"},
    )

    test_client.post(
        "/auth/login",
        data=json.dumps({"email": "test@example.com", "password": "123456"}),
        headers={"Content-Type": "application/json"},
    )
    # Cookie is automatically stored in test_client

    # Update user name
    response = test_client.put(
        "/user/", data=json.dumps({"name": "Updated"}), headers={"Content-Type": "application/json"}
    )

    assert response.status_code == 200
    assert response.json["name"] == "Updated"


def test_update_current_user_preferred_fields(test_client):
    """Users can update preferred name and preferred pronouns."""
    test_client.post(
        "/auth/register",
        data=json.dumps({"name": "testuser", "password": "123456", "email": "test@example.com"}),
        headers={"Content-Type": "application/json"},
    )
    test_client.post(
        "/auth/login",
        data=json.dumps({"email": "test@example.com", "password": "123456"}),
        headers={"Content-Type": "application/json"},
    )

    response = test_client.put(
        "/user/",
        data=json.dumps({"preferred_name": "Alex", "preferred_pronouns": "they/them"}),
        headers={"Content-Type": "application/json"},
    )

    assert response.status_code == 200
    assert response.json["preferred_name"] == "Alex"
    assert response.json["preferred_pronouns"] == "they/them"

    verify = test_client.get("/user/")
    assert verify.status_code == 200
    assert verify.json["preferred_name"] == "Alex"
    assert verify.json["preferred_pronouns"] == "they/them"


def test_update_current_user_email_reissues_jwt(test_client):
    """
    GIVEN a logged-in user
    WHEN PUT /user/ is called with a new email
    THEN the email should update and future authenticated requests should still succeed
    (JWT identity is the email, so the access cookie must be reissued).
    """
    test_client.post(
        "/auth/register",
        data=json.dumps({"name": "testuser", "password": "123456", "email": "test@example.com"}),
        headers={"Content-Type": "application/json"},
    )

    test_client.post(
        "/auth/login",
        data=json.dumps({"email": "test@example.com", "password": "123456"}),
        headers={"Content-Type": "application/json"},
    )

    response = test_client.put(
        "/user/",
        data=json.dumps({"email": "updated@example.com"}),
        headers={"Content-Type": "application/json"},
    )

    assert response.status_code == 200
    assert response.json["email"] == "updated@example.com"

    # Should still be authenticated and resolve the user by new email identity
    verify = test_client.get("/user/")
    assert verify.status_code == 200
    assert verify.json["email"] == "updated@example.com"


def test_get_user_by_id(test_client):
    """
    GIVEN a logged-in user
    WHEN GET /user/<id> is called with their own ID
    THEN their information should be returned
    """
    # Register and login
    test_client.post(
        "/auth/register",
        data=json.dumps({"name": "testuser", "password": "123456", "email": "test@example.com"}),
        headers={"Content-Type": "application/json"},
    )

    test_client.post(
        "/auth/login",
        data=json.dumps({"email": "test@example.com", "password": "123456"}),
        headers={"Content-Type": "application/json"},
    )
    # Cookie is automatically stored in test_client

    # Get current user to get ID
    current_user_response = test_client.get("/user/")
    user_id = current_user_response.json["id"]

    # Get user by ID
    response = test_client.get(f"/user/{user_id}")

    assert response.status_code == 200
    assert response.json["id"] == user_id
    assert response.json["name"] == "testuser"


def test_get_other_user_by_id_forbidden(test_client):
    """
    GIVEN two users, one logged in
    WHEN the logged-in user tries to access another user's information
    THEN it should return 403 (unless admin)
    """
    # Register two users
    test_client.post(
        "/auth/register",
        data=json.dumps({"name": "user1", "password": "123456", "email": "user1@example.com"}),
        headers={"Content-Type": "application/json"},
    )

    test_client.post(
        "/auth/register",
        data=json.dumps({"name": "user2", "password": "123456", "email": "user2@example.com"}),
        headers={"Content-Type": "application/json"},
    )

    # Login as user1
    test_client.post(
        "/auth/login",
        data=json.dumps({"email": "user1@example.com", "password": "123456"}),
        headers={"Content-Type": "application/json"},
    )
    # Cookie is automatically stored in test_client

    # Try to access user2's info (assuming user2 has ID 2)
    # Since we don't know the exact ID, we'll try ID 2
    response = test_client.get("/user/2")

    # Should be forbidden (403) since user1 is not admin and trying to access user2
    assert response.status_code in [403, 404]  # 404 if user2 is not ID 2


def test_delete_own_user(test_client):
    """
    GIVEN a logged-in user
    WHEN DELETE /user/<own_id> is called
    THEN the user should be deleted
    """
    # Register and login
    test_client.post(
        "/auth/register",
        data=json.dumps({"name": "testuser", "password": "123456", "email": "test@example.com"}),
        headers={"Content-Type": "application/json"},
    )

    test_client.post(
        "/auth/login",
        data=json.dumps({"email": "test@example.com", "password": "123456"}),
        headers={"Content-Type": "application/json"},
    )
    # Cookie is automatically stored in test_client

    # Get current user to get ID
    current_user_response = test_client.get("/user/")
    user_id = current_user_response.json["id"]

    # Delete user
    response = test_client.delete(f"/user/{user_id}")

    assert response.status_code == 200
    assert response.json["msg"] == "User deleted successfully"

    # Verify user is deleted by trying to get info
    verify_response = test_client.get("/user/")
    assert verify_response.status_code == 404
