
from api import create_app
from api.models import db, Rubric, CriteriaDescription, Review, Criterion, Assignment, User

app = create_app()

with app.app_context():
    print("Setting up test feedback for student@example.com on Assignment 1...")
    
    # 1. Get/Create Assignment 1
    assignment = Assignment.query.get(1)
    if not assignment:
        print("Assignment 1 not found. Creating...")
        # Need a course first? Assuming course 1 exists from previous listing showing assignment 1 has courseID 1
        assignment = Assignment(id=1, courseID=1, name="Example Assignment", rubric_text="Test Rubric")
        db.session.add(assignment)
        db.session.commit()
    
    # 2. Get/Create Rubric
    rubric = Rubric.query.filter_by(assignmentID=assignment.id).first()
    if not rubric:
        print("Creating Rubric...")
        rubric = Rubric(assignmentID=assignment.id, canComment=True)
        db.session.add(rubric)
        db.session.commit()
    else:
        print(f"Rubric {rubric.id} already exists.")
        
    # 3. Create Criteria Descriptions if not exist
    criteria_descs = CriteriaDescription.query.filter_by(rubricID=rubric.id).all()
    if not criteria_descs:
        print("Creating Criteria Descriptions...")
        cd1 = CriteriaDescription(rubricID=rubric.id, question="Content Quality", scoreMax=10)
        cd2 = CriteriaDescription(rubricID=rubric.id, question="Clarity & Organization", scoreMax=5)
        db.session.add_all([cd1, cd2])
        db.session.commit()
        criteria_descs = [cd1, cd2]
    else:
        print(f"Found {len(criteria_descs)} existing criteria descriptions.")

    # 4. Create Review (Teacher -> Student)
    student = User.query.filter_by(email="student@example.com").first()
    teacher = User.query.filter_by(email="teacher@example.com").first()
    
    if not student or not teacher:
        print("Error: student or teacher not found")
        exit(1)
        
    review = Review.query.filter_by(
        assignmentID=assignment.id, 
        reviewerID=teacher.id, 
        revieweeID=student.id
    ).first()
    
    if not review:
        print("Creating Review...")
        review = Review(
            assignmentID=assignment.id,
            reviewerID=teacher.id,
            revieweeID=student.id,
            completed=True
        )
        db.session.add(review)
        db.session.commit()
    else:
        print(f"Review {review.id} already exists. Ensuring it is completed.")
        review.completed = True
        db.session.commit()

    # 5. Add Feedback (Criterion)
    existing_criteria = Criterion.query.filter_by(reviewID=review.id).count()
    if existing_criteria == 0:
        print("Adding feedback (Criteria scores)...")
        c1 = Criterion(
            reviewID=review.id,
            criterionRowID=criteria_descs[0].id,
            grade=9,
            comments="Excellent analysis of the topic. Well detailed."
        )
        c2 = Criterion(
            reviewID=review.id,
            criterionRowID=criteria_descs[1].id,
            grade=4,
            comments="Good structure, but could use more transitions."
        )
        db.session.add_all([c1, c2])
        db.session.commit()
        print("Feedback added.")
    else:
        print("Feedback already exists.")

    print("Success! Test data created.")

