from datetime import datetime
from pathlib import Path
from uuid import uuid4

from flask import Blueprint, current_app, jsonify, request, send_from_directory
from flask_jwt_extended import get_jwt_identity, jwt_required
from werkzeug.utils import secure_filename

from ..models import Course, Assignment, User, AssignmentSchema, db
from .auth_controller import jwt_teacher_required, jwt_role_required

bp = Blueprint("assignment", __name__, url_prefix="/assignment")

@bp.route("/create_assignment", methods=["POST"])
@jwt_teacher_required
def create_assignment():
    """Create a new assignment for a class where the authenticated user is the teacher"""
    if request.is_json:
        data = request.get_json(silent=True) or {}
        course_id = data.get("courseID")
        assignment_name = data.get("name")
        description = data.get("description")
        rubric_text = data.get("rubric")
        due_date = data.get("due_date")
        uploaded_file = None
    else:
        course_id = request.form.get("courseID")
        assignment_name = request.form.get("name")
        description = request.form.get("description")
        rubric_text = request.form.get("rubric")
        due_date = request.form.get("due_date")
        uploaded_file = request.files.get("file")

    attachment_original_name = None
    attachment_storage_name = None

    if uploaded_file and uploaded_file.filename:
        uploads_dir = Path(current_app.instance_path) / "uploads"
        uploads_dir.mkdir(parents=True, exist_ok=True)

        safe_name = secure_filename(uploaded_file.filename)
        attachment_original_name = uploaded_file.filename
        attachment_storage_name = f"{uuid4().hex}_{safe_name}" if safe_name else uuid4().hex
        uploaded_file.save(str(uploads_dir / attachment_storage_name))
    if not due_date:
        due_date = None
    else:
        try:
            due_date = datetime.fromisoformat(due_date)
        except (ValueError, TypeError):
            return jsonify({"msg": "Invalid due date format. Please use ISO format (YYYY-MM-DD or ISO 8601)"}), 400

    if not course_id:
        return jsonify({"msg": "Course ID is required"}), 400
    if not assignment_name:
        return jsonify({"msg": "Assignment name is required"}), 400

    email = get_jwt_identity()
    user = User.get_by_email(email)
    if not user:
        return jsonify({"msg": "User not found"}), 404

    course = Course.get_by_id(course_id)
    if not course:
        return jsonify({"msg": "Class not found"}), 404
    if course.teacherID != user.id:
        return jsonify({"msg": "Unauthorized: You are not the teacher of this class"}), 403

    new_assignment = Assignment(
        courseID=course_id,
        name=assignment_name,
        rubric_text=rubric_text,
        due_date=due_date,
        description=description,
        attachment_original_name=attachment_original_name,
        attachment_storage_name=attachment_storage_name,
    )
    Assignment.create(new_assignment)
    return (
        jsonify(
            {
                "msg": "Assignment created",
                "assignment": AssignmentSchema().dump(new_assignment),
            }
        ),
        201,
    )

@bp.route("/edit_assignment/<int:assignment_id>", methods=["PATCH"])
@jwt_teacher_required
def edit_assignment(assignment_id):
    """Edit an existing assignment if the authenticated user is the teacher of the class and the due date has not passed"""
    data = request.get_json()
    assignment = Assignment.get_by_id(assignment_id)
    if not assignment:
        return jsonify({"msg": "Assignment not found"}), 404

    email = get_jwt_identity()
    user = User.get_by_email(email)
    if not user:
        return jsonify({"msg": "User not found"}), 404

    course = Course.get_by_id(assignment.courseID)
    if course is None:
        return jsonify({"msg": "Course not found"}), 404
    
    if course.teacherID != user.id:
        return jsonify({"msg": "Unauthorized: You are not the teacher of this class"}), 403

    if not assignment.can_modify():
        return jsonify({"msg": "Assignment cannot be modified after its due date"}), 400

    assignment.name = data.get("name", assignment.name)
    assignment.rubric_text = data.get("rubric", assignment.rubric_text)
    due_date = data.get("due_date")
    if due_date:
        assignment.due_date = datetime.fromisoformat(due_date)

    assignment.update()
    return (
        jsonify(
            {
                "msg": "Assignment updated",
                "assignment": AssignmentSchema().dump(assignment),
            }
        ),
        200,
    )


