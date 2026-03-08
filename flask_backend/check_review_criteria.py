"""
Test if criteria are saved and retrieved after review submission
"""
from api import create_app
from api.models import Review, Criterion

app = create_app()

with app.app_context():
    print("Checking reviews and their criteria...")
    print("=" * 60)

    reviews = Review.query.all()
    print(f"Total reviews in database: {len(reviews)}")

    for review in reviews:
        print(f"\nReview ID: {review.id}")
        print(f"  Reviewer ID: {review.reviewerID}")
        print(f"  Reviewee ID: {review.revieweeID}")
        print(f"  Assignment ID: {review.assignmentID}")
        print(f"  Completed: {review.completed}")

        criteria = Criterion.query.filter_by(reviewID=review.id).all()
        print(f"  Criteria count: {len(criteria)}")

        if criteria:
            for crit in criteria:
                print(f"    - Criterion Row ID: {crit.criterionRowID}, Grade: {crit.grade}, Comments: {crit.comments[:50] if crit.comments else 'None'}...")
        else:
            print(f"    (No criteria saved for this review)")

    print("\n" + "=" * 60)

