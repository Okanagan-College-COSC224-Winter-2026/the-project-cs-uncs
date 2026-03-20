from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from uuid import uuid4

from flask import Blueprint, current_app, jsonify, request, send_from_directory
from flask_jwt_extended import get_jwt_identity, jwt_required
from werkzeug.utils import secure_filename

from ..models import Course, Assignment, Submission, User, User_Course, AssignmentSchema, Group, GroupMember, db
from .auth_controller import jwt_teacher_required, jwt_role_required

bp = Blueprint("assignment", __name__, url_prefix="/assignment")


def _parse_due_date_input(due_date_value, *, tz_offset_minutes: int | None = None, now_utc=None):
    """Parse due_date input.

    Accepts:
    - YYYY-MM-DD (interpreted as local end-of-day)
    - ISO 8601 datetime (with or without timezone)

    Returns a naive datetime suitable for DB storage.
    - If input is timezone-aware, it is converted to UTC and tzinfo is stripped.
    - If input is naive/date-only, it is treated as local time (naive).
    """
    if not due_date_value:
        return None

    raw_due_date = str(due_date_value)
    if raw_due_date.endswith("Z"):
        raw_due_date = raw_due_date[:-1] + "+00:00"

    is_date_only = len(raw_due_date) == 10 and raw_due_date.count("-") == 2

    if now_utc is None:
        now_utc = datetime.now(timezone.utc)

    if is_date_only:
        parsed_date = date.fromisoformat(raw_due_date)

        # Validate using the requester's local day when provided.
        if tz_offset_minutes is not None:
            requester_today = (now_utc - timedelta(minutes=tz_offset_minutes)).date()
        else:
            requester_today = datetime.now().date()

        if parsed_date < requester_today:
            raise ValueError("past")

        # Store date-only values as a floating local end-of-day to avoid timezone shifting.
        return datetime(parsed_date.year, parsed_date.month, parsed_date.day, 23, 59, 59)

    parsed_due_date = datetime.fromisoformat(raw_due_date)

    # Validate "not in the past" using the same frame of reference:
    # - aware datetimes compared in UTC
    # - naive datetimes compared in local time
    if parsed_due_date.tzinfo is not None:
        if parsed_due_date.astimezone(timezone.utc) < now_utc:
            raise ValueError("past")
        return parsed_due_date.astimezone(timezone.utc).replace(tzinfo=None)

    if tz_offset_minutes is not None:
        requester_now = (now_utc - timedelta(minutes=tz_offset_minutes)).replace(tzinfo=None)
        if parsed_due_date < requester_now:
            raise ValueError("past")
    else:
        if parsed_due_date < datetime.now():
            raise ValueError("past")
    return parsed_due_date


def _original_filename_from_storage_name(storage_name: str | None) -> str | None:
    if not storage_name:
        return None
    # We store submissions as: <uuidhex>__<secure_filename>
    if "__" in storage_name:
        return storage_name.split("__", 1)[1]

    return storage_name