@bp.route("/edit_details/<int:assignment_id>", methods=["PATCH"])
@jwt_teacher_required
def edit_assignment_details(assignment_id):
    """Edit assignment description and/or attachment.

    - Teachers can only edit assignments for their own courses.
    - Admins can edit any assignment.
    - Unlike /edit_assignment, this endpoint does not enforce due-date restrictions.
    - Supports multipart form-data for file uploads.
    """
    assignment = Assignment.get_by_id(assignment_id)
    if not assignment:
        return jsonify({"msg": "Assignment not found"}), 404

    email = get_jwt_identity()
    user = User.get_by_email(email)
    if not user:
        return jsonify({"msg": "User not found"}), 404

    course = Course.get_by_id(assignment.courseID)
    if not course:
        return jsonify({"msg": "Course not found"}), 404

    if not user.is_admin() and course.teacherID != user.id:
        return jsonify({"msg": "Unauthorized: You are not the teacher of this class or an admin"}), 403

    if request.is_json:
        data = request.get_json(silent=True) or {}
        description = data.get("description", None) if "description" in data else None
        remove_attachment = bool(data.get("remove_attachment"))
        uploaded_file = None
    else:
        description = request.form.get("description")
        remove_attachment_value = request.form.get("remove_attachment", "").strip().lower()
        remove_attachment = remove_attachment_value in {"1", "true", "yes", "on"}
        uploaded_file = request.files.get("file")

    uploads_dir = Path(current_app.instance_path) / "uploads"

    if description is not None:
        assignment.description = description if description and description.strip() else None

    if remove_attachment and assignment.attachment_storage_name:
        try:
            (uploads_dir / assignment.attachment_storage_name).unlink(missing_ok=True)
        except Exception:
            pass
        assignment.attachment_original_name = None
        assignment.attachment_storage_name = None

    if uploaded_file and uploaded_file.filename:
        uploads_dir.mkdir(parents=True, exist_ok=True)

        safe_name = secure_filename(uploaded_file.filename)
        new_storage_name = f"{uuid4().hex}_{safe_name}" if safe_name else uuid4().hex

        # Remove old file (best-effort) before swapping
        if assignment.attachment_storage_name:
            try:
                (uploads_dir / assignment.attachment_storage_name).unlink(missing_ok=True)
            except Exception:
                pass

        uploaded_file.save(str(uploads_dir / new_storage_name))
        assignment.attachment_original_name = uploaded_file.filename
        assignment.attachment_storage_name = new_storage_name

    assignment.update()
    return (
        jsonify(
            {
                "msg": "Assignment details updated",
                "assignment": AssignmentSchema().dump(assignment),
            }
        ),
        200,
    )
@bp.route("/delete_assignment/<int:assignment_id>", methods=["DELETE"])
@jwt_role_required('teacher', 'admin')
def delete_assignment(assignment_id):
    """Delete an existing assignment if the authenticated user is a teacher or admin"""
    assignment = Assignment.get_by_id(assignment_id)
    if not assignment:
        return jsonify({"msg": "Assignment not found"}), 404

    email = get_jwt_identity()
    user = User.get_by_email(email)
    if not user:
        return jsonify({"msg": "User not found"}), 404

    course = Course.get_by_id(assignment.courseID)
    if not course:
        return jsonify({"msg": "Course not found"}), 404

    # Only allow the course teacher or an admin to delete the assignment
    if not user.is_admin() and course.teacherID != user.id:
        return jsonify({"msg": "Unauthorized: You are not the teacher of this class or an admin"}), 403

    if assignment.attachment_storage_name:
        uploads_dir = Path(current_app.instance_path) / "uploads"
        try:
            (uploads_dir / assignment.attachment_storage_name).unlink(missing_ok=True)
        except Exception:
            pass

    db.session.delete(assignment)
    db.session.commit()

    return jsonify({"msg": "Assignment deleted"}), 200


@bp.route("/details/<int:assignment_id>", methods=["GET"])
@jwt_required()
def get_assignment_details(assignment_id):
    """Get a single assignment (used for showing description + attachment link)."""
    assignment = Assignment.get_by_id(assignment_id)
    if not assignment:
        return jsonify({"msg": "Assignment not found"}), 404

    return jsonify(AssignmentSchema().dump(assignment)), 200


@bp.route("/attachment/<int:assignment_id>", methods=["GET"])
@jwt_required()
def download_assignment_attachment(assignment_id):
    """Download the assignment's attached file (if any)."""
    assignment = Assignment.get_by_id(assignment_id)
    if not assignment:
        return jsonify({"msg": "Assignment not found"}), 404

    if not assignment.attachment_storage_name:
        return jsonify({"msg": "No attachment for this assignment"}), 404

    uploads_dir = Path(current_app.instance_path) / "uploads"
    return send_from_directory(
        str(uploads_dir),
        assignment.attachment_storage_name,
        as_attachment=True,
        download_name=assignment.attachment_original_name or assignment.attachment_storage_name,
    )
    

# the following routes are for getting the assignments for a given course
@bp.route("/<int:class_id>", methods=["GET"])
@jwt_required()
def get_assignments(class_id):
    """Get all assignments for a given class"""
    course = Course.get_by_id(class_id)
    if not course:
        return jsonify({"msg": "Class not found"}), 404

    assignments = Assignment.get_by_class_id(class_id)
    assignments_data = AssignmentSchema(many=True).dump(assignments)
    return jsonify(assignments_data), 200