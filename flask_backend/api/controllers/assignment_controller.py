from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from uuid import uuid4

import json

from flask import Blueprint, current_app, jsonify, request, send_from_directory
from flask_jwt_extended import get_jwt_identity, jwt_required
from werkzeug.utils import secure_filename

from ..models import (
    Assignment,
    AssignmentIncludedGroup,
    AssignmentSchema,
    Course,
    CriteriaDescription,
    Group,
    GroupEvaluationSubmission,
    GroupMember,
    Review,
    Rubric,
    Submission,
    User,
    User_Course,
    db,
)
from .auth_controller import jwt_teacher_required, jwt_role_required

bp = Blueprint("assignment", __name__, url_prefix="/assignment")


_ASSIGNMENT_TYPES = {"standard", "peer_eval_group", "peer_eval_individual"}


def _coerce_int_list(value):
    """Coerce an input value into a list[int] when possible.

    Accepts:
    - list of ints/strings
    - JSON-encoded list string
    - comma-separated string
    """
    if value is None:
        return None
    if isinstance(value, list):
        out = []
        for item in value:
            try:
                out.append(int(item))
            except (TypeError, ValueError):
                return None
        return out
    if isinstance(value, str):
        raw = value.strip()
        if not raw:
            return None
        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError:
            parsed = None
        if isinstance(parsed, list):
            return _coerce_int_list(parsed)
        # Fallback: comma-separated values
        parts = [p.strip() for p in raw.split(",") if p.strip()]
        if not parts:
            return None
        return _coerce_int_list(parts)
    return None


def _default_rubric_template(assignment_type: str):
    if assignment_type == "peer_eval_individual":
        return [
            ("Contributed meaningfully to the team's work", 5, True),
            ("Communicated clearly and respectfully", 5, True),
            ("Was reliable and met commitments", 5, True),
            ("Produced high-quality work", 5, True),
            ("Helped the team succeed (supportive/collaborative)", 5, True),
        ]

    if assignment_type == "peer_eval_group":
        return [
            ("Deliverable was clear and easy to follow", 5, True),
            ("Work was complete and met requirements", 5, True),
            ("Evidence of strong teamwork/coordination", 5, True),
            ("Overall effectiveness/quality", 5, True),
        ]

    return []


def _normalize_rubric_criteria_payload(rubric_criteria):
    """Normalize rubric criteria payload from request.

    Expected format: list of {question: str, scoreMax?: int, hasScore?: bool}
    """
    if rubric_criteria is None:
        return None

    if not isinstance(rubric_criteria, list) or not rubric_criteria:
        raise ValueError("rubric_criteria must be a non-empty list")

    normalized = []
    for row in rubric_criteria:
        if not isinstance(row, dict):
            raise ValueError("rubric_criteria rows must be objects")
        question = row.get("question")
        if not isinstance(question, str) or not question.strip():
            raise ValueError("Each criterion must have a question")

        has_score = row.get("hasScore")
        if has_score is None:
            has_score = True
        if not isinstance(has_score, bool):
            raise ValueError("hasScore must be a boolean")

        if not has_score:
            raise ValueError(
                "Rubric criteria must use numeric scores (hasScore=true). "
                "Use the 'Additional comments (optional)' box during review submission instead."
            )

        score_max = row.get("scoreMax")
        if score_max is None:
            score_max = 0 if not has_score else 5
        try:
            score_max_int = int(score_max)
        except (TypeError, ValueError):
            raise ValueError("scoreMax must be an integer")
        if score_max_int < 1:
            raise ValueError("scoreMax must be >= 1")
        if score_max_int > 10:
            raise ValueError("scoreMax must be <= 10")

        normalized.append((question.strip(), score_max_int, has_score))

    return normalized


