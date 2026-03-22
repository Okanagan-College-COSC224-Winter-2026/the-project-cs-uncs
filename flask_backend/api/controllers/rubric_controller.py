from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from ..models import Assignment, Course, CriteriaDescription, Rubric, User
from ..models.db import db
from .auth_controller import jwt_teacher_required

bp = Blueprint("rubric", __name__)


@bp.route("/get_rubric/<int:assignment_id>", methods=["GET"])
@jwt_required()
def get_rubric_for_assignment(assignment_id):
    """Return rubric metadata for an assignment.

    Used by the frontend rubric editor to determine the rubric_id even when
    there are zero criteria.
    """
    assignment = Assignment.query.get(assignment_id)
    if not assignment:
        return jsonify({"msg": "Assignment not found"}), 404

    rubric = Rubric.query.filter_by(assignmentID=assignment_id).first()
    if not rubric:
        return jsonify({"rubric": None}), 200

    return jsonify({"rubric": {"id": rubric.id, "assignmentID": rubric.assignmentID, "canComment": rubric.canComment}}), 200

@bp.route("/create_rubric", methods=["POST"])
@jwt_teacher_required
def create_rubric():
    data = request.get_json()
    assignment_id = data.get("assignmentID")
    can_comment = data.get("canComment", True)
    
    if not assignment_id:
        return jsonify({"msg": "Assignment ID is required"}), 400

    email = get_jwt_identity()
    user = User.get_by_email(email)
    
    assignment = Assignment.query.get(assignment_id)
    if not assignment:
        return jsonify({"msg": "Assignment not found"}), 404
        
    course = Course.query.get(assignment.courseID)
    if not course:
        return jsonify({"msg": "Class not found"}), 404

    if course.teacherID != user.id:
        return jsonify({"msg": "Unauthorized: You are not the teacher of this class"}), 403

    # Check existing rubric and delete
    existing_rubric = Rubric.query.filter_by(assignmentID=assignment_id).first()
    if existing_rubric:
        # Cascade delete criteria via model relationship
        existing_rubric.delete()

    new_rubric = Rubric(assignmentID=assignment_id, canComment=can_comment)
    try:
        Rubric.create_rubric(new_rubric)
        return jsonify({"message": "Rubric created", "id": new_rubric.id}), 201
    except Exception as e:
        return jsonify({"msg": str(e)}), 500


@bp.route("/get_criteria/<int:assignment_id>", methods=["GET"])
@jwt_required()
def get_criteria(assignment_id):
    """Get criteria for a specific assignment (for students/teachers)"""
    assignment = Assignment.query.get(assignment_id)
    if not assignment:
        return jsonify({"msg": "Assignment not found"}), 404

    rubric = Rubric.query.filter_by(assignmentID=assignment_id).first()
    if not rubric:
        return jsonify([]), 200

    # Get descriptions
    # Note: lazy="dynamic" returns a query object, so we use .all()
    descriptions = rubric.criteria_descriptions.all()
    
    result = []
    for desc in descriptions:
        result.append({
            "id": desc.id,
            "rubricID": desc.rubricID,
            "question": desc.question,
            "scoreMax": desc.scoreMax,
        })
    
    return jsonify(result), 200


@bp.route("/create_criteria", methods=["POST"])
@jwt_teacher_required
def create_criteria():
    data = request.get_json()
    rubric_id = data.get("rubricID")
    question = data.get("question")
    score_max = data.get("scoreMax", 5)
    
    if not rubric_id:
        return jsonify({"msg": "Rubric ID is required"}), 400

    rubric = Rubric.query.get(rubric_id)
    if not rubric:
        return jsonify({"msg": "Rubric not found"}), 404
        
    # Verify ownership via assignment -> course -> teacher
    assignment = Assignment.query.get(rubric.assignmentID)
    if not assignment:
        return jsonify({"msg": "Assignment associated with rubric not found"}), 404
        
    course = Course.query.get(assignment.courseID)
    if not course:
        return jsonify({"msg": "Course associated with assignment not found"}), 404
        
    email = get_jwt_identity()
    user = User.get_by_email(email)
    
    if course.teacherID != user.id:
        return jsonify({"msg": "Unauthorized"}), 403

    if not question or not str(question).strip():
        return jsonify({"msg": "Question is required"}), 400

    try:
        score_max = int(score_max) if score_max is not None else 0
    except (TypeError, ValueError):
        return jsonify({"msg": "Invalid scoreMax"}), 400

    if score_max < 1:
        return jsonify({"msg": "scoreMax must be 1 or greater"}), 400

    if score_max > 10:
        return jsonify({"msg": "scoreMax must be 10 or less"}), 400

    new_criterion = CriteriaDescription(
        rubricID=rubric_id, 
        question=str(question).strip(),
        scoreMax=score_max, 
    )
    
    try:
        # CriteriaDescription has create_criteria_description method?
        # Let's check model again or assume similar pattern
        # checked model: create_criteria_description(cls, criteria_description)
        CriteriaDescription.create_criteria_description(new_criterion)
        return jsonify({"message": "Criteria created", "id": new_criterion.id}), 201
    except Exception as e:
        return jsonify({"msg": str(e)}), 500