def _get_user_group_for_course(user_id: int, course_id: int):
    """Return (group, member_user_ids) for the given user in a course, or (None, [])."""
    group = (
        Group.query.join(GroupMember, GroupMember.group_id == Group.id)
        .filter(Group.course_id == course_id, GroupMember.user_id == user_id)
        .first()
    )
    if not group:
        return None, []

    member_user_ids = [m.user_id for m in group.members]
    return group, member_user_ids

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
    tz_offset_minutes = None
    tz_offset_header = request.headers.get("X-Timezone-Offset")
    if tz_offset_header is not None:
        try:
            tz_offset_minutes = int(tz_offset_header)
        except ValueError:
            tz_offset_minutes = None

    if not due_date:
        due_date = None
    else:
        try:
            due_date = _parse_due_date_input(due_date, tz_offset_minutes=tz_offset_minutes)
        except (ValueError, TypeError) as e:
            if str(e) == "past":
                return jsonify({"msg": "Due date cannot be in the past"}), 400
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

    tz_offset_minutes = None
    tz_offset_header = request.headers.get("X-Timezone-Offset")
    if tz_offset_header is not None:
        try:
            tz_offset_minutes = int(tz_offset_header)
        except ValueError:
            tz_offset_minutes = None

    if not assignment.can_modify(tz_offset_minutes=tz_offset_minutes):
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
        name = data.get("name", None) if "name" in data else None
        due_date = data.get("due_date", None) if "due_date" in data else None
        description = data.get("description", None) if "description" in data else None
        remove_attachment = bool(data.get("remove_attachment"))
        uploaded_file = None
    else:
        name = request.form.get("name")
        due_date = request.form.get("due_date")
        description = request.form.get("description")
        remove_attachment_value = request.form.get("remove_attachment", "").strip().lower()
        remove_attachment = remove_attachment_value in {"1", "true", "yes", "on"}
        uploaded_file = request.files.get("file")

    tz_offset_minutes = None
    tz_offset_header = request.headers.get("X-Timezone-Offset")
    if tz_offset_header is not None:
        try:
            tz_offset_minutes = int(tz_offset_header)
        except ValueError:
            tz_offset_minutes = None

    uploads_dir = Path(current_app.instance_path) / "uploads"

    if (name is not None) or (due_date is not None):
        if not assignment.can_modify(tz_offset_minutes=tz_offset_minutes):
            return jsonify({"msg": "Assignment cannot be modified after its due date"}), 400

    if name is not None:
        if not name or not str(name).strip():
            return jsonify({"msg": "Assignment name is required"}), 400
        assignment.name = str(name).strip()

    if due_date is not None:
        if not due_date:
            assignment.due_date = None
        else:
            try:
                assignment.due_date = _parse_due_date_input(due_date, tz_offset_minutes=tz_offset_minutes)
            except (ValueError, TypeError) as e:
                if str(e) == "past":
                    return jsonify({"msg": "Due date cannot be in the past"}), 400
                return jsonify({"msg": "Invalid due date format. Please use ISO format (YYYY-MM-DD or ISO 8601)"}), 400

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


@bp.route("/my_submission/<int:assignment_id>", methods=["GET"])
@jwt_role_required("student")
def get_my_submission(assignment_id):
    """Get the current student's submission metadata for an assignment (if any)."""
    assignment = Assignment.get_by_id(assignment_id)
    if not assignment:
        return jsonify({"msg": "Assignment not found"}), 404

    email = get_jwt_identity()
    user = User.get_by_email(email)
    if not user:
        return jsonify({"msg": "User not found"}), 404

    enrollment = User_Course.get(user.id, assignment.courseID)
    if not enrollment:
        return jsonify({"msg": "Unauthorized: You are not enrolled in this course"}), 403

    group, member_ids = _get_user_group_for_course(user.id, assignment.courseID)

    if group and member_ids:
        submission = (
            Submission.query.filter(
                Submission.assignmentID == assignment.id,
                Submission.studentID.in_(member_ids),
            )
            .order_by(Submission.id.asc())
            .first()
        )
    else:
        submission = Submission.query.filter_by(studentID=user.id, assignmentID=assignment.id).first()

    if not submission:
        return jsonify({"submission": None, "locked": False}), 200

    storage_name = Path(submission.path).name if submission.path else None
    file_name = _original_filename_from_storage_name(storage_name)
    submitted_by = None
    try:
        submitted_by_user = submission.student
        if submitted_by_user:
            submitted_by = {"id": submitted_by_user.id, "name": submitted_by_user.name}
    except Exception:
        submitted_by = None

    locked = bool(group and submission.studentID != user.id)

    return (
        jsonify(
            {
                "submission": {"id": submission.id, "file_name": file_name},
                "submitted_by": submitted_by,
                "locked": locked,
            }
        ),
        200,
    )


