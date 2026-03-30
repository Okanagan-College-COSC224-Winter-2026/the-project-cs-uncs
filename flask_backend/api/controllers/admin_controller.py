"""
Admin management endpoints
Only admin users can access these endpoints
"""

from flask import Blueprint, jsonify, request, current_app
from sqlalchemy.exc import IntegrityError
from flask_jwt_extended import get_jwt_identity
from werkzeug.security import generate_password_hash

from ..models import User, UserSchema, db, Review, Submission, GroupMember, User_Course, Course
from .auth_controller import jwt_admin_required

bp = Blueprint("admin", __name__, url_prefix="/admin")


@bp.route("/users", methods=["GET"])
@jwt_admin_required
def list_all_users():
    """List all users (admin only)"""
    users = User.query.all()
    current_app.logger.info(f"admin:list_all_users - returning {len(users)} users")
    return jsonify(UserSchema(many=True).dump(users)), 200


@bp.route("/users/create", methods=["POST"])
@jwt_admin_required
def create_user():
    """Create a new user with any role (admin only)"""
    if not request.is_json:
        return jsonify({"msg": "Missing JSON in request"}), 400

    name = request.json.get("name", None)
    password = request.json.get("password", None)
    email = request.json.get("email", None)
    role = request.json.get("role", "student")
    must_change_password = request.json.get("must_change_password", False)

    if not name:
        return jsonify({"msg": "Name is required"}), 400
    if not password:
        return jsonify({"msg": "Password is required"}), 400
    if not email:
        return jsonify({"msg": "Email is required"}), 400

    # Validate role
    if role not in ["student", "teacher", "admin"]:
        return jsonify({"msg": "Invalid role. Must be 'student', 'teacher', or 'admin'"}), 400

    # Check if user already exists
    existing_user = User.get_by_email(email)
    if existing_user:
        return jsonify({"msg": f"User with email {email} is already registered"}), 400

    # Create new user
    new_user = User(
        name=name,
        hash_pass=generate_password_hash(password),
        email=email,
        role=role,
        must_change_password=must_change_password
    )
    User.create_user(new_user)
    current_app.logger.info(f"admin:create_user - created user {new_user.email} role={new_user.role}")

    return (
        jsonify(
            {
                "msg": f"{role.capitalize()} account created successfully",
                "user": UserSchema().dump(new_user),
            }
        ),
        201,
    )


@bp.route("/users/<int:user_id>/role", methods=["PUT"])
@jwt_admin_required
def update_user_role(user_id):
    """Update a user's role (admin only)"""
    # Resolve invoking admin early to avoid ordering issues
    current_email = get_jwt_identity()
    if not request.is_json:
        return jsonify({"msg": "Missing JSON in request"}), 400

    new_role = request.json.get("role", None)

    if not new_role:
        return jsonify({"msg": "Role is required"}), 400

    # Validate role
    if new_role not in ["student", "teacher", "admin"]:
        return jsonify({"msg": "Invalid role. Must be 'student', 'teacher', or 'admin'"}), 400
    current_app.logger.info(f"admin:update_user_role - attempt by {current_email} to set user_id={user_id} -> role={new_role}")
    user = User.get_by_id(user_id)
    if not user:
        return jsonify({"msg": "User not found"}), 404

    # Prevent self-demotion from admin
    current_user = User.get_by_email(current_email)
    if current_user.id == user_id and new_role != "admin":
        return jsonify({"msg": "Cannot demote yourself from admin role"}), 400

    old_role = user.role
    user.role = new_role
    user.update()

    return (
        jsonify(
            {
                "msg": f"User role updated from {old_role} to {new_role}",
                "user": UserSchema().dump(user),
            }
        ),
        200,
    )


