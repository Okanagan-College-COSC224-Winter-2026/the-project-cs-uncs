from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from ..models import db, Group, GroupMember, User, Course, User_Course
from .auth_controller import jwt_teacher_required


def _get_current_user():
    email = get_jwt_identity()
    return User.get_by_email(email)


def _is_teacher_for_course(user: User, course: Course) -> bool:
    return bool(user and course and user.is_teacher() and course.teacherID == user.id)


def _can_manage_course_groups(user: User, course: Course) -> bool:
    return bool(user and course and (user.is_admin() or _is_teacher_for_course(user, course)))


def _can_view_course_groups(user: User, course: Course) -> bool:
    if not user or not course:
        return False
    if user.is_admin() or _is_teacher_for_course(user, course):
        return True
    return bool(user.is_student() and User_Course.get(user.id, course.id) is not None)


def _remove_user_from_other_course_groups(course_id: int, user_id: int, keep_group_id: int):
    """Ensure a user is only in one group for a course.

    Removes memberships in any other group within the same course.
    Does not affect memberships in groups belonging to other courses.
    """

    other_group_ids = [
        g.id
        for g in Group.query.filter_by(course_id=int(course_id)).filter(Group.id != int(keep_group_id)).all()
    ]
    if not other_group_ids:
        return

    (
        GroupMember.query.filter(
            GroupMember.user_id == int(user_id),
            GroupMember.group_id.in_(other_group_ids),
        ).delete(synchronize_session=False)
    )

bp = Blueprint("groups", __name__, url_prefix="/groups")

@bp.route("/course/<int:course_id>", methods=["POST"])
@jwt_teacher_required
def create_group(course_id):
    data = request.get_json(silent=True)
    if data is None:
        return jsonify({"msg": "Invalid or missing JSON in request body"}), 400
    name = data.get("name")
    members = data.get("members") # List of user IDs

    if not name or not members:
        return jsonify({"msg": "Group name and members are required"}), 400

    user = _get_current_user()
    course = Course.get_by_id(course_id)

    if not course:
        return jsonify({"msg": "Course not found"}), 404
    
    if not _can_manage_course_groups(user, course):
        return jsonify({"msg": "You are not the teacher of this course"}), 403

    new_group = Group.create(name=name, course_id=course_id)
    for user_id in members:
        member_user = User.get_by_id(int(user_id))
        if not member_user:
            continue
        if not member_user.is_student():
            continue
        if User_Course.get(member_user.id, course.id) is None:
            continue

        _remove_user_from_other_course_groups(course.id, member_user.id, new_group.id)
        existing = GroupMember.query.filter_by(group_id=new_group.id, user_id=member_user.id).first()
        if existing:
            continue
        GroupMember.add_member(group_id=new_group.id, user_id=member_user.id)

    db.session.commit()

    return jsonify({"msg": "Group created successfully", "group_id": new_group.id}), 201

@bp.route("/course/<int:course_id>", methods=["GET"])
@jwt_required()
def get_groups_for_course(course_id):
    course = Course.get_by_id(course_id)
    if not course:
        return jsonify({"msg": "Course not found"}), 404

    user = _get_current_user()
    if not user:
        return jsonify({"msg": "User not found"}), 404

    if not _can_view_course_groups(user, course):
        return jsonify({"msg": "Unauthorized"}), 403

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
        {
            "id": m.user.id,
            "name": m.user.name,
            "preferred_name": (m.user.preferred_name or "").strip() or m.user.name,
            "preferred_pronouns": m.user.preferred_pronouns or "Not specified",
            "email": m.user.email,
        }
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

    course = Course.get_by_id(group.course_id)
    if not course:
        return jsonify({"msg": "Course not found"}), 404

    user = _get_current_user()
    if not user:
        return jsonify({"msg": "User not found"}), 404

    if not _can_view_course_groups(user, course):
        return jsonify({"msg": "Unauthorized"}), 403

    include_email = bool(user.is_admin() or _is_teacher_for_course(user, course))
    members = [
        {
            "id": m.user.id,
            "name": m.user.name,
            **({"email": m.user.email} if include_email else {}),
        }
        for m in group.members
        if m.user is not None
    ]
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

    user = _get_current_user()
    course = Course.get_by_id(group.course_id)

    if not _can_manage_course_groups(user, course):
        return jsonify({"msg": "You are not authorized to delete this group"}), 403

    group.delete()
    return jsonify({"msg": "Group deleted successfully"}), 200


@bp.route("/<int:group_id>/members", methods=["POST"])
@jwt_teacher_required
def add_group_member(group_id):
    data = request.get_json() or {}
    user_id = data.get("user_id")
    if not user_id:
        return jsonify({"msg": "user_id is required"}), 400

    group = Group.get_by_id(group_id)
    if not group:
        return jsonify({"msg": "Group not found"}), 404

    course = Course.get_by_id(group.course_id)
    if not course:
        return jsonify({"msg": "Course not found"}), 404

    current_user = _get_current_user()
    if not _can_manage_course_groups(current_user, course):
        return jsonify({"msg": "Unauthorized"}), 403

    member_user = User.get_by_id(int(user_id))
    if not member_user:
        return jsonify({"msg": "User not found"}), 404

    if not member_user.is_student():
        return jsonify({"msg": "Only students can be added to groups"}), 400

    if User_Course.get(member_user.id, course.id) is None:
        return jsonify({"msg": "Student is not enrolled in this course"}), 400

    existing = GroupMember.query.filter_by(group_id=group.id, user_id=member_user.id).first()
    if existing:
        return jsonify({"msg": "Student is already in this group"}), 200

    _remove_user_from_other_course_groups(course.id, member_user.id, group.id)
    GroupMember.add_member(group_id=group.id, user_id=member_user.id)

    db.session.commit()

    members = [
        {"id": m.user.id, "name": m.user.name, "email": m.user.email}
        for m in group.members
        if m.user is not None
    ]
    return jsonify({"id": group.id, "name": group.name, "course_id": group.course_id, "members": members}), 200


@bp.route("/<int:group_id>/members/<int:user_id>", methods=["DELETE"])
@jwt_teacher_required
def remove_group_member(group_id, user_id):
    group = Group.get_by_id(group_id)
    if not group:
        return jsonify({"msg": "Group not found"}), 404

    course = Course.get_by_id(group.course_id)
    if not course:
        return jsonify({"msg": "Course not found"}), 404

    current_user = _get_current_user()
    if not _can_manage_course_groups(current_user, course):
        return jsonify({"msg": "Unauthorized"}), 403

    removed = GroupMember.remove_member(group_id=group.id, user_id=int(user_id))
    if not removed:
        return jsonify({"msg": "Student is not in this group"}), 404

    members = [
        {"id": m.user.id, "name": m.user.name, "email": m.user.email}
        for m in group.members
        if m.user is not None
    ]
    return jsonify({"id": group.id, "name": group.name, "course_id": group.course_id, "members": members}), 200