@bp.route("/submit/<int:assignment_id>", methods=["POST"])
@jwt_role_required("student")
def upload_submission(assignment_id):
    """Upload or replace the current student's submission for an assignment."""
    assignment = Assignment.get_by_id(assignment_id)
    if not assignment:
        return jsonify({"msg": "Assignment not found"}), 404

    email = get_jwt_identity()
    user = User.get_by_email(email)
    if not user:
        return jsonify({"msg": "User not found"}), 404

    enrollment = User_Course.get(user.id, assignment.courseID)
    if not enrollment:
        return jsonify({"msg": "Unauthorized: You are not enrolled in this course"}), 403

    uploaded_file = request.files.get("file")
    if not uploaded_file or not uploaded_file.filename:
        return jsonify({"msg": "File is required"}), 400

    uploads_root = Path(current_app.instance_path) / "uploads"
    rel_dir = Path("submissions") / str(assignment.id) / str(user.id)
    abs_dir = uploads_root / rel_dir
    abs_dir.mkdir(parents=True, exist_ok=True)

    safe_name = secure_filename(uploaded_file.filename)
    if not safe_name:
        safe_name = "submission"

    storage_name = f"{uuid4().hex}__{safe_name}"
    abs_path = abs_dir / storage_name

    group, member_ids = _get_user_group_for_course(user.id, assignment.courseID)
    if group and member_ids:
        existing_group_submission = (
            Submission.query.filter(
                Submission.assignmentID == assignment.id,
                Submission.studentID.in_(member_ids),
            )
            .order_by(Submission.id.asc())
            .first()
        )
        if existing_group_submission and existing_group_submission.studentID != user.id:
            return jsonify({"msg": "Your group has already submitted for this assignment"}), 403

    submission = Submission.query.filter_by(studentID=user.id, assignmentID=assignment.id).first()
    if submission and submission.path:
        try:
            (uploads_root / submission.path).unlink(missing_ok=True)
        except Exception:
            pass

    uploaded_file.save(str(abs_path))
    rel_path = (rel_dir / storage_name).as_posix()

    if not submission:
        submission = Submission(path=rel_path, studentID=user.id, assignmentID=assignment.id)
        db.session.add(submission)
    else:
        submission.path = rel_path

    db.session.commit()

    return jsonify({"msg": "Submission uploaded", "submission": {"id": submission.id}}), 200


@bp.route("/submissions/<int:assignment_id>", methods=["GET"])
@jwt_role_required("teacher", "admin")
def list_submissions(assignment_id):
    """List all submissions for an assignment (teacher/admin only)."""
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

    submissions = (
        Submission.query.filter_by(assignmentID=assignment.id)
        .join(User, Submission.studentID == User.id)
        .order_by(User.name.asc())
        .all()
    )

    results = []
    for sub in submissions:
        student = sub.student
        storage_name = Path(sub.path).name if sub.path else None
        file_name = _original_filename_from_storage_name(storage_name)
        results.append(
            {
                "id": sub.id,
                "student": {
                    "id": student.id if student else sub.studentID,
                    "name": student.name if student else None,
                    "email": student.email if student else None,
                },
                "file_name": file_name,
            }
        )

    return jsonify({"submissions": results}), 200


@bp.route("/submission/download/<int:submission_id>", methods=["GET"])
@jwt_required()
def download_submission(submission_id):
    """Download a submission file.

    Allowed for:
    - The submitting student
    - The course teacher
    - Admins
    """
    submission = Submission.get_by_id(submission_id)
    if not submission:
        return jsonify({"msg": "Submission not found"}), 404

    assignment = Assignment.get_by_id(submission.assignmentID)
    if not assignment:
        return jsonify({"msg": "Assignment not found"}), 404

    email = get_jwt_identity()
    user = User.get_by_email(email)
    if not user:
        return jsonify({"msg": "User not found"}), 404

    course = Course.get_by_id(assignment.courseID)
    if not course:
        return jsonify({"msg": "Course not found"}), 404

    is_owner_student = user.is_student() and submission.studentID == user.id
    is_course_teacher = user.is_teacher() and course.teacherID == user.id
    is_groupmate_student = False
    if user.is_student() and not is_owner_student:
        group, _ = _get_user_group_for_course(user.id, course.id)
        if group:
            is_groupmate_student = (
                GroupMember.query.filter_by(group_id=group.id, user_id=submission.studentID).first() is not None
            )

    if not (user.is_admin() or is_owner_student or is_course_teacher or is_groupmate_student):
        return jsonify({"msg": "Unauthorized"}), 403

    if not submission.path:
        return jsonify({"msg": "No file for this submission"}), 404

    storage_name = Path(submission.path).name
    download_name = _original_filename_from_storage_name(storage_name) or storage_name

    uploads_root = Path(current_app.instance_path) / "uploads"
    return send_from_directory(
        str(uploads_root),
        submission.path,
        as_attachment=True,
        download_name=download_name,
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