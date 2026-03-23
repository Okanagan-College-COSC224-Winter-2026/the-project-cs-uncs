import json
import os

CURRENT_DIRECTORY = os.path.dirname(os.path.abspath(__file__))


def test_register(test_client):
    """
    GIVEN POST /auth/register
    WHEN a username and password are provided
    THEN a new user should be created
    """
    response = test_client.post(
        "/auth/register",
        data=json.dumps({"name": "testuser", "password": "123456", "email": "test@example.com"}),
        headers={"Content-Type": "application/json"},
    )
    assert response.status_code == 201
    assert response.json["msg"] == "User registered successfully"


def test_register_duplicate(test_client):
    """
    GIVEN POST /auth/register
    WHEN registering a user that already exists
    THEN it should return an error
    """
    # Create first user
    test_client.post(
        "/auth/register",
        data=json.dumps({"name": "testuser", "password": "123456", "email": "test@example.com"}),
        headers={"Content-Type": "application/json"},
    )

    # Try to create duplicate
    response = test_client.post(
        "/auth/register",
        data=json.dumps({"name": "testuser", "password": "123456", "email": "test@example.com"}),
        headers={"Content-Type": "application/json"},
    )
    assert response.status_code == 400
    assert "already registered" in response.json["msg"]


def test_login(test_client):
    """
    GIVEN POST /auth/login
    WHEN valid credentials are provided
    THEN a JWT cookie should be set and user info returned
    """
    # First register a user
    test_client.post(
        "/auth/register",
        data=json.dumps({"name": "example", "password": "123456", "email": "example@example.com"}),
        headers={"Content-Type": "application/json"},
    )

    # Then login
    token_request = test_client.post(
        "/auth/login",
        data=json.dumps({"email": "example@example.com", "password": "123456"}),
        headers={"Content-Type": "application/json"},
    )
    assert token_request.status_code == 200
    # Should NOT return access_token in JSON anymore
    assert "access_token" not in token_request.json
    # Should return user info
    assert token_request.json["role"] == "student"
    assert token_request.json["name"] == "example"
    # Should set a cookie
    assert "Set-Cookie" in token_request.headers


def test_login_invalid_credentials(test_client):
    """
    GIVEN POST /auth/login
    WHEN invalid credentials are provided
    THEN it should return 401
    """
    response = test_client.post(
        "/auth/login",
        data=json.dumps({"email": "nonexistent@example.com", "password": "wrong"}),
        headers={"Content-Type": "application/json"},
    )
    assert response.status_code == 401
    assert response.json["msg"] == "Bad email or password"


def test_logout(test_client):
    """
    GIVEN POST /auth/logout with valid JWT cookie
    WHEN the logout endpoint is called
    THEN it should return success and clear the cookie
    """
    # Register and login first
    test_client.post(
        "/auth/register",
        data=json.dumps({"name": "example", "password": "123456", "email": "example@example.com"}),
        headers={"Content-Type": "application/json"},
    )

    test_client.post(
        "/auth/login",
        data=json.dumps({"email": "example@example.com", "password": "123456"}),
        headers={"Content-Type": "application/json"},
    )
    # Cookie is automatically stored in test_client

    # Logout
    response = test_client.post("/auth/logout")
    assert response.status_code == 200
    assert response.json["msg"] == "Successfully logged out"
    # Should clear the cookie
    assert "Set-Cookie" in response.headers


def test_login_rate_limited_after_repeated_failures(test_client):
    """Repeated failed login attempts should trigger a temporary lockout."""
    config = test_client.application.config
    had_max_attempts = "AUTH_LOGIN_MAX_ATTEMPTS" in config
    prev_max_attempts = config.get("AUTH_LOGIN_MAX_ATTEMPTS")
    had_window_seconds = "AUTH_LOGIN_WINDOW_SECONDS" in config
    prev_window_seconds = config.get("AUTH_LOGIN_WINDOW_SECONDS")
    had_lockout_seconds = "AUTH_LOGIN_LOCKOUT_SECONDS" in config
    prev_lockout_seconds = config.get("AUTH_LOGIN_LOCKOUT_SECONDS")

    config["AUTH_LOGIN_MAX_ATTEMPTS"] = 3
    config["AUTH_LOGIN_WINDOW_SECONDS"] = 60
    config["AUTH_LOGIN_LOCKOUT_SECONDS"] = 120

    try:
        test_client.post(
            "/auth/register",
            data=json.dumps({"name": "ratelimit", "password": "123456", "email": "ratelimit@example.com"}),
            headers={"Content-Type": "application/json"},
        )

        for _ in range(2):
            response = test_client.post(
                "/auth/login",
                data=json.dumps({"email": "ratelimit@example.com", "password": "wrong-password"}),
                headers={"Content-Type": "application/json"},
            )
            assert response.status_code == 401

        third = test_client.post(
            "/auth/login",
            data=json.dumps({"email": "ratelimit@example.com", "password": "wrong-password"}),
            headers={"Content-Type": "application/json"},
        )
        assert third.status_code == 429
        assert "retry_after_seconds" in third.json

        blocked = test_client.post(
            "/auth/login",
            data=json.dumps({"email": "ratelimit@example.com", "password": "123456"}),
            headers={"Content-Type": "application/json"},
        )
        assert blocked.status_code == 429
    finally:
        if had_max_attempts:
            config["AUTH_LOGIN_MAX_ATTEMPTS"] = prev_max_attempts
        else:
            config.pop("AUTH_LOGIN_MAX_ATTEMPTS", None)

        if had_window_seconds:
            config["AUTH_LOGIN_WINDOW_SECONDS"] = prev_window_seconds
        else:
            config.pop("AUTH_LOGIN_WINDOW_SECONDS", None)

        if had_lockout_seconds:
            config["AUTH_LOGIN_LOCKOUT_SECONDS"] = prev_lockout_seconds
        else:
            config.pop("AUTH_LOGIN_LOCKOUT_SECONDS", None)
