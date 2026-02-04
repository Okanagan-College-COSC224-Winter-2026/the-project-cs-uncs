import json
import os

CURRENT_DIRECTORY = os.path.dirname(os.path.abspath(__file__))


def test_practice_endpoint(test_client):
    """
    GIVEN GET /practice/test
    WHEN a GET request is made to the practice endpoint
    THEN it should return 200 with course information
    """
    response = test_client.get("/practice/test")

    # Assert status code is 200
    assert response.status_code == 200

    # Assert response is not null
    assert response.json is not None

    # Assert the value for course is present
    assert "course" in response.json
    assert response.json["course"] == "cosc 224"
