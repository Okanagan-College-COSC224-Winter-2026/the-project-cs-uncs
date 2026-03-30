"""Example test demonstrating Arrange-Act-Assert with the test client."""

def test_example(test_client):
    # ARRANGE - Set up test data
    user_data = {"email": "test@example.com", "password": "pass123"}

    # ACT - Perform the action
    # Ensure the test user exists (register) before attempting login
    register_resp = test_client.post(
        "/auth/register",
        json={"name": "testuser", "email": "test@example.com", "password": "pass123"},
    )
    assert register_resp.status_code == 201

    response = test_client.post("/auth/login", json=user_data)

    # ASSERT - Verify the outcome
    assert response.status_code == 200
    assert response.get_json()["role"] == "student"
