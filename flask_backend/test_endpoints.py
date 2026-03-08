"""
Test the review endpoints directly to see the actual error
"""
import sys
from api import create_app
from api.models import User, Review

app = create_app()

with app.app_context():
    print("Testing review endpoints...")

    # Test 1: Get reviews for student 1 on assignment 1
    print("\n1. Testing GET /review/assigned/1")
    student1 = User.get_by_email("student1@test.com")
    if student1:
        print(f"   Student 1 ID: {student1.id}")
        reviews = Review.get_by_reviewer_and_assignment(student1.id, 1)
        print(f"   Found {len(reviews)} reviews")
        for review in reviews:
            print(f"   - Review {review.id}: reviewer={review.reviewerID}, reviewee={review.revieweeID}")
    else:
        print("   ERROR: Student 1 not found!")

    # Test 2: Get review details
    if reviews:
        print(f"\n2. Testing GET /review/{reviews[0].id}")
        review = Review.get_by_id_with_relations(reviews[0].id)
        if review:
            print(f"   Review loaded: {review}")
            print(f"   Assignment: {review.assignment.name if review.assignment else 'None'}")
            print(f"   Reviewer: {review.reviewer.name if review.reviewer else 'None'}")
            print(f"   Reviewee: {review.reviewee.name if review.reviewee else 'None'}")
        else:
            print("   ERROR: Review not found!")

    # Test 3: Get criteria for assignment
    print("\n3. Testing GET /review/criteria/1")
    from api.models import Rubric, CriteriaDescription
    rubric = Rubric.query.filter_by(assignmentID=1).first()
    if rubric:
        print(f"   Rubric ID: {rubric.id}")
        criteria = CriteriaDescription.query.filter_by(rubricID=rubric.id).all()
        print(f"   Found {len(criteria)} criteria:")
        for crit in criteria:
            print(f"   - {crit.question[:50]}... (max: {crit.scoreMax})")
    else:
        print("   ERROR: No rubric found for assignment 1!")

    # Test 4: Try serializing criteria
    print("\n4. Testing CriteriaDescriptionSchema serialization")
    try:
        from api.models.schemas import CriteriaDescriptionSchema
        schema = CriteriaDescriptionSchema(many=True)
        result = schema.dump(criteria)
        print(f"   Serialization successful! Got {len(result)} items")
        if result:
            print(f"   Sample: {result[0]}")
    except Exception as e:
        print(f"   ERROR: {e}")
        import traceback
        traceback.print_exc()

    print("\n✅ All tests completed!")

