"""
Add a sample rubric with criteria to the assignment for testing peer reviews.
"""

from api import create_app
from api.models import Assignment, Rubric, CriteriaDescription
from api.models.db import db

app = create_app()

with app.app_context():
    print("Adding sample rubric to assignment...")

    # Get the assignment
    assignment = Assignment.get_by_id(1)
    if not assignment:
        print("❌ Assignment not found!")
        exit(1)

    print(f"✓ Found assignment: {assignment.name}")

    # Check if rubric already exists
    existing_rubric = Rubric.query.filter_by(assignmentID=assignment.id).first()
    if existing_rubric:
        print(f"✓ Rubric already exists (ID: {existing_rubric.id})")
        rubric = existing_rubric
    else:
        # Create rubric
        rubric = Rubric(assignmentID=assignment.id, canComment=True)
        db.session.add(rubric)
        db.session.commit()
        print(f"✓ Created rubric (ID: {rubric.id})")

    # Check if criteria already exist
    existing_criteria = CriteriaDescription.query.filter_by(rubricID=rubric.id).all()
    if existing_criteria:
        print(f"✓ Rubric already has {len(existing_criteria)} criteria")
        for crit in existing_criteria:
            print(f"  - {crit.question} (max: {crit.scoreMax})")
    else:
        # Add sample criteria
        criteria_list = [
            {
                "question": "Content Quality - Does the work demonstrate understanding of the topic?",
                "scoreMax": 10,
                "hasScore": True
            },
            {
                "question": "Organization - Is the work well-structured and logical?",
                "scoreMax": 10,
                "hasScore": True
            },
            {
                "question": "Clarity - Is the writing clear and easy to understand?",
                "scoreMax": 10,
                "hasScore": True
            },
            {
                "question": "Completeness - Does the work address all requirements?",
                "scoreMax": 10,
                "hasScore": True
            },
            {
                "question": "Overall Impression - What is your overall assessment?",
                "scoreMax": 10,
                "hasScore": True
            }
        ]

        for crit_data in criteria_list:
            criterion = CriteriaDescription(
                rubricID=rubric.id,
                question=crit_data["question"],
                scoreMax=crit_data["scoreMax"],
                hasScore=crit_data["hasScore"]
            )
            db.session.add(criterion)

        db.session.commit()
        print(f"✓ Added {len(criteria_list)} criteria to rubric")

        for crit_data in criteria_list:
            print(f"  - {crit_data['question']}")

    print("\n" + "="*60)
    print("Rubric setup complete!")
    print("="*60)
    print(f"\nRubric ID: {rubric.id}")
    print(f"Assignment ID: {assignment.id}")
    print(f"Number of criteria: {len(CriteriaDescription.query.filter_by(rubricID=rubric.id).all())}")
    print("\nNow you can complete peer reviews with the rubric criteria!")

