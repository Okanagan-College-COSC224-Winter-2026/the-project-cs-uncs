"""
Tests for practice endpoints
"""


def test_practice_endpoint(test_client):
    """
    GIVEN a test client
    WHEN GET /practice/test is called
    THEN the response should have status 200, contain course key, and value should be cosc 224
    """
    response = test_client.get("/practice/test")

    assert response.status_code == 200
    assert response.json is not None
    assert "course" in response.json
    assert response.json["course"] == "cosc 224"
