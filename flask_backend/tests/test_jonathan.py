"""
Test for Jonathan's 224 lab
"""

import json

def test_practice_endpoint(test_client):
    response = test_client.get("/practice/test")

    assert response.status_code == 200

    assert response.data is not None
    assert response.json is not None
    assert "course" in response.json
    assert response.json["course"] == "cosc 224"
