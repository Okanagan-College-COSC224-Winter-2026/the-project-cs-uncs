"""
Review controller - handles peer review operations for students and teachers
"""

from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity

from ..models import (
    Assignment,
    Criterion,
    CriterionSchema,
    CriteriaDescription,
    Group,
    GroupMember,
    Review,
    ReviewSchema,
    Rubric,
    Submission,
    SubmissionSchema,
    User,
)
from .auth_controller import jwt_role_required

bp = Blueprint("review", __name__, url_prefix="/review")

# Schema instances
review_schema = ReviewSchema()
reviews_schema = ReviewSchema(many=True)
criterion_schema = CriterionSchema()
submission_schema = SubmissionSchema()

from ..models.schemas import CriteriaDescriptionSchema
criteria_description_schema = CriteriaDescriptionSchema(many=True)


@bp.route("/assigned/<int:assignment_id>", methods=["GET"])
@jwt_role_required("student", "teacher", "admin")
def get_assigned_reviews(assignment_id):
    """
    Get all reviews assigned to the current user for a specific assignment

    Returns:
        - List of reviews with reviewee details and completion status
        - Each review includes submission information if available
    """
    current_email = get_jwt_identity()
    user = User.get_by_email(current_email)

    # Verify assignment exists
    assignment = Assignment.get_by_id(assignment_id)
    if not assignment:
        return jsonify({"msg": "Assignment not found"}), 404

    # Get all reviews where this user is the reviewer
    reviews = Review.get_by_reviewer_and_assignment(user.id, assignment_id)

    # Build response with additional context
    result = []
    for review in reviews:
        review_data = review_schema.dump(review)

        # Add submission information for the reviewee
        submission = Submission.query.filter_by(
            studentID=review.revieweeID,
            assignmentID=assignment_id
        ).first()

        if submission:
            review_data["submission"] = submission_schema.dump(submission)
        else:
            review_data["submission"] = None

        # Add completion status and criteria count
        review_data["criteria_count"] = review.criteria.count()

        result.append(review_data)

    return jsonify({
        "reviews": result,
        "total_count": len(result),
        "assignment": {
            "id": assignment.id,
            "name": assignment.name,
            "due_date": assignment.due_date.isoformat() if assignment.due_date else None,
            "can_submit": assignment.can_modify()  # Checks if before due date
        }
    }), 200


