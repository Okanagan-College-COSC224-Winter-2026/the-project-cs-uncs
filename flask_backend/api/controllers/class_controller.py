from flask import Blueprint, current_app, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required
from werkzeug.security import generate_password_hash
from email.message import EmailMessage

from ..models import Course, User, User_Course
from .auth_controller import jwt_teacher_required
import re
import csv
import io
import os
import secrets
import smtplib
import ssl
import string
from typing import List, Dict, Tuple

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

    # Partial, case-insensitive match on the course name
    matches = Course.query.filter(Course.name.ilike(f"%{q}%")).all()

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

    if user.is_teacher():
        courses = Course.get_courses_by_teacher(user.id)
    elif user.is_admin():
        courses = Course.get_all_courses()
    elif user.is_student():
        user_courses = User_Course.get_courses_by_student(user.id)
        courses = [Course.get_by_id(uc.courseID) for uc in user_courses]
    else:
        courses = []

    return jsonify([{"id": c.id, "name": c.name} for c in courses]), 200


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

    enrollment.delete()
    return jsonify({"msg": f"Removed {student.email} from course {course.name}"}), 200

REQUIRED_HEADERS = {"id", "name", "email"}
def csv_to_list(csv_text):
    """Convert CSV text to a list of emails"""
    rows: List[Dict[str, str]] = []
    errors: List[str] = []
    if not csv_text or not csv_text.strip():
        return rows, ["CSV text empty"]
    
    stream = io.StringIO(csv_text.strip())
    try:
        reader = csv.DictReader(stream)
    except Exception as e:
        return rows, [f"Failed to read CSV: {e}"]
    
    headers = {h.strip() for h in reader.fieldnames or []}
    missing = REQUIRED_HEADERS - headers
    if missing:
        errors.append(f"Missing required headers: {', '.join(sorted(missing))}")
        return rows, errors
    
    for line_num, row in enumerate(reader, start=2):
        if row is None:
            continue
        normalized = {k.strip(): (v.strip() if isinstance(v, str) else "") for k, v in row.items()}
        if not any(normalized.values()):
            continue

        if any(not normalized[field] for field in REQUIRED_HEADERS):
            errors.append(f"Line {line_num}: Missing required fields")
            continue

        rows.append({
            "id": normalized["id"],
            "name": normalized["name"],
            "email": normalized["email"]
        })
    return rows, errors

@bp.route("/enroll_students", methods=["POST"])
@jwt_teacher_required
def enroll_students():
    """
    Enroll students into a class by class ID and list of student emails from a csv file.
    -    If a student is already enrolled, skip them.
    -    If a student email does not exist, create it with a default password and enroll them.
    -    The list of student emails is passed in the request body as a CSV file.
    """

    data = request.get_json()
    class_id = data.get("class_id")
    student_emails_csv = data.get("students", "")

    if not class_id or not student_emails_csv:
        return jsonify({"msg": "Class ID and student emails are required"}), 400

    course = Course.get_by_id(class_id)
    if not course:
        return jsonify({"msg": "Class not found"}), 404
    
    # check if the authenticated user is the teacher of the class
    email = get_jwt_identity()
    user = User.get_by_email(email)
    if course.teacherID != user.id:
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
            temp_password = _generate_temp_password()
            sent, reason = _send_new_account_email(
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

    return jsonify({"msg": f"{len(enrolled_students)} students added to course {course.name}"}), 200


def _parse_emails(value: str) -> List[str]:
    if not value:
        return []
    parts = re.split(r"[\s,;]+", value.strip())
    return [p.strip() for p in parts if p and p.strip()]


def _generate_temp_password(length: int = 16) -> str:
    alphabet = string.ascii_letters + string.digits + "!@#$%^&*"
    return "".join(secrets.choice(alphabet) for _ in range(length))


def _send_new_account_email(*, recipient: str, student_name: str, temp_password: str) -> Tuple[bool, str]:
    smtp_host = (
        current_app.config.get("SMTP_HOST")
        or current_app.config.get("MAIL_SERVER")
        or os.environ.get("SMTP_HOST")
        or os.environ.get("MAIL_SERVER")
    )
    smtp_port = int(
        current_app.config.get("SMTP_PORT")
        or current_app.config.get("MAIL_PORT")
        or os.environ.get("SMTP_PORT")
        or os.environ.get("MAIL_PORT")
        or 587
    )
    smtp_user = (
        current_app.config.get("SMTP_USER")
        or current_app.config.get("MAIL_USERNAME")
        or os.environ.get("SMTP_USER")
        or os.environ.get("MAIL_USERNAME")
    )
    smtp_pass = (
        current_app.config.get("SMTP_PASS")
        or current_app.config.get("MAIL_PASSWORD")
        or os.environ.get("SMTP_PASS")
        or os.environ.get("MAIL_PASSWORD")
    )
    from_email = (
        current_app.config.get("SMTP_FROM_EMAIL")
        or current_app.config.get("MAIL_DEFAULT_SENDER")
        or os.environ.get("SMTP_FROM_EMAIL")
        or os.environ.get("MAIL_DEFAULT_SENDER")
        or smtp_user
    )
    from_name = (
        current_app.config.get("SMTP_FROM_NAME")
        or os.environ.get("SMTP_FROM_NAME")
        or "Peer Evaluation App"
    )

    if not smtp_host or not from_email:
        return False, "SMTP is not configured (missing SMTP_HOST/MAIL_SERVER or sender)."

    use_ssl = str(
        current_app.config.get("SMTP_USE_SSL")
        or os.environ.get("SMTP_USE_SSL")
        or "false"
    ).lower() in {"1", "true", "yes", "on"}

    message = EmailMessage()
    message["Subject"] = "Your new Peer Evaluation account"
    message["From"] = f"{from_name} <{from_email}>"
    message["To"] = recipient
    message.set_content(
        (
            f"Hello {student_name},\n\n"
            "An account has been created for you in the Peer Evaluation App.\n\n"
            f"Email: {recipient}\n"
            f"Temporary password: {temp_password}\n\n"
            "Please sign in and change your password immediately.\n"
        )
    )

    try:
        context = ssl.create_default_context()
        if use_ssl or smtp_port == 465:
            server = smtplib.SMTP_SSL(smtp_host, smtp_port, timeout=15, context=context)
        else:
            server = smtplib.SMTP(smtp_host, smtp_port, timeout=15)

        with server:
            server.ehlo()
            if not (use_ssl or smtp_port == 465):
                server.starttls(context=context)
                server.ehlo()
            if smtp_user and smtp_pass:
                server.login(smtp_user, smtp_pass)
            server.send_message(message)
        return True, ""
    except Exception as e:
        return False, str(e)


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
            temp_password = _generate_temp_password()
            sent, reason = _send_new_account_email(
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

    return (
        jsonify(
            {
                "msg": f"{len(enrolled)} students added to course {course.name}",
                "enrolled": enrolled,
                "skipped": skipped,
                "errors": errors,
            }
        ),
        200,
    )


# Add this endpoint to flask_backend/api/controllers/class_controller.py

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
