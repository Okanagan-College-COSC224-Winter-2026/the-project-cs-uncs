"""Class controller - handles class and enrollment operations."""

from pathlib import Path

from flask import Blueprint, current_app, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required
from sqlalchemy import func
from werkzeug.security import generate_password_hash

import csv
import io
import re
from typing import List, Dict

from ..models import (
    Assignment,
    CriteriaDescription,
    Course,
    Criterion,
    Group,
    GroupEvaluationCriterion,
    GroupEvaluationSubmission,
    GroupEvaluationTarget,
    GroupMember,
    Review,
    Rubric,
    Submission,
    User,
    User_Course,
    db,
)
from ..services import generate_temp_password, send_new_account_email
from .auth_controller import jwt_teacher_required

bp = Blueprint("class", __name__, url_prefix="/class")


@bp.route("/create_class", methods=["POST"])
@jwt_teacher_required
def create_class():
    """Create a new class where the authenticated user is the teacher"""
    data = request.get_json()
    class_name = data.get("name")
    if not class_name:
        return jsonify({"msg": "Class name is required"}), 400

    email = get_jwt_identity()
    user = User.get_by_email(email)
    if not user:
        return jsonify({"msg": "User not found"}), 404

    existing_class = Course.get_by_name(class_name)
    if existing_class:
        return jsonify({"msg": "Class already exists"}), 400

    new_class = Course(teacherID=user.id, name=class_name)
    Course.create_course(new_class)
    return jsonify({"msg": "Class created", "class": {"id": new_class.id}}), 201


@bp.route("/delete_class/<int:class_id>", methods=["DELETE"])
@jwt_teacher_required
def delete_class(class_id: int):
    """Delete a course.

    Allowed for:
      - Admin
      - The course's teacher
    """
    course = Course.get_by_id(class_id)
    if not course:
        return jsonify({"msg": "Class not found"}), 404

    email = get_jwt_identity()
    user = User.get_by_email(email)
    if not user:
        return jsonify({"msg": "User not found"}), 404

    if not user.is_admin() and course.teacherID != user.id:
        return jsonify({"msg": "Unauthorized: You are not the teacher of this class or an admin"}), 403

    # Clean up any assignment attachment files stored on disk. (The DB rows are
    # removed via cascades when deleting the course.)
    uploads_dir = Path(current_app.instance_path) / "uploads"
    attachment_rows = (
        Assignment.query.with_entities(Assignment.attachment_storage_name)
        .filter(Assignment.courseID == course.id, Assignment.attachment_storage_name.isnot(None))
        .all()
    )
    for (storage_name,) in attachment_rows:
        if not storage_name:
            continue
        try:
            (uploads_dir / storage_name).unlink(missing_ok=True)
        except Exception:
            pass

    db.session.delete(course)
    db.session.commit()

    return jsonify({"msg": "Class deleted"}), 200


@bp.route("/browse_classes", methods=["GET"])
@jwt_required()
def get_classes():
    """Retrieve all classes"""
    email = get_jwt_identity()
    user = User.get_by_email(email)
    if not user:
        return jsonify({"msg": "User not found"}), 404
    classes = Course.get_all_courses()
    return jsonify([{"id": c.id, "name": c.name} for c in classes]), 200


@bp.route("/search", methods=["GET"])
@jwt_required()
def search_classes():
    """Search classes by name (case-insensitive, partial match)

    Query params:
      - q: search string
    """
    q = request.args.get("q", "").strip()
    if not q:
        return jsonify({"results": [], "message": "Query parameter 'q' required"}), 400

    email = get_jwt_identity()
    user = User.get_by_email(email)
    if not user:
        return jsonify({"msg": "User not found"}), 404

    name_filter = Course.name.ilike(f"%{q}%")

    if user.is_admin():
        matches = Course.query.filter(name_filter).all()
    elif user.is_teacher():
        matches = Course.query.filter(name_filter, Course.teacherID == user.id).all()
    elif user.is_student():
        matches = (
            Course.query.join(User_Course, User_Course.courseID == Course.id)
            .filter(name_filter, User_Course.userID == user.id)
            .all()
        )
    else:
        matches = []

    results = []
    for c in matches:
        results.append({
            "id": c.id,
            "name": c.name,
            "teacher": {"id": c.teacher.id if c.teacher else None, "name": c.teacher.name if c.teacher else None},
            "student_count": len(c.students) if c.students is not None else 0,
        })

    if not results:
        return jsonify({"results": [], "message": "No courses found"}), 200

    return jsonify({"results": results}), 200