@bp.route("/submission/<int:review_id>", methods=["GET"])
@jwt_role_required("student", "teacher", "admin")
def get_review_submission(review_id):
    """
    Get the submission content for a specific review

    Only allows access if:
    - User is the assigned reviewer
    - OR user is a teacher/admin
    """
    try:
        current_email = get_jwt_identity()
        user = User.get_by_email(current_email)

        print(f"[DEBUG] get_review_submission: review_id={review_id}, user={user.email}")

        review = Review.get_by_id(review_id)
        if not review:
            print(f"[DEBUG] Review {review_id} not found")
            return jsonify({"msg": "Review not found"}), 404

        # Check permission: must be the reviewer or a teacher/admin
        if review.reviewerID != user.id and not user.has_role("teacher", "admin"):
            print(f"[DEBUG] Unauthorized access attempt")
            return jsonify({"msg": "You are not authorized to view this submission"}), 403

        # Get the submission
        submission = Submission.query.filter_by(
            studentID=review.revieweeID,
            assignmentID=review.assignmentID
        ).first()

        if not submission:
            print(f"[DEBUG] No submission found")
            return jsonify({"msg": "Submission not found"}), 404

        print(f"[DEBUG] Returning submission data successfully")
        return jsonify({
            "submission": submission_schema.dump(submission),
            "review": review_schema.dump(review),
            "reviewee_name": review.reviewee.name  # For display purposes (keeping anonymous per US3)
        }), 200

    except Exception as e:
        print(f"[ERROR] Exception in get_review_submission: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"msg": f"Server error: {str(e)}"}), 500


@bp.route("/submit/<int:review_id>", methods=["POST"])
@jwt_role_required("student", "teacher", "admin")
def submit_review_feedback(review_id):
    """
    Submit feedback for a peer review

    Request body:
    {
        "criteria": [
            {
                "criterionRowID": 1,
                "grade": 5,
                "comments": "Great work!"
            },
            ...
        ]
    }

    Checks:
    - User is the assigned reviewer
    - Review period is still open (before due date)
    - Review hasn't already been completed
    """
    current_email = get_jwt_identity()
    user = User.get_by_email(current_email)

    review = Review.get_by_id(review_id)
    if not review:
        return jsonify({"msg": "Review not found"}), 404

    # Check permission: must be the reviewer
    if review.reviewerID != user.id:
        return jsonify({"msg": "You are not authorized to submit this review"}), 403

    # For individual peer evaluation assignments, enforce current-team eligibility.
    assignment = review.assignment
    if assignment and assignment.assignment_type == "peer_eval_individual":
        reviewer_group = (
            Group.query.join(GroupMember, GroupMember.group_id == Group.id)
            .filter(Group.course_id == assignment.courseID, GroupMember.user_id == user.id)
            .first()
        )
        reviewee_group = (
            Group.query.join(GroupMember, GroupMember.group_id == Group.id)
            .filter(
                Group.course_id == assignment.courseID,
                GroupMember.user_id == review.revieweeID,
            )
            .first()
        )
        if not reviewer_group or not reviewee_group or reviewer_group.id != reviewee_group.id:
            return jsonify({"msg": "You are not eligible to submit this review"}), 403

    # Check if review period is still open
    if assignment.due_date and not assignment.can_modify():
        return jsonify({
            "msg": "The review period has ended. Submissions are no longer accepted.",
            "due_date": assignment.due_date.isoformat()
        }), 403

    # Check if already completed
    if review.completed:
        return jsonify({"msg": "This review has already been submitted"}), 400

    # Validate request
    if not request.is_json:
        return jsonify({"msg": "Missing JSON in request"}), 400

    data = request.json
    criteria_data = data.get("criteria", [])

    if not criteria_data:
        return jsonify({"msg": "At least one criterion is required"}), 400

    # Create or update criteria
    for criterion_data in criteria_data:
        # Check if criterion already exists
        existing = Criterion.query.filter_by(
            reviewID=review_id,
            criterionRowID=criterion_data.get("criterionRowID")
        ).first()

        if existing:
            # Update existing
            existing.grade = criterion_data.get("grade")
            existing.comments = criterion_data.get("comments", "")
            existing.update()
        else:
            # Create new
            criterion = Criterion(
                reviewID=review_id,
                criterionRowID=criterion_data.get("criterionRowID"),
                grade=criterion_data.get("grade"),
                comments=criterion_data.get("comments", "")
            )
            Criterion.create_criterion(criterion)

    # Mark review as complete
    review.mark_complete()

    return jsonify({
        "msg": "Review submitted successfully",
        "review": review_schema.dump(review)
    }), 200


@bp.route("/status/<int:assignment_id>", methods=["GET"])
@jwt_role_required("student", "teacher", "admin")
def get_review_status(assignment_id):
    """
    Get review completion status for the current user on an assignment

    Returns summary of assigned vs completed reviews
    """
    current_email = get_jwt_identity()
    user = User.get_by_email(current_email)

    assignment = Assignment.get_by_id(assignment_id)
    if not assignment:
        return jsonify({"msg": "Assignment not found"}), 404

    reviews = Review.get_by_reviewer_and_assignment(user.id, assignment_id)

    completed_count = sum(1 for review in reviews if review.completed)
    total_count = len(reviews)

    return jsonify({
        "assignment_id": assignment_id,
        "total_assigned": total_count,
        "completed": completed_count,
        "remaining": total_count - completed_count,
        "is_open": assignment.can_modify(),
        "due_date": assignment.due_date.isoformat() if assignment.due_date else None
    }), 200


@bp.route("/create", methods=["POST"])
@jwt_role_required("teacher", "admin")
def create_review():
    """
    Create a new review assignment (teacher/admin only)

    Request body:
    {
        "assignmentID": 1,
        "reviewerID": 2,
        "revieweeID": 3
    }
    """
    if not request.is_json:
        return jsonify({"msg": "Missing JSON in request"}), 400

    data = request.json

    # Validate required fields
    required = ["assignmentID", "reviewerID", "revieweeID"]
    if not all(field in data for field in required):
        return jsonify({"msg": f"Missing required fields: {required}"}), 400

    # Verify assignment exists
    assignment = Assignment.get_by_id(data["assignmentID"])
    if not assignment:
        return jsonify({"msg": "Assignment not found"}), 404

    # Verify users exist
    reviewer = User.get_by_id(data["reviewerID"])
    reviewee = User.get_by_id(data["revieweeID"])
    if not reviewer or not reviewee:
        return jsonify({"msg": "Reviewer or reviewee not found"}), 404

    # Check if review already exists
    existing = Review.get_by_reviewer_reviewee_assignment(
        data["reviewerID"],
        data["revieweeID"],
        data["assignmentID"]
    )
    if existing:
        return jsonify({"msg": "Review already exists", "review_id": existing.id}), 400

    # Create review
    review = Review(
        assignmentID=data["assignmentID"],
        reviewerID=data["reviewerID"],
        revieweeID=data["revieweeID"]
    )
    Review.create_review(review)

    return jsonify({
        "msg": "Review created successfully",
        "review": review_schema.dump(review)
    }), 201


@bp.route("/<int:review_id>", methods=["GET"])
@jwt_role_required("student", "teacher", "admin")
def get_review(review_id):
    """
    Get details of a specific review including all criteria
    """
    try:
        current_email = get_jwt_identity()
        user = User.get_by_email(current_email)

        print(f"[DEBUG] get_review called: review_id={review_id}, user={user.email}")

        review = Review.get_by_id_with_relations(review_id)
        if not review:
            print(f"[DEBUG] Review {review_id} not found")
            return jsonify({"msg": "Review not found"}), 404


        if review.reviewerID != user.id and not user.has_role("teacher", "admin"):
            print(f"[DEBUG] Unauthorized: user {user.id} trying to access review for reviewer {review.reviewerID}")
            return jsonify({"msg": "You are not authorized to view this review"}), 403

        # Get all criteria for this review
        criteria = list(review.criteria.all())
        print(f"[DEBUG] Found {len(criteria)} criteria for review {review_id}")

        result = {
            "review": review_schema.dump(review),
            "criteria": criterion_schema.dump(criteria, many=True)
        }
        print(f"[DEBUG] Returning review data successfully")
        return jsonify(result), 200

    except Exception as e:
        print(f"[ERROR] Exception in get_review: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"msg": f"Server error: {str(e)}"}), 500


@bp.route("/criteria/<int:assignment_id>", methods=["GET"])
@jwt_role_required("student", "teacher", "admin")
def get_criteria_for_assignment(assignment_id):
    """
    Get rubric criteria descriptions for an assignment.
    This is used when filling out a peer review.

    Returns the criteria that reviewers should evaluate.
    """
    # Verify assignment exists
    assignment = Assignment.get_by_id(assignment_id)
    if not assignment:
        return jsonify({"msg": "Assignment not found"}), 404

    # Get the rubric for this assignment
    rubric = Rubric.query.filter_by(assignmentID=assignment_id).first()
    if not rubric:
        return jsonify({"msg": "No rubric found for this assignment", "criteria": []}), 200

    # Get all criteria descriptions for this rubric
    criteria_descriptions = CriteriaDescription.query.filter_by(rubricID=rubric.id).all()

    return jsonify(criteria_description_schema.dump(criteria_descriptions)), 200


@bp.route("/received/<int:assignment_id>", methods=["GET"])
@jwt_role_required("student", "teacher", "admin")
def get_received_feedback(assignment_id):
    """
    Get all completed peer reviews received by the current user for an assignment.

    Returns feedback the current user received (where they are the reviewee),
    including grades and comments for each criterion. Reviewer identity is
    kept anonymous.
    """
    current_email = get_jwt_identity()
    user = User.get_by_email(current_email)

    print(f"[DEBUG] get_received_feedback: assignment_id={assignment_id}, user={user.email}")

    assignment = Assignment.get_by_id(assignment_id)
    if not assignment:
        print(f"[DEBUG] Assignment {assignment_id} not found")
        return jsonify({"msg": "Assignment not found"}), 404


    # Get all completed reviews where this user is the reviewee
    reviews = Review.query.filter_by(
        revieweeID=user.id,
        assignmentID=assignment_id,
        completed=True
    ).all()

    # Get criteria descriptions for context (question text and score max)
    rubric = Rubric.query.filter_by(assignmentID=assignment_id).first()
    criteria_descriptions = {}
    if rubric:
        descriptions = CriteriaDescription.query.filter_by(rubricID=rubric.id).all()
        for desc in descriptions:
            criteria_descriptions[desc.id] = {
                "question": desc.question,
                "scoreMax": desc.scoreMax,
                "hasScore": desc.hasScore
            }

    feedback_list = []
    for review in reviews:
        criteria_data = []
        for criterion in review.criteria.all():
            desc = criteria_descriptions.get(criterion.criterionRowID, {})
            if not desc:
                import logging
                logging.warning(
                    "Criterion %s in review %s has no matching CriteriaDescription",
                    criterion.criterionRowID, review.id
                )
            criteria_data.append({
                "criterionRowID": criterion.criterionRowID,
                "question": desc.get("question", "Question unavailable"),
                "scoreMax": desc.get("scoreMax"),
                "hasScore": desc.get("hasScore", True),
                "grade": criterion.grade,
                "comments": criterion.comments
            })
        feedback_list.append({
            "review_id": review.id,
            "criteria": criteria_data
        })

    return jsonify({
        "assignment": {
            "id": assignment.id,
            "name": assignment.name,
            "due_date": assignment.due_date.isoformat() if assignment.due_date else None
        },
        "feedback": feedback_list,
        "total_reviews": len(feedback_list)
    }), 200


@bp.route("/assignment/<int:assignment_id>/all", methods=["GET"])
@jwt_role_required("teacher", "admin")
def get_all_reviews_for_assignment(assignment_id):
    """
    Get all peer reviews for a specific assignment (teacher/admin only)

    This endpoint allows teachers to view all peer reviews for their assignments,
    including reviewer/reviewee information, completion status, and submitted criteria.

    Authorization:
    - Teachers can only view reviews for assignments in their own courses
    - Admins can view reviews for any assignment

    Returns:
        - List of all reviews with reviewer, reviewee, and criteria details
        - Assignment information
        - Completion statistics
    """
    try:
        current_email = get_jwt_identity()
        user = User.get_by_email(current_email)

        # Verify assignment exists
        assignment = Assignment.get_by_id(assignment_id)
        if not assignment:
            return jsonify({"msg": "Assignment not found"}), 404

        # Check authorization: teachers can only view their own course assignments
        if user.is_teacher() and assignment.course.teacherID != user.id:
            return jsonify({
                "msg": "You are not authorized to view reviews for this assignment"
            }), 403

        # Get all reviews for this assignment
        reviews = Review.get_by_assignment(assignment_id)

        # Build detailed response with criteria for each review
        result = []
        completed_count = 0
        total_criteria = 0

        for review in reviews:
            # Get criteria for this review
            criteria_list = list(review.criteria.all())

            # Enhance criteria with scoreMax from CriteriaDescription
            criteria_with_max = []
            for criterion in criteria_list:
                crit_data = criterion_schema.dump(criterion)
                # Add scoreMax from the related CriteriaDescription
                if criterion.criterion_row:
                    crit_data['scoreMax'] = criterion.criterion_row.scoreMax
                else:
                    crit_data['scoreMax'] = None
                criteria_with_max.append(crit_data)

            review_data = {
                "id": review.id,
                "reviewer": {
                    "id": review.reviewer.id,
                    "name": review.reviewer.name,
                    "email": review.reviewer.email
                },
                "reviewee": {
                    "id": review.reviewee.id,
                    "name": review.reviewee.name,
                    "email": review.reviewee.email
                },
                "completed": review.completed,
                "criteria_count": len(criteria_list),
                "criteria": criteria_with_max
            }

            if review.completed:
                completed_count += 1
            total_criteria += len(criteria_list)

            result.append(review_data)

        # Calculate statistics
        total_reviews = len(reviews)
        completion_rate = (completed_count / total_reviews * 100) if total_reviews > 0 else 0

        return jsonify({
            "assignment": {
                "id": assignment.id,
                "name": assignment.name,
                "course_id": assignment.courseID,
                "course_name": assignment.course.name,
                "due_date": assignment.due_date.isoformat() if assignment.due_date else None,
                "is_open": assignment.can_modify()
            },
            "statistics": {
                "total_reviews": total_reviews,
                "completed_reviews": completed_count,
                "incomplete_reviews": total_reviews - completed_count,
                "completion_rate": round(completion_rate, 2),
                "total_criteria_submitted": total_criteria
            },
            "reviews": result
        }), 200

    except Exception as e:
        print(f"[ERROR] Exception in get_all_reviews_for_assignment: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"msg": f"Server error: {str(e)}"}), 500