def _ensure_default_rubric_for_assignment(assignment: Assignment, *, template_override=None):
    if assignment.assignment_type not in {"peer_eval_group", "peer_eval_individual"}:
        return

    # Create or replace rubric for this assignment.
    existing_rubric = Rubric.query.filter_by(assignmentID=assignment.id).first()
    if existing_rubric:
        existing_rubric.delete()

    rubric = Rubric(assignmentID=assignment.id, canComment=True)
    Rubric.create_rubric(rubric)

    template = template_override if template_override is not None else _default_rubric_template(assignment.assignment_type)
    for question, score_max, has_score in template:
        CriteriaDescription.create_criteria_description(
            CriteriaDescription(
                rubricID=rubric.id,
                question=question,
                scoreMax=score_max,
                hasScore=has_score,
            )
        )


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
        assignment_type = data.get("assignment_type") or "standard"
        included_group_ids = _coerce_int_list(data.get("included_group_ids"))
        rubric_criteria = data.get("rubric_criteria")
        uploaded_file = None
    else:
        course_id = request.form.get("courseID")
        assignment_name = request.form.get("name")
        description = request.form.get("description")
        rubric_text = request.form.get("rubric")
        due_date = request.form.get("due_date")
        assignment_type = request.form.get("assignment_type") or "standard"
        included_group_ids_raw = request.form.get("included_group_ids")
        included_group_ids = _coerce_int_list(included_group_ids_raw)
        rubric_criteria_raw = request.form.get("rubric_criteria")
        rubric_criteria = None
        if rubric_criteria_raw:
            try:
                rubric_criteria = json.loads(rubric_criteria_raw)
            except json.JSONDecodeError:
                rubric_criteria = None
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

    if not course_id:
        return jsonify({"msg": "Course ID is required"}), 400
    if not assignment_name:
        return jsonify({"msg": "Assignment name is required"}), 400

    if assignment_type not in _ASSIGNMENT_TYPES:
        return jsonify({"msg": "Invalid assignment type"}), 400

    email = get_jwt_identity()
    user = User.get_by_email(email)
    if not user:
        return jsonify({"msg": "User not found"}), 404

    course = Course.get_by_id(course_id)
    if not course:
        return jsonify({"msg": "Class not found"}), 404
    if course.teacherID != user.id:
        return jsonify({"msg": "Unauthorized: You are not the teacher of this class"}), 403

    if not due_date:
        return jsonify({"msg": "Due date is required"}), 400

    try:
        due_date = _parse_due_date_input(due_date, tz_offset_minutes=tz_offset_minutes)
    except (ValueError, TypeError) as e:
        if str(e) == "past":
            return jsonify({"msg": "Due date cannot be in the past"}), 400
        return jsonify({"msg": "Invalid due date format. Please use ISO format (YYYY-MM-DD or ISO 8601)"}), 400

    included_groups = []
    if assignment_type == "peer_eval_group":
        if not isinstance(included_group_ids, list) or not included_group_ids:
            current_app.logger.warning(
                "create_assignment(peer_eval_group): missing/invalid included_group_ids (value=%r)",
                included_group_ids,
            )
            return jsonify({"msg": "included_group_ids is required for group peer evaluation"}), 400

        if len(included_group_ids) < 2:
            current_app.logger.warning(
                "create_assignment(peer_eval_group): not enough included groups (count=%s)",
                len(included_group_ids),
            )
            return jsonify({"msg": "At least two groups must be included"}), 400

        included_groups = Group.query.filter(
            Group.id.in_(included_group_ids),
            Group.course_id == int(course_id),
        ).all()
        if len(included_groups) != len({int(gid) for gid in included_group_ids}):
            current_app.logger.warning(
                "create_assignment(peer_eval_group): invalid included groups for course_id=%s included=%r resolved=%r",
                course_id,
                included_group_ids,
                [g.id for g in included_groups],
            )
            return jsonify({"msg": "One or more included groups are invalid"}), 400

    rubric_template_override = None
    if assignment_type in {"peer_eval_group", "peer_eval_individual"}:
        try:
            rubric_template_override = _normalize_rubric_criteria_payload(rubric_criteria)
        except ValueError as e:
            return jsonify({"msg": str(e)}), 400

    new_assignment = Assignment(
        courseID=course_id,
        name=assignment_name,
        rubric_text=rubric_text,
        due_date=due_date,
        description=description,
        attachment_original_name=attachment_original_name,
        attachment_storage_name=attachment_storage_name,
        assignment_type=assignment_type,
    )
    Assignment.create(new_assignment)

    if assignment_type == "peer_eval_group":
        for g in included_groups:
            db.session.add(AssignmentIncludedGroup(assignment_id=new_assignment.id, group_id=g.id))
        db.session.commit()

    _ensure_default_rubric_for_assignment(new_assignment, template_override=rubric_template_override)

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
            return jsonify({"msg": "Due date is required"}), 400
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

    payload = AssignmentSchema().dump(assignment)

    current_email = get_jwt_identity()
    user = User.get_by_email(current_email)
    if user and user.is_student():
        enrollment = User_Course.get(user.id, assignment.courseID)
        if not enrollment:
            return jsonify({"msg": "Unauthorized: You are not enrolled in this course"}), 403

        done = False
        latest_at = None

        assignment_type = assignment.assignment_type or "standard"

        if assignment_type == "standard":
            sub = Submission.query.filter_by(studentID=user.id, assignmentID=assignment.id).first()
            if sub is not None:
                done = True
                latest_at = sub.submitted_at

        elif assignment_type == "peer_eval_group":
            my_group, _ = _get_user_group_for_course(user.id, assignment.courseID)
            if my_group:
                included = AssignmentIncludedGroup.query.filter_by(
                    assignment_id=assignment.id, group_id=my_group.id
                ).first()
                if included:
                    sub = GroupEvaluationSubmission.get_by_assignment_and_group(assignment.id, my_group.id)
                    if sub is not None:
                        done = True
                        latest_at = sub.submitted_at

        elif assignment_type == "peer_eval_individual":
            reviews = Review.query.filter_by(assignmentID=assignment.id, reviewerID=user.id).all()
            total = len(reviews)
            completed = sum(1 for r in reviews if r.completed)
            done = total > 0 and completed == total
            completed_times = [r.completed_at for r in reviews if r.completed and r.completed_at is not None]
            latest_at = max(completed_times) if completed_times else None

            payload["student_reviews_total"] = total
            payload["student_reviews_completed"] = completed

        payload["student_done"] = done
        payload["student_latest_submission_at"] = latest_at.isoformat() if latest_at else None

    return jsonify(payload), 200


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

    submission = Submission.query.filter_by(studentID=user.id, assignmentID=assignment.id).first()

    if not submission:
        return jsonify({"submission": None, "locked": False}), 200

    storage_name = Path(submission.path).name if submission.path else None
    file_name = _original_filename_from_storage_name(storage_name)
    submitted_by = {"id": user.id, "name": user.name}

    return (
        jsonify(
            {
                "submission": {
                    "id": submission.id,
                    "file_name": file_name,
                    "submitted_at": submission.submitted_at.isoformat() if getattr(submission, "submitted_at", None) else None,
                },
                "submitted_by": submitted_by,
                "locked": False,
            }
        ),
        200,
    )