@bp.route("/classes", methods=["GET"])
@jwt_required()
def get_user_classes():
    """Retrieve classes for the authenticated user (if user is a student look up User_Course, if teacher look up Course, else return empty)"""
    email = get_jwt_identity()
    user = User.get_by_email(email)
    if not user:
        return jsonify({"msg": "User not found"}), 404

    course_rows: list[tuple[int, str]]
    if user.is_teacher():
        course_rows = (
            Course.query.filter(Course.teacherID == user.id)
            .with_entities(Course.id, Course.name)
            .all()
        )
    elif user.is_admin():
        course_rows = Course.query.with_entities(Course.id, Course.name).all()
    elif user.is_student():
        course_rows = (
            Course.query.join(User_Course, User_Course.courseID == Course.id)
            .filter(User_Course.userID == user.id)
            .with_entities(Course.id, Course.name)
            .all()
        )
    else:
        course_rows = []

    course_ids = [int(cid) for (cid, _name) in course_rows]
    counts_by_course_id: dict[int, int] = {}
    if course_ids:
        counts = (
            db.session.query(Assignment.courseID, func.count(Assignment.id))
            .filter(Assignment.courseID.in_(course_ids))
            .group_by(Assignment.courseID)
            .all()
        )
        counts_by_course_id = {int(course_id): int(cnt) for (course_id, cnt) in counts}

    return (
        jsonify(
            [
                {
                    "id": int(course_id),
                    "name": name,
                    "assignmentCount": int(counts_by_course_id.get(int(course_id), 0)),
                }
                for (course_id, name) in course_rows
            ]
        ),
        200,
    )


@bp.route("/members", methods=["POST"])
@jwt_required()
def get_course_members():
    """Return enrolled student members of a course.

    Body accepts any of:
      { "id": <course_id> }
      { "class_id": <course_id> }
      { "course_id": <course_id> }

    Allowed for:
      - Admin
      - The course's teacher
      - A student enrolled in the course
    """
    data = request.get_json(silent=True) or {}
    course_id = data.get("id") or data.get("class_id") or data.get("course_id")
    if not course_id:
        return jsonify({"msg": "Course ID is required"}), 400

    course = Course.get_by_id(course_id)
    if not course:
        return jsonify({"msg": "Class not found"}), 404

    email = get_jwt_identity()
    user = User.get_by_email(email)
    if not user:
        return jsonify({"msg": "User not found"}), 404

    is_course_teacher = user.is_teacher() and course.teacherID == user.id
    is_enrolled_student = user.is_student() and User_Course.get(user.id, course.id) is not None
    if not (user.is_admin() or is_course_teacher or is_enrolled_student):
        return jsonify({"msg": "Unauthorized"}), 403

    students = course.students.all() if hasattr(course.students, "all") else list(course.students)
    results = [
        {"id": s.id, "name": s.name, "email": s.email, "role": s.role}
        for s in students
        if s is not None
    ]

    return jsonify(results), 200


