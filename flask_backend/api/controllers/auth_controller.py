import functools

from flask import Blueprint, jsonify, request
from flask_jwt_extended import (
    create_access_token,
    get_jwt_identity,
    jwt_required,
    set_access_cookies,
    unset_jwt_cookies,
)
from marshmallow import ValidationError
from werkzeug.security import check_password_hash, generate_password_hash

from ..models import User, UserLoginSchema, UserRegistrationSchema, UserSchema, User_Course, Course

bp = Blueprint("auth", __name__, url_prefix="/auth")

# Create schema instances once (reusable)
registration_schema = UserRegistrationSchema()
login_schema = UserLoginSchema()
user_schema = UserSchema()



@bp.route("/login", methods=["POST"])
def login():
    """Authenticate user and return JWT token in httponly cookie"""
    if not request.is_json:
        return jsonify({"msg": "Missing JSON in request"}), 400

    # Validate input with Marshmallow
    try:
        data = login_schema.load(request.json)
    except ValidationError as err:
        return jsonify({"msg": "Validation error", "errors": err.messages}), 400

    # Verify credentials
    user = User.get_by_email(data["email"])
    if user is None or not check_password_hash(user.hash_pass, data["password"]):
        return jsonify({"msg": "Bad email or password"}), 401

    # Generate access token and set as httponly cookie
    access_token = create_access_token(identity=data["email"])
    response = jsonify(user_schema.dump(user))
    set_access_cookies(response, access_token)
    return response, 200


@bp.route("/logout", methods=["POST"])
@jwt_required()
def logout():
    """
    Logout endpoint - clears the JWT cookie
    """
    response = jsonify({"msg": "Successfully logged out"})
    unset_jwt_cookies(response)
    return response, 200


# JWT-based decorators for API protection
def jwt_role_required(*roles):
    """Decorator to require specific role(s) for JWT-protected endpoints

    Usage:
        @jwt_role_required('admin')  # Only admins
        @jwt_role_required('teacher', 'admin')  # Teachers or admins
        @jwt_role_required('student', 'teacher', 'admin')  # Any authenticated user
    """

    def decorator(view):
        @functools.wraps(view)
        @jwt_required()
        def wrapped_view(*args, **kwargs):
            current_email = get_jwt_identity()
            user = User.get_by_email(current_email)

            if not user:
                return jsonify({"msg": "User not found"}), 404

            # Check if user has one of the required roles
            if roles and not user.has_role(*roles):
                return jsonify({"msg": "Insufficient permissions"}), 403

            return view(*args, **kwargs)

        return wrapped_view

    return decorator


def jwt_admin_required(view):
    """Decorator to require admin role for JWT-protected endpoints"""
    return jwt_role_required("admin")(view)


def jwt_teacher_required(view):
    """Decorator to require teacher or admin role for JWT-protected endpoints"""
    return jwt_role_required("teacher", "admin")(view)


# Modify the existing /auth/register endpoint

@bp.route("/register", methods=["POST"])
def register():
    """Register a new user account (student only - teachers/admins created by admins)"""
    if not request.is_json:
        return jsonify({"msg": "Missing JSON in request"}), 400

    # Validate input with Marshmallow
    try:
        data = registration_schema.load(request.json)
    except ValidationError as err:
        return jsonify({"msg": "Validation error", "errors": err.messages}), 400

    # Check if user already exists
    existing_user = User.get_by_email(data["email"])
    if existing_user:
        return jsonify({"msg": f"User with email {data['email']} is already registered"}), 400

    # Create new user (always student role for public registration)
    new_user = User(
        name=data["name"],
        hash_pass=generate_password_hash(data["password"]),
        email=data["email"],
        role="student",
    )
    User.create_user(new_user)

    # NEW: Check if this email was on any rosters (User_Course entries pre-created by teachers)
    user_courses = User_Course.get_courses_by_student(new_user.id)
    available_courses = []

    if user_courses:
        for uc in user_courses:
            course = Course.get_by_id(uc.courseID)
            if course:
                available_courses.append({
                    "id": course.id,
                    "name": course.name,
                    "teacher_name": course.teacher.name if course.teacher else "Unknown"
                })

    response_data = {
        "msg": "User registered successfully",
        "user": user_schema.dump(new_user),
        "available_courses": available_courses  # NEW: Pass roster courses
    }

    return jsonify(response_data), 201