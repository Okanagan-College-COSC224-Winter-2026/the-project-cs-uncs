from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from ..models import db, Group, GroupMember, User, Course, User_Course
from .auth_controller import jwt_teacher_required

bp = Blueprint("groups", __name__, url_prefix="/groups")

@bp.route("/course/<int:course_id>", methods=["POST"])
@jwt_teacher_required
def create_group(course_id):
    data = request.get_json()
    name = data.get("name")
    members = data.get("members") # List of user IDs

    if not name or not members:
        return jsonify({"msg": "Group name and members are required"}), 400

    email = get_jwt_identity()
    user = User.get_by_email(email)
    course = Course.get_by_id(course_id)

    if not course:
        return jsonify({"msg": "Course not found"}), 404
    
    if course.teacherID != user.id:
        return jsonify({"msg": "You are not the teacher of this course"}), 403

    new_group = Group.create(name=name, course_id=course_id)
    for user_id in members:
        GroupMember.add_member(group_id=new_group.id, user_id=user_id)

    return jsonify({"msg": "Group created successfully", "group_id": new_group.id}), 201

@bp.route("/course/<int:course_id>", methods=["GET"])
@jwt_required()
def get_groups_for_course(course_id):
    groups = Group.query.filter_by(course_id=course_id).all()
    response = []
    for group in groups:
        members = [{"id": m.user.id, "name": m.user.name} for m in group.members]
        response.append({
            "id": group.id,
            "name": group.name,
            "members": members
        })
    return jsonify(response), 200


@bp.route("/course/<int:course_id>/my", methods=["GET"])
@jwt_required()
def get_my_group_for_course(course_id):
    """Return the current user's group membership for a course.

    Returns:
      { "group": null } if the user isn't assigned to a group in this course.
      { "group": { id, name, course_id, members: [...] }, "multiple": bool } otherwise.

    Allowed for:
      - Admin
      - The course's teacher
      - A student enrolled in the course
    """
    course = Course.get_by_id(course_id)
    if not course:
        return jsonify({"msg": "Course not found"}), 404

    email = get_jwt_identity()
    user = User.get_by_email(email)
    if not user:
        return jsonify({"msg": "User not found"}), 404

    is_course_teacher = user.is_teacher() and course.teacherID == user.id
    is_enrolled_student = user.is_student() and User_Course.get(user.id, course.id) is not None
    if not (user.is_admin() or is_course_teacher or is_enrolled_student):
        return jsonify({"msg": "Unauthorized"}), 403

    groups = (
        Group.query.join(GroupMember, GroupMember.group_id == Group.id)
        .filter(Group.course_id == course_id, GroupMember.user_id == user.id)
        .all()
    )

    if not groups:
        return jsonify({"group": None}), 200

    group = groups[0]
    members = [
        {"id": m.user.id, "name": m.user.name, "email": m.user.email}
        for m in group.members
        if m.user is not None
    ]

    return (
        jsonify(
            {
                "group": {
                    "id": group.id,
                    "name": group.name,
                    "course_id": group.course_id,
                    "members": members,
                },
                "multiple": len(groups) > 1,
            }
        ),
        200,
    )

@bp.route("/<int:group_id>", methods=["GET"])
@jwt_required()
def get_group_details(group_id):
    group = Group.get_by_id(group_id)
    if not group:
        return jsonify({"msg": "Group not found"}), 404
    
    members = [{"id": m.user.id, "name": m.user.name, "email": m.user.email} for m in group.members]
    return jsonify({
        "id": group.id,
        "name": group.name,
        "course_id": group.course_id,
        "members": members
    }), 200

@bp.route("/<int:group_id>", methods=["DELETE"])
@jwt_teacher_required
def delete_group(group_id):
    group = Group.get_by_id(group_id)
    if not group:
        return jsonify({"msg": "Group not found"}), 404

    email = get_jwt_identity()
    user = User.get_by_email(email)
    course = Course.get_by_id(group.course_id)

    if course.teacherID != user.id:
        return jsonify({"msg": "You are not authorized to delete this group"}), 403

    group.delete()
    return jsonify({"msg": "Group deleted successfully"}), 200