@bp.route("/my_submission/<int:assignment_id>", methods=["DELETE"])
@jwt_role_required("student")
def delete_my_submission(assignment_id):
    """Delete the current student's submission for a standard assignment (if any)."""
    assignment = Assignment.get_by_id(assignment_id)
    if not assignment:
        return jsonify({"msg": "Assignment not found"}), 404

    assignment_type = getattr(assignment, "assignment_type", None) or "standard"
    if assignment_type != "standard":
        return jsonify({"msg": "This assignment does not accept file submissions"}), 400

    email = get_jwt_identity()
    user = User.get_by_email(email)
    if not user:
        return jsonify({"msg": "User not found"}), 404

    enrollment = User_Course.get(user.id, assignment.courseID)
    if not enrollment:
        return jsonify({"msg": "Unauthorized: You are not enrolled in this course"}), 403

    submission = Submission.query.filter_by(studentID=user.id, assignmentID=assignment.id).first()
    if not submission:
        return jsonify({"msg": "No submission to delete"}), 200

    if submission.path:
        uploads_root = Path(current_app.instance_path) / "uploads"
        try:
            (uploads_root / submission.path).unlink(missing_ok=True)
        except Exception:
            pass

    db.session.delete(submission)
    db.session.commit()

    return jsonify({"msg": "Submission removed"}), 200


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

    submission = Submission.query.filter_by(studentID=user.id, assignmentID=assignment.id).first()
    if submission and submission.path:
        try:
            (uploads_root / submission.path).unlink(missing_ok=True)
        except Exception:
            pass

    uploaded_file.save(str(abs_path))
    rel_path = (rel_dir / storage_name).as_posix()

    now_local = datetime.now()
    if not submission:
        submission = Submission(path=rel_path, studentID=user.id, assignmentID=assignment.id, submitted_at=now_local)
        db.session.add(submission)
    else:
        submission.path = rel_path
        submission.submitted_at = now_local

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

        submitted_at = getattr(sub, "submitted_at", None)
        on_time = None
        if assignment.due_date and submitted_at:
            on_time = submitted_at <= assignment.due_date

        results.append(
            {
                "id": sub.id,
                "student": {
                    "id": student.id if student else sub.studentID,
                    "name": student.name if student else None,
                    "email": student.email if student else None,
                },
                "file_name": file_name,
                "submitted_at": submitted_at.isoformat() if submitted_at else None,
                "on_time": on_time,
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

    if not (user.is_admin() or is_owner_student or is_course_teacher):
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

    current_email = get_jwt_identity()
    user = User.get_by_email(current_email)
    if user and user.is_student():
        assignment_ids = [a.id for a in assignments]
        done_by_assignment_id = {aid: False for aid in assignment_ids}

        if assignment_ids:
            # Standard assignments: done when the student has a submission.
            standard_ids = [a.id for a in assignments if (a.assignment_type or "standard") == "standard"]
            if standard_ids:
                subs = (
                    Submission.query.filter(
                        Submission.studentID == user.id,
                        Submission.assignmentID.in_(standard_ids),
                    )
                    .with_entities(Submission.assignmentID)
                    .all()
                )
                for (aid,) in subs:
                    done_by_assignment_id[int(aid)] = True

            # Group peer eval: done when the student's group has submitted.
            group_ids = [a.id for a in assignments if (a.assignment_type or "standard") == "peer_eval_group"]
            my_group, _ = _get_user_group_for_course(user.id, class_id)
            if my_group and group_ids:
                included_rows = (
                    AssignmentIncludedGroup.query.filter(
                        AssignmentIncludedGroup.assignment_id.in_(group_ids),
                        AssignmentIncludedGroup.group_id == my_group.id,
                    )
                    .with_entities(AssignmentIncludedGroup.assignment_id)
                    .all()
                )
                included_assignment_ids = {int(aid) for (aid,) in included_rows}

                if included_assignment_ids:
                    group_subs = (
                        GroupEvaluationSubmission.query.filter(
                            GroupEvaluationSubmission.reviewer_group_id == my_group.id,
                            GroupEvaluationSubmission.assignment_id.in_(list(included_assignment_ids)),
                        )
                        .with_entities(GroupEvaluationSubmission.assignment_id)
                        .all()
                    )
                    for (aid,) in group_subs:
                        done_by_assignment_id[int(aid)] = True

            # Individual peer eval: done when all assigned reviews are completed.
            individual_ids = [a.id for a in assignments if (a.assignment_type or "standard") == "peer_eval_individual"]
            if individual_ids:
                reviews = Review.query.filter(
                    Review.reviewerID == user.id,
                    Review.assignmentID.in_(individual_ids),
                ).all()
                counts = {aid: {"total": 0, "completed": 0} for aid in individual_ids}
                for r in reviews:
                    entry = counts.get(int(r.assignmentID))
                    if entry is None:
                        continue
                    entry["total"] += 1
                    if r.completed:
                        entry["completed"] += 1

                for aid, entry in counts.items():
                    if entry["total"] > 0 and entry["completed"] == entry["total"]:
                        done_by_assignment_id[int(aid)] = True

        for row in assignments_data:
            try:
                aid = int(row.get("id"))
            except Exception:
                continue
            row["student_done"] = bool(done_by_assignment_id.get(aid, False))

    return jsonify(assignments_data), 200