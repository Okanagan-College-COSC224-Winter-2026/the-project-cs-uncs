def test_practice_get_request(test_client):
    # Prefix (/api/v1) + Route (/practice/test)
    url = "/api/v1/practice/test" 
    
    response = test_client.get(url)
    assert response.status_code == 200