@bp.route("/remove_member", methods=["POST"])
@jwt_teacher_required
def remove_course_member():
    """Remove a student from a class.

    Body accepts:
      { "class_id": <course_id>, "user_id": <student_user_id> }
    """
    data = request.get_json(silent=True) or {}
    class_id = data.get("class_id") or data.get("course_id")
    user_id = data.get("user_id") or data.get("student_id")

    if not class_id or not user_id:
        return jsonify({"msg": "Class ID and user ID are required"}), 400

    course = Course.get_by_id(class_id)
    if not course:
        return jsonify({"msg": "Class not found"}), 404

    current_email = get_jwt_identity()
    current_user = User.get_by_email(current_email)
    if not current_user:
        return jsonify({"msg": "User not found"}), 404

    if not current_user.is_admin() and course.teacherID != current_user.id:
        return jsonify({"msg": "You are not authorized to remove members from this class"}), 403

    if int(user_id) == int(current_user.id):
        return jsonify({"msg": "Cannot remove yourself from the class"}), 400

    student = User.get_by_id(user_id)
    if not student:
        return jsonify({"msg": "User not found"}), 404
    if student.id == course.teacherID:
        return jsonify({"msg": "Cannot remove the course teacher"}), 400

    enrollment = User_Course.get(student.id, course.id)
    if not enrollment:
        return jsonify({"msg": "User is not enrolled in this class"}), 404

    # Remove the student from any group(s) for this course.
    group_id_rows = db.session.query(Group.id).filter(Group.course_id == course.id).all()
    group_ids = [int(gid) for (gid,) in group_id_rows]
    if group_ids:
        (
            GroupMember.query.filter(
                GroupMember.user_id == student.id,
                GroupMember.group_id.in_(group_ids),
            ).delete(synchronize_session=False)
        )

    # Delete any *incomplete* individual peer-eval reviews involving this student.
    # Otherwise remaining students can end up with reviews that can never be submitted
    # (eligibility checks depend on current group membership).
    assignment_id_rows = (
        db.session.query(Assignment.id)
        .filter(
            Assignment.courseID == course.id,
            Assignment.assignment_type == "peer_eval_individual",
        )
        .all()
    )
    assignment_ids = [int(aid) for (aid,) in assignment_id_rows]
    if assignment_ids:
        # Remove feedback authored by the removed student so it no longer appears
        # in other students' "My Feedback" view.
        # Also remove any *incomplete* reviews targeting the removed student to
        # prevent other students from being stuck with un-submittable tasks.
        reviews_to_delete = (
            Review.query.filter(
                Review.assignmentID.in_(assignment_ids),
                (Review.reviewerID == student.id)
                | ((Review.revieweeID == student.id) & (Review.completed.is_(False))),
            ).all()
        )
        for r in reviews_to_delete:
            db.session.delete(r)

    # Remove enrollment last, then commit once for atomic cleanup.
    db.session.delete(enrollment)
    db.session.commit()

    return jsonify({"msg": f"Removed {student.email} from course {course.name}"}), 200

FULL_HEADERS = {"id", "name", "email"}


def _normalize_csv_header(value: str) -> str:
    if value is None:
        return ""
    normalized = str(value).strip()
    # Handle UTF-8 BOM that Excel commonly adds at the start of the first header
    normalized = normalized.lstrip("\ufeff")
    return normalized.strip().lower()


def csv_to_list(csv_text):
    """Convert CSV text to a list of student dicts.

    Supported formats:
    - Emails-only CSV (single column), header optional. Examples:
        email\nstudent@example.com
        student@example.com\nother@example.com
    - Full roster CSV with headers containing id,name,email (case-insensitive)

    Returns: (rows, errors)
      rows: [{"email": str, "name": str, "id": str}]
    """
    rows: List[Dict[str, str]] = []
    errors: List[str] = []

    if not csv_text or not str(csv_text).strip():
        return rows, ["CSV text empty"]

    # Strip whitespace and BOM at start of file content (not just header cell)
    cleaned_text = str(csv_text).strip().lstrip("\ufeff")
    stream = io.StringIO(cleaned_text)

    try:
        reader = csv.reader(stream)
        all_rows = [r for r in reader if r and any((c or "").strip() for c in r)]
    except Exception as e:
        return rows, [f"Failed to read CSV: {e}"]

    if not all_rows:
        return rows, ["CSV text empty"]

    first = [(_normalize_csv_header(c)) for c in all_rows[0]]
    is_header = any(c in {"email", "name", "id"} for c in first)

    email_idx: int | None = None
    name_idx: int | None = None
    id_idx: int | None = None

    start_row = 0
    if is_header:
        start_row = 1
        if "email" in first:
            email_idx = first.index("email")
        if "name" in first:
            name_idx = first.index("name")
        if "id" in first:
            id_idx = first.index("id")

        if email_idx is None:
            return rows, ["Missing required header: email"]
    else:
        # No header: treat each non-empty cell as an email.
        email_idx = None
        name_idx = None

    for row_num, row in enumerate(all_rows[start_row:], start=(start_row + 1)):
        def _get_cell(idx: int | None) -> str:
            if idx is None:
                return ""
            if idx >= len(row):
                return ""
            value = row[idx]
            return value.strip() if isinstance(value, str) else ""

        if is_header:
            email = _get_cell(email_idx)
            if not email:
                errors.append(f"Line {row_num}: Missing email")
                continue

            name = _get_cell(name_idx)
            if not name:
                name = email.split("@", 1)[0]

            student_id = _get_cell(id_idx)
            rows.append({"id": student_id, "name": name, "email": email})
            continue

        # Emails-only, headerless: allow comma-separated cells on a single line,
        # multiple lines, and ignore trailing commas/empty cells.
        candidates: List[str] = []
        for cell in row:
            if not isinstance(cell, str):
                continue
            cell_value = cell.strip()
            if not cell_value:
                continue
            # If someone put multiple emails into one cell separated by whitespace/semicolon,
            # split those as well.
            candidates.extend([p for p in re.split(r"[\s;]+", cell_value) if p and p.strip()])

        if not candidates:
            continue

        for email in candidates:
            if not email:
                continue
            name = email.split("@", 1)[0]
            rows.append({"id": "", "name": name, "email": email})

    return rows, errors


