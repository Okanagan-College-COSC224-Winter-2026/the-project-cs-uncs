def test_get_request(test_client):
    call = "/api/v1/practice/test"
    response = test_client.get(call)
    assert response.status_code == 200
    assert response is not None
    assert response.json["course"] == "cosc 224"