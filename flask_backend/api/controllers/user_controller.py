"""
User management endpoints
"""

from pathlib import Path

from flask import Blueprint, current_app, jsonify, request, send_from_directory
from flask_jwt_extended import create_access_token, get_jwt_identity, jwt_required, set_access_cookies
from marshmallow import Schema, ValidationError, fields, validate
from werkzeug.utils import secure_filename
from werkzeug.security import check_password_hash, generate_password_hash

from ..models import User, UserSchema

bp = Blueprint("user", __name__, url_prefix="/user")

# Create schema instances once (reusable)
user_schema = UserSchema()


class UserUpdateSchema(Schema):
    """Schema for updating user information"""

    name = fields.Str(validate=validate.Length(min=1, max=255))


user_update_schema = UserUpdateSchema()


@bp.route("/", methods=["GET"])
@jwt_required()
def get_current_user():
    """Get current authenticated user information"""
    email = get_jwt_identity()
    user = User.get_by_email(email)

    if not user:
        return jsonify({"msg": "User not found"}), 404
    return jsonify(user_schema.dump(user)), 200


@bp.route("/photo", methods=["GET"])
@jwt_required()
def get_current_user_photo():
    """Fetch the current user's profile photo (if one exists)."""
    email = get_jwt_identity()
    user = User.get_by_email(email)
    if not user:
        return jsonify({"msg": "User not found"}), 404

    uploads_root = Path(current_app.instance_path) / "uploads" / "profile_photos"
    if not uploads_root.exists():
        return jsonify({"msg": "No photo"}), 404

    matches = sorted(uploads_root.glob(f"user_{user.id}.*"))
    if not matches:
        return jsonify({"msg": "No photo"}), 404

    photo_path = matches[0]
    return send_from_directory(str(uploads_root), photo_path.name, as_attachment=False)


@bp.route("/photo", methods=["POST"])
@jwt_required()
def upload_current_user_photo():
    """Upload or replace the current user's profile photo."""
    email = get_jwt_identity()
    user = User.get_by_email(email)
    if not user:
        return jsonify({"msg": "User not found"}), 404

    uploaded_file = request.files.get("file")
    if not uploaded_file or not uploaded_file.filename:
        return jsonify({"msg": "File is required"}), 400

    safe_name = secure_filename(uploaded_file.filename)
    ext = Path(safe_name).suffix.lower()
    allowed_exts = {".png", ".jpg", ".jpeg", ".gif", ".webp"}
    if ext not in allowed_exts:
        return jsonify({"msg": "Unsupported file type"}), 400

    uploads_root = Path(current_app.instance_path) / "uploads" / "profile_photos"
    uploads_root.mkdir(parents=True, exist_ok=True)

    # Remove any prior photo for this user (regardless of extension)
    for existing in uploads_root.glob(f"user_{user.id}.*"):
        try:
            existing.unlink(missing_ok=True)
        except Exception:
            pass

    storage_name = f"user_{user.id}{ext}"
    uploaded_file.save(str(uploads_root / storage_name))

    return jsonify({"msg": "Photo uploaded"}), 200


@bp.route("/<int:user_id>", methods=["GET"])
@jwt_required()
def get_user_by_id(user_id):
    """Get user by ID (users can view their own info, teachers/admins can view anyone)"""
    current_email = get_jwt_identity()
    current_user = User.get_by_email(current_email)

    if not current_user:
        return jsonify({"msg": "User not found"}), 404

    user = User.get_by_id(user_id)
    if not user:
        return jsonify({"msg": "User not found"}), 404

    # Users can view their own info, teachers and admins can view anyone
    if current_user.id != user_id and not current_user.has_role("teacher", "admin"):
        return jsonify({"msg": "Insufficient permissions"}), 403

    return jsonify(user_schema.dump(user)), 200


@bp.route("/", methods=["PUT"])
@jwt_required()
def update_current_user():
    """Update current user information"""
    if not request.is_json:
        return jsonify({"msg": "Missing JSON in request"}), 400

    # Validate input with Marshmallow
    try:
        data = user_update_schema.load(request.json)
    except ValidationError as err:
        return jsonify({"msg": "Validation error", "errors": err.messages}), 400

    email = get_jwt_identity()
    user = User.get_by_email(email)

    if not user:
        return jsonify({"msg": "User not found"}), 404

    # Update allowed fields
    if "name" in data:
        user.name = data["name"]

    user.update()

    return jsonify(user_schema.dump(user)), 200


@bp.route("/<int:user_id>", methods=["DELETE"])
@jwt_required()
def delete_user(user_id):
    """Delete user (admin only or own account)"""
    current_email = get_jwt_identity()
    current_user = User.get_by_email(current_email)

    if not current_user:
        return jsonify({"msg": "User not found"}), 404

    user = User.get_by_id(user_id)
    if not user:
        return jsonify({"msg": "User not found"}), 404

    # Users can delete their own account, admins can delete anyone
    if current_user.id != user_id and not current_user.is_admin():
        return jsonify({"msg": "Insufficient permissions"}), 403

    user.delete()

    return jsonify({"msg": "User deleted successfully"}), 200


@bp.route("/password", methods=["PATCH"])
@jwt_required()
def change_password():
    """Change current user's password.

    Any authenticated user may change their own password by providing
    the correct current password and a valid new password.  When the
    ``must_change_password`` flag is set (e.g. admin-created accounts),
    it is automatically cleared after a successful change.
    """
    if not request.is_json:
        return jsonify({"msg": "Missing JSON in request"}), 400

    current_password = request.json.get("current_password", None)
    new_password = request.json.get("new_password", None)

    if not current_password:
        return jsonify({"msg": "Current password is required"}), 400
    if not new_password:
        return jsonify({"msg": "New password is required"}), 400
    if len(new_password) < 6:
        return jsonify({"msg": "New password must be at least 6 characters"}), 400

    email = get_jwt_identity()
    user = User.get_by_email(email)

    if not user:
        return jsonify({"msg": "User not found"}), 404

    # Verify current password
    if not check_password_hash(user.hash_pass, current_password):
        return jsonify({"msg": "Current password is incorrect"}), 401

    # Update password and clear must_change_password flag if set
    user.hash_pass = generate_password_hash(new_password)
    user.must_change_password = False
    user.update()

    # Reissue a fresh JWT so the embedded must_change_password claim
    # is updated (the old token still carries the stale value).
    access_token = create_access_token(identity=email)
    response = jsonify({"msg": "Password updated successfully"})
    set_access_cookies(response, access_token)
    return response, 200