def _parse_emails(value: str) -> List[str]:
    if not value:
        return []
    parts = re.split(r"[\s,;]+", value.strip())
    return [p.strip() for p in parts if p and p.strip()]


@bp.route("/enroll_students", methods=["POST"])
@jwt_teacher_required
def enroll_students():
    """
    Enroll students into a class by class ID and list of student emails from a csv file.
    - If a student is already enrolled, skip them.
    - If a student email does not exist, create the account with a temporary password and email it.
    - The list of student emails is passed in the request body as CSV text.
    """

    data = request.get_json()
    class_id = data.get("class_id")
    student_emails_csv = data.get("students", "")

    if not class_id or not student_emails_csv:
        return jsonify({"msg": "Class ID and student emails are required"}), 400

    course = Course.get_by_id(class_id)
    if not course:
        return jsonify({"msg": "Class not found"}), 404
    
    # check if the authenticated user is the teacher of the class (admins may enroll too)
    email = get_jwt_identity()
    user = User.get_by_email(email)
    if not user:
        return jsonify({"msg": "User not found"}), 404
    if not user.is_admin() and course.teacherID != user.id:
        return jsonify({"msg": "You are not authorized to enroll students in this class"}), 403

    students, parse_errors = csv_to_list(student_emails_csv)
    if parse_errors:
        return jsonify({"msg": "Errors in CSV", "errors": parse_errors}), 400

    enrolled_students = []
    for student_info in students:
        email = student_info["email"]
        # validate email format with regex
        if not re.match(r"[^@]+@[^@]+\.[^@]+", email):
            return jsonify({"msg": f"Invalid email format: {email}"}), 400
        
        name = student_info["name"]
        student = User.get_by_email(email)
        if not student:
            temp_password = generate_temp_password()
            sent, reason = send_new_account_email(
                recipient=email,
                student_name=name,
                temp_password=temp_password,
            )
            if not sent:
                return (
                    jsonify(
                        {
                            "msg": f"Could not create user {email} because welcome email could not be sent",
                            "error": reason,
                        }
                    ),
                    500,
                )

            student = User(
                name=name,
                email=email,
                hash_pass=generate_password_hash(temp_password),
                role="student",
                must_change_password=True,
            )
            try:
                User.create_user(student)
            except Exception as e:
                return jsonify({"msg": f"Error creating user {email}: {str(e)}"}), 500

        # Check if already enrolled
        enrollment = User_Course.get(student.id, class_id)
        if not enrollment:
            # Enroll student
            User_Course.add(student.id, class_id)
            enrolled_students.append(email)

    enrolled_count = len(enrolled_students)
    noun = "student" if enrolled_count == 1 else "students"
    return jsonify({"msg": f"{enrolled_count} {noun} added to course {course.name}"}), 200


@bp.route("/enroll_students_emails", methods=["POST"])
@jwt_teacher_required
def enroll_students_emails():
    """Enroll students into a class by providing emails directly (no CSV).

    Body:
      {
        "class_id": number,
        "emails": "a@x.com, b@y.com"  # comma/space/newline separated
      }
    """
    data = request.get_json(silent=True) or {}
    class_id = data.get("class_id")
    emails_value = data.get("emails", "")

    if not class_id or not str(emails_value).strip():
        return jsonify({"msg": "Class ID and emails are required"}), 400

    course = Course.get_by_id(class_id)
    if not course:
        return jsonify({"msg": "Class not found"}), 404

    # check if the authenticated user is the teacher of the class
    current_email = get_jwt_identity()
    user = User.get_by_email(current_email)
    if not user:
        return jsonify({"msg": "User not found"}), 404
    if not user.is_admin() and course.teacherID != user.id:
        return jsonify({"msg": "You are not authorized to enroll students in this class"}), 403

    emails = _parse_emails(str(emails_value))
    if not emails:
        return jsonify({"msg": "No valid emails provided"}), 400

    enrolled: List[str] = []
    skipped: List[str] = []
    errors: List[str] = []

    for email in emails:
        if not re.match(r"[^@]+@[^@]+\.[^@]+", email):
            errors.append(f"Invalid email format: {email}")
            continue

        student = User.get_by_email(email)
        if not student:
            # Default name: use local-part of email
            default_name = email.split("@", 1)[0]
            temp_password = generate_temp_password()
            sent, reason = send_new_account_email(
                recipient=email,
                student_name=default_name,
                temp_password=temp_password,
            )
            if not sent:
                errors.append(
                    f"Could not create user {email} because welcome email could not be sent: {reason}"
                )
                continue

            student = User(
                name=default_name,
                email=email,
                hash_pass=generate_password_hash(temp_password),
                role="student",
                must_change_password=True,
            )
            try:
                User.create_user(student)
            except Exception as e:
                errors.append(f"Error creating user {email}: {str(e)}")
                continue
        elif not student.is_student():
            errors.append(f"User {email} is not a student")
            continue

        enrollment = User_Course.get(student.id, class_id)
        if enrollment:
            skipped.append(email)
            continue

        try:
            User_Course.add(student.id, class_id)
            enrolled.append(email)
        except Exception as e:
            errors.append(f"Error enrolling {email}: {str(e)}")

    enrolled_count = len(enrolled)
    noun = "student" if enrolled_count == 1 else "students"
    return (
        jsonify(
            {
                "msg": f"{enrolled_count} {noun} added to course {course.name}",
                "enrolled": enrolled,
                "skipped": skipped,
                "errors": errors,
            }
        ),
        200,
    )


@bp.route("/available_courses", methods=["GET"])
@jwt_required()
def get_available_courses():
    """
    Get courses where the student's email is on the roster but they haven't enrolled yet.
    This is used for roster-matched registration.

    Returns courses where:
    1. Student exists in User_Course (added via CSV upload)
    2. Student's account was created (with default password)

    A student uses this to discover courses they were added to and can join.
    """
    email = get_jwt_identity()
    user = User.get_by_email(email)

    if not user or user.role != 'student':
        return jsonify({"msg": "Only students can access this endpoint"}), 403

    # Get all courses where this student is on the roster
    user_courses = User_Course.get_courses_by_student(user.id)
    courses = [Course.get_by_id(uc.courseID) for uc in user_courses]

    course_list = [{
        "id": c.id,
        "name": c.name,
        "teacherID": c.teacherID,
        "teacher_name": c.teacher.name if c.teacher else "Unknown"
    } for c in courses if c]

    return jsonify(course_list), 200


@bp.route("/join_course", methods=["POST"])
@jwt_required()
def join_roster_course():
    """
    Student joins a course they were added to via roster upload.
    This creates the User_Course link if it doesn't exist.

    Body: { "course_id": number }
    """
    email = get_jwt_identity()
    user = User.get_by_email(email)

    if not user or user.role != 'student':
        return jsonify({"msg": "Only students can join courses"}), 403

    data = request.get_json()
    course_id = data.get("course_id")

    if not course_id:
        return jsonify({"msg": "Course ID is required"}), 400

    course = Course.get_by_id(course_id)
    if not course:
        return jsonify({"msg": "Course not found"}), 404

    # Check if already enrolled
    enrollment = User_Course.get(user.id, course_id)
    if enrollment:
        return jsonify({"msg": "Already enrolled in this course"}), 400

    # Join the course
    try:
        User_Course.add(user.id, course_id)
        return jsonify({"msg": f"Successfully joined course {course.name}"}), 200
    except Exception as e:
        return jsonify({"msg": f"Error joining course: {str(e)}"}), 500


@bp.route("/<int:class_id>/gradebook", methods=["GET"])
@jwt_required()
def get_gradebook(class_id: int):
    """Return gradebook data for a course (teacher/admin only).

    Response shape:
    {
      "assignments": [{"id": int, "name": str, "assignment_type": str, "max_points": int | null}, ...],
      "rows": [
        {
          "student": {"id": int, "name": str},
          "grades": {"<assignment_id>": float | null, ...},
          "feedback_counts": {"<assignment_id>": int | null, ...}
        },
        ...
      ]
    }
    """
    email = get_jwt_identity()
    user = User.get_by_email(email)
    if not user:
        return jsonify({"msg": "User not found"}), 404

    course = Course.get_by_id(class_id)
    if not course:
        return jsonify({"msg": "Class not found"}), 404

    is_course_teacher = user.is_teacher() and course.teacherID == user.id
    if not (user.is_admin() or is_course_teacher):
        return jsonify({"msg": "Unauthorized"}), 403

    assignments = (
        Assignment.query.filter_by(courseID=class_id)
        .order_by(Assignment.due_date.asc().nullslast(), Assignment.id.asc())
        .all()
    )
    students = course.students.all() if hasattr(course.students, "all") else list(course.students)

    assignment_ids = [a.id for a in assignments]
    assignment_max_points: dict[int, int | None] = {a.id: None for a in assignments}
    if assignment_ids:
        max_rows = (
            db.session.query(
                Rubric.assignmentID,
                func.coalesce(func.sum(CriteriaDescription.scoreMax), 0),
            )
            .outerjoin(CriteriaDescription, CriteriaDescription.rubricID == Rubric.id)
            .filter(Rubric.assignmentID.in_(assignment_ids))
            .group_by(Rubric.assignmentID)
            .all()
        )
        for assignment_id, max_points in max_rows:
            assignment_max_points[int(assignment_id)] = int(max_points)

    # Build lookups keyed by (student_id, assignment_id)
    grade_lookup: dict[tuple[int, int], float | None] = {}
    feedback_count_lookup: dict[tuple[int, int], int] = {}
    student_ids = [s.id for s in students]
    if assignments and students:
        submissions = (
            Submission.query
            .filter(
                Submission.assignmentID.in_(assignment_ids),
                Submission.studentID.in_(student_ids),
            )
            .all()
        )
        for sub in submissions:
            grade_lookup[(sub.studentID, sub.assignmentID)] = sub.grade

    # If no manual grade exists, backfill peer-eval assignments from scored criteria.
    individual_peer_assignments = [a.id for a in assignments if a.assignment_type == "peer_eval_individual"]
    if individual_peer_assignments and students:
        completed_count_rows = (
            db.session.query(
                Review.assignmentID,
                Review.revieweeID,
                func.count(Review.id),
            )
            .filter(
                Review.assignmentID.in_(individual_peer_assignments),
                Review.revieweeID.in_(student_ids),
                Review.completed.is_(True),
            )
            .group_by(Review.assignmentID, Review.revieweeID)
            .all()
        )
        for assignment_id, reviewee_id, completed_count in completed_count_rows:
            feedback_count_lookup[(int(reviewee_id), int(assignment_id))] = int(completed_count)

        received_rows = (
            db.session.query(
                Review.assignmentID,
                Review.revieweeID,
                func.coalesce(func.sum(Criterion.grade), 0),
            )
            .outerjoin(Criterion, Criterion.reviewID == Review.id)
            .filter(
                Review.assignmentID.in_(individual_peer_assignments),
                Review.revieweeID.in_(student_ids),
                Review.completed.is_(True),
            )
            .group_by(Review.assignmentID, Review.revieweeID)
            .all()
        )
        for assignment_id, reviewee_id, total_score in received_rows:
            key = (int(reviewee_id), int(assignment_id))
            if key not in grade_lookup or grade_lookup[key] is None:
                grade_lookup[key] = float(total_score)

    group_peer_assignments = [a.id for a in assignments if a.assignment_type == "peer_eval_group"]
    if group_peer_assignments and students:
        student_group_rows = (
            db.session.query(GroupMember.user_id, GroupMember.group_id)
            .join(Group, Group.id == GroupMember.group_id)
            .filter(Group.course_id == class_id, GroupMember.user_id.in_(student_ids))
            .all()
        )
        group_id_by_student_id = {int(user_id): int(group_id) for user_id, group_id in student_group_rows}

        group_totals_rows = (
            db.session.query(
                GroupEvaluationSubmission.assignment_id,
                GroupEvaluationTarget.reviewee_group_id,
                func.coalesce(func.sum(GroupEvaluationCriterion.grade), 0),
            )
            .join(
                GroupEvaluationTarget,
                GroupEvaluationTarget.submission_id == GroupEvaluationSubmission.id,
            )
            .outerjoin(
                GroupEvaluationCriterion,
                GroupEvaluationCriterion.target_id == GroupEvaluationTarget.id,
            )
            .filter(GroupEvaluationSubmission.assignment_id.in_(group_peer_assignments))
            .group_by(
                GroupEvaluationSubmission.assignment_id,
                GroupEvaluationTarget.reviewee_group_id,
            )
            .all()
        )
        group_count_rows = (
            db.session.query(
                GroupEvaluationSubmission.assignment_id,
                GroupEvaluationTarget.reviewee_group_id,
                func.count(GroupEvaluationTarget.id),
            )
            .join(
                GroupEvaluationTarget,
                GroupEvaluationTarget.submission_id == GroupEvaluationSubmission.id,
            )
            .filter(GroupEvaluationSubmission.assignment_id.in_(group_peer_assignments))
            .group_by(
                GroupEvaluationSubmission.assignment_id,
                GroupEvaluationTarget.reviewee_group_id,
            )
            .all()
        )
        total_by_assignment_and_group = {
            (int(assignment_id), int(group_id)): float(total_score)
            for assignment_id, group_id, total_score in group_totals_rows
        }
        count_by_assignment_and_group = {
            (int(assignment_id), int(group_id)): int(review_count)
            for assignment_id, group_id, review_count in group_count_rows
        }

        for student_id, group_id in group_id_by_student_id.items():
            for assignment_id in group_peer_assignments:
                review_count = count_by_assignment_and_group.get((assignment_id, group_id))
                if review_count is not None:
                    feedback_count_lookup[(student_id, assignment_id)] = review_count
                total_score = total_by_assignment_and_group.get((assignment_id, group_id))
                if total_score is None:
                    continue
                key = (student_id, assignment_id)
                if key not in grade_lookup or grade_lookup[key] is None:
                    grade_lookup[key] = total_score

    rows = []
    for student in sorted(students, key=lambda s: s.name):
        grades = {}
        feedback_counts = {}
        for assignment in assignments:
            key = (student.id, assignment.id)
            grades[str(assignment.id)] = grade_lookup.get(key)
            feedback_counts[str(assignment.id)] = feedback_count_lookup.get(key)
        rows.append({
            "student": {"id": student.id, "name": student.name},
            "grades": grades,
            "feedback_counts": feedback_counts,
        })

    return jsonify({
        "assignments": [
            {
                "id": a.id,
                "name": a.name,
                "assignment_type": a.assignment_type,
                "max_points": assignment_max_points.get(a.id),
            }
            for a in assignments
        ],
        "rows": rows,
    }), 200