@bp.route("/users/<int:user_id>", methods=["DELETE"])
@jwt_admin_required
def delete_user(user_id):
    """Delete a user (admin only)"""
    current_email = get_jwt_identity()
    current_user = User.get_by_email(current_email)
    current_app.logger.info(f"admin:delete_user - attempt by {current_email} to delete user_id={user_id}")

    # Prevent self-deletion
    if current_user.id == user_id:
        return jsonify({"msg": "Cannot delete your own account"}), 400

    user = User.get_by_id(user_id)
    if not user:
        return jsonify({"msg": "User not found"}), 404

    try:
        # If user is a teacher, ensure they don't own any courses (prevents orphaned Course.teacherID)
        if user.role == "teacher":
            owned = Course.get_courses_by_teacher(user.id)
            if owned:
                return jsonify({
                    "msg": "Cannot delete teacher: user is assigned to one or more courses. Reassign or delete those courses first."
                }), 400

        # Delete dependent records that reference User.id (reviews, submissions, group memberships, course links)
        db.session.query(Review).filter((Review.reviewerID == user.id) | (Review.revieweeID == user.id)).delete(synchronize_session=False)
        db.session.query(Submission).filter(Submission.studentID == user.id).delete(synchronize_session=False)
        db.session.query(GroupMember).filter(GroupMember.user_id == user.id).delete(synchronize_session=False)
        db.session.query(User_Course).filter(User_Course.userID == user.id).delete(synchronize_session=False)

        # Finally delete the user record
        db.session.delete(user)
        db.session.commit()

    except IntegrityError as ie:
        current_app.logger.exception(f"admin:delete_user - integrity error deleting user_id={user_id}")
        db.session.rollback()
        return jsonify({
            "msg": "Cannot delete user: related records exist (reviews, submissions, etc.). Consider deactivating the account instead." 
        }), 400
    except Exception as e:
        current_app.logger.exception(f"admin:delete_user - unexpected error deleting user_id={user_id}: {e}")
        db.session.rollback()
        return jsonify({"msg": "Failed to delete user"}), 500

    return jsonify({"msg": "User deleted successfully"}), 200


@bp.route("/users/<int:user_id>", methods=["PUT"])
@jwt_admin_required
def update_user(user_id):
    """Update a user's name or email (admin only)"""
    if not request.is_json:
        return jsonify({"msg": "Missing JSON in request"}), 400

    name = request.json.get("name", None)
    email = request.json.get("email", None)

    if name is None and email is None:
        return jsonify({"msg": "Nothing to update"}), 400

    current_email = get_jwt_identity()
    current_app.logger.info(f"admin:update_user - attempt by {current_email} to update user_id={user_id} payload={request.json}")

    user = User.get_by_id(user_id)
    if not user:
        return jsonify({"msg": "User not found"}), 404

    # If email provided, check uniqueness
    if email:
        existing = User.get_by_email(email)
        if existing and existing.id != user_id:
            return jsonify({"msg": "Email already in use"}), 400
        user.email = email

    if name:
        user.name = name

    user.update()

    return jsonify({"msg": "User updated successfully", "user": UserSchema().dump(user)}), 200


@bp.route("/users/<int:user_id>/reset_password", methods=["POST"])
@jwt_admin_required
def reset_user_password(user_id):
    """Reset a user's password (admin only).

    Expects JSON: { "new_password": "...", "must_change_password": true|false }
    """
    if not request.is_json:
        return jsonify({"msg": "Missing JSON in request"}), 400

    new_password = request.json.get("new_password", None)
    must_change = request.json.get("must_change_password", True)

    if not new_password:
        return jsonify({"msg": "New password is required"}), 400
    if len(new_password) < 6:
        return jsonify({"msg": "New password must be at least 6 characters"}), 400

    current_email = get_jwt_identity()
    current_app.logger.info(f"admin:reset_user_password - admin {current_email} resetting password for user_id={user_id}")

    user = User.get_by_id(user_id)
    if not user:
        return jsonify({"msg": "User not found"}), 404

    # Update password and must_change_password flag
    user.hash_pass = generate_password_hash(new_password)
    user.must_change_password = bool(must_change)
    user.update()

    return jsonify({"msg": "Password reset successfully", "user": UserSchema().dump(user)}), 200
