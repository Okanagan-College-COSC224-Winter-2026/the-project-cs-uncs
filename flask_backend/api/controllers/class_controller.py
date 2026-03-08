from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required
from werkzeug.security import generate_password_hash

from ..models import Course, User, User_Course
from .auth_controller import jwt_teacher_required
import re
import csv
import io
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
            # Create new student with default password
            # TODO: Create random password and email it to the student
            # Current implementation sets the password to "password123"
            student = User(name=name, email=email, hash_pass=generate_password_hash("password123"), role="student")
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
