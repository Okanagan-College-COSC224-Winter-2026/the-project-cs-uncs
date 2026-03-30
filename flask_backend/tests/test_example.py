"""Example test demonstrating Arrange-Act-Assert with the test client."""

def test_example(test_client):
    # ARRANGE - Set up test data
    user_data = {"email": "test@example.com", "password": "pass123"}

    # ACT - Perform the action
    response = test_client.post("/auth/login", json=user_data)

    # ASSERT - Verify the outcome
    assert response.status_code == 200
    assert response.get_json()["role"] == "student"