@bp.route("/<int:class_id>/gradebook/<int:student_id>/<int:assignment_id>", methods=["PATCH"])
@jwt_required()
def update_grade(class_id: int, student_id: int, assignment_id: int):
    """Update a student's grade for an assignment (teacher/admin only).

    Body: { "grade": number | null }
    """
    email = get_jwt_identity()
    user = User.get_by_email(email)
    if not user:
        return jsonify({"msg": "User not found"}), 404

    course = Course.get_by_id(class_id)
    if not course:
        return jsonify({"msg": "Class not found"}), 404

    is_course_teacher = user.is_teacher() and course.teacherID == user.id
    if not (user.is_admin() or is_course_teacher):
        return jsonify({"msg": "Unauthorized"}), 403

    assignment = Assignment.get_by_id(assignment_id)
    if not assignment or assignment.courseID != class_id:
        return jsonify({"msg": "Assignment not found"}), 404

    student = User.get_by_id(student_id)
    if not student:
        return jsonify({"msg": "Student not found"}), 404

    enrollment = User_Course.get(student_id, class_id)
    if not enrollment:
        return jsonify({"msg": "Student is not enrolled in this class"}), 404

    data = request.get_json(silent=True) or {}
    grade_value = data.get("grade")

    if grade_value is not None:
        try:
            grade_value = float(grade_value)
        except (TypeError, ValueError):
            return jsonify({"msg": "Grade must be a number or null"}), 400
        if grade_value < 0:
            return jsonify({"msg": "Grade cannot be negative"}), 400

    submission = Submission.query.filter_by(
        studentID=student_id, assignmentID=assignment_id
    ).first()

    if submission is None:
        if grade_value is None:
            return jsonify({"grade": None}), 200
        # Create a grade-only submission (no file)
        submission = Submission(path=None, studentID=student_id, assignmentID=assignment_id)
        db.session.add(submission)

    submission.grade = grade_value
    db.session.commit()

    return jsonify({"grade": submission.grade}), 200