@bp.route("/update_criteria/<int:criteria_id>", methods=["PATCH"])
@jwt_teacher_required
def update_criteria(criteria_id):
    """Update a single criteria description (question/scoreMax)."""
    criterion = CriteriaDescription.query.get(criteria_id)
    if not criterion:
        return jsonify({"msg": "Criteria not found"}), 404

    rubric = Rubric.query.get(criterion.rubricID)
    if not rubric:
        return jsonify({"msg": "Rubric not found"}), 404

    assignment = Assignment.query.get(rubric.assignmentID)
    if not assignment:
        return jsonify({"msg": "Assignment associated with rubric not found"}), 404

    course = Course.query.get(assignment.courseID)
    if not course:
        return jsonify({"msg": "Course associated with assignment not found"}), 404

    email = get_jwt_identity()
    user = User.get_by_email(email)
    if course.teacherID != user.id:
        return jsonify({"msg": "Unauthorized"}), 403

    data = request.get_json() or {}
    next_question = data.get("question", None)
    next_score_max = data.get("scoreMax", None)

    if next_question is None and next_score_max is None:
        return jsonify({"msg": "No fields to update"}), 400

    if next_question is not None:
        if not str(next_question).strip():
            return jsonify({"msg": "Question is required"}), 400
        criterion.question = str(next_question).strip()

    if next_score_max is not None:
        try:
            next_score_max = int(next_score_max) if next_score_max is not None else 0
        except (TypeError, ValueError):
            return jsonify({"msg": "Invalid scoreMax"}), 400
        if next_score_max < 1:
            return jsonify({"msg": "scoreMax must be 1 or greater"}), 400
        if next_score_max > 10:
            return jsonify({"msg": "scoreMax must be 10 or less"}), 400
        criterion.scoreMax = next_score_max

    try:
        criterion.update()
        return (
            jsonify(
                {
                    "message": "Criteria updated",
                    "criteria": {
                        "id": criterion.id,
                        "rubricID": criterion.rubricID,
                        "question": criterion.question,
                        "scoreMax": criterion.scoreMax,
                    },
                }
            ),
            200,
        )
    except Exception as e:
        return jsonify({"msg": str(e)}), 500


@bp.route("/delete_criteria/<int:criteria_id>", methods=["DELETE"])
@jwt_teacher_required
def delete_criteria(criteria_id):
    """Delete a single criteria description from a rubric."""
    criterion = CriteriaDescription.query.get(criteria_id)
    if not criterion:
        return jsonify({"msg": "Criteria not found"}), 404

    rubric = Rubric.query.get(criterion.rubricID)
    if not rubric:
        return jsonify({"msg": "Rubric not found"}), 404

    assignment = Assignment.query.get(rubric.assignmentID)
    if not assignment:
        return jsonify({"msg": "Assignment associated with rubric not found"}), 404

    course = Course.query.get(assignment.courseID)
    if not course:
        return jsonify({"msg": "Course associated with assignment not found"}), 404

    email = get_jwt_identity()
    user = User.get_by_email(email)
    if course.teacherID != user.id:
        return jsonify({"msg": "Unauthorized"}), 403

    try:
        db.session.delete(criterion)
        db.session.commit()
        return jsonify({"message": "Criteria deleted"}), 200
    except Exception as e:
        return jsonify({"msg": str(e)}), 500
