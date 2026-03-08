"""
Test the specific endpoints that are called when clicking a review
"""
from api import create_app
from api.models import User
from flask import Flask

app = create_app()

with app.test_client() as client:
    print("Testing review endpoints that are called when clicking a review card...")
    
    # Login as student1
    print("\n1. Logging in as student1@test.com")
    response = client.post('/auth/login', json={
        'email': 'student1@test.com',
        'password': 'password123'
    })
    print(f"   Login status: {response.status_code}")
    if response.status_code != 200:
        print(f"   ERROR: {response.get_json()}")
        exit(1)
    
    # Get assigned reviews to find a review ID
    print("\n2. Getting assigned reviews")
    response = client.get('/review/assigned/1')
    print(f"   Status: {response.status_code}")
    if response.status_code == 200:
        data = response.get_json()
        reviews = data.get('reviews', [])
        print(f"   Found {len(reviews)} reviews")
        if reviews:
            review_id = reviews[0]['id']
            print(f"   First review ID: {review_id}")
        else:
            print("   No reviews found!")
            exit(1)
    else:
        print(f"   ERROR: {response.get_json()}")
        exit(1)
    
    # Test getReviewDetails - GET /review/<review_id>
    print(f"\n3. Testing GET /review/{review_id} (getReviewDetails)")
    response = client.get(f'/review/{review_id}')
    print(f"   Status: {response.status_code}")
    if response.status_code == 200:
        data = response.get_json()
        print(f"   ✅ Success! Got review: {data.get('review', {}).get('id')}")
        print(f"   Criteria count: {len(data.get('criteria', []))}")
    else:
        print(f"   ❌ ERROR {response.status_code}: {response.get_json()}")
        import traceback
        traceback.print_exc()
    
    # Test getReviewSubmission - GET /review/submission/<review_id>
    print(f"\n4. Testing GET /review/submission/{review_id} (getReviewSubmission)")
    response = client.get(f'/review/submission/{review_id}')
    print(f"   Status: {response.status_code}")
    if response.status_code == 200:
        data = response.get_json()
        print(f"   ✅ Success! Got submission: {data.get('submission', {}).get('id')}")
    else:
        print(f"   ❌ ERROR {response.status_code}: {response.get_json()}")
    
    print("\n" + "="*60)
    print("Testing complete!")

