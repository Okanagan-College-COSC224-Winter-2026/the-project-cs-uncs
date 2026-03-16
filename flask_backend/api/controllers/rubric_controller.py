from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from ..models import Assignment, Course, CriteriaDescription, Rubric, User
from .auth_controller import jwt_teacher_required

bp = Blueprint("rubric", __name__)

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
            "hasScore": desc.hasScore
        })
    
    return jsonify(result), 200


@bp.route("/create_criteria", methods=["POST"])
@jwt_teacher_required
def create_criteria():
    data = request.get_json()
    rubric_id = data.get("rubricID")
    question = data.get("question")
    score_max = data.get("scoreMax")
    has_score = data.get("hasScore", True)
    
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

    new_criterion = CriteriaDescription(
        rubricID=rubric_id, 
        question=question, 
        scoreMax=score_max, 
        hasScore=has_score
    )
    
    try:
        # CriteriaDescription has create_criteria_description method?
        # Let's check model again or assume similar pattern
        # checked model: create_criteria_description(cls, criteria_description)
        CriteriaDescription.create_criteria_description(new_criterion)
        return jsonify({"message": "Criteria created", "id": new_criterion.id}), 201
    except Exception as e:
        return jsonify({"msg": str(e)}), 500
