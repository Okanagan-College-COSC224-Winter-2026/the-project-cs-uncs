import json

from werkzeug.security import generate_password_hash

from api.models import Course, Group, GroupMember, User, User_Course


def _login(test_client, email: str, password: str):
    resp = test_client.post(
        "/auth/login",
        data=json.dumps({"email": email, "password": password}),
        headers={"Content-Type": "application/json"},
    )
    assert resp.status_code == 200
    return resp


def test_teacher_can_add_and_remove_group_members(test_client, dbsession):
    teacher_pw = "pw123456"
    teacher = User(
        name="Teacher",
        email="teacher@example.com",
        hash_pass=generate_password_hash(teacher_pw),
        role="teacher",
    )
    s1 = User(
        name="Student One",
        email="s1@example.com",
        hash_pass=generate_password_hash("pw"),
        role="student",
    )
    s2 = User(
        name="Student Two",
        email="s2@example.com",
        hash_pass=generate_password_hash("pw"),
        role="student",
    )
    dbsession.add_all([teacher, s1, s2])
    dbsession.commit()

    course = Course(teacherID=teacher.id, name="Course")
    dbsession.add(course)
    dbsession.commit()

    dbsession.add_all([
        User_Course(userID=s1.id, courseID=course.id),
        User_Course(userID=s2.id, courseID=course.id),
    ])
    dbsession.commit()

    group = Group.create(name="Group A", course_id=course.id)
    GroupMember.add_member(group_id=group.id, user_id=s1.id)

    _login(test_client, teacher.email, teacher_pw)

    add_resp = test_client.post(
        f"/groups/{group.id}/members",
        data=json.dumps({"user_id": s2.id}),
        headers={"Content-Type": "application/json"},
    )
    assert add_resp.status_code == 200
    member_ids = {m["id"] for m in add_resp.json["members"]}
    assert s1.id in member_ids
    assert s2.id in member_ids

    remove_resp = test_client.delete(f"/groups/{group.id}/members/{s1.id}")
    assert remove_resp.status_code == 200
    member_ids = {m["id"] for m in remove_resp.json["members"]}
    assert s1.id not in member_ids
    assert s2.id in member_ids


def test_admin_can_edit_group_members_not_the_teacher(test_client, dbsession):
    teacher_pw = "pw123456"
    teacher = User(
        name="Teacher",
        email="teacher2@example.com",
        hash_pass=generate_password_hash(teacher_pw),
        role="teacher",
    )
    admin_pw = "adminpw"
    admin = User(
        name="Admin",
        email="admin@example.com",
        hash_pass=generate_password_hash(admin_pw),
        role="admin",
    )
    s1 = User(
        name="Student One",
        email="s3@example.com",
        hash_pass=generate_password_hash("pw"),
        role="student",
    )
    s2 = User(
        name="Student Two",
        email="s4@example.com",
        hash_pass=generate_password_hash("pw"),
        role="student",
    )
    dbsession.add_all([teacher, admin, s1, s2])
    dbsession.commit()

    course = Course(teacherID=teacher.id, name="Course")
    dbsession.add(course)
    dbsession.commit()

    dbsession.add_all([
        User_Course(userID=s1.id, courseID=course.id),
        User_Course(userID=s2.id, courseID=course.id),
    ])
    dbsession.commit()

    group = Group.create(name="Group A", course_id=course.id)
    GroupMember.add_member(group_id=group.id, user_id=s1.id)

    _login(test_client, admin.email, admin_pw)

    add_resp = test_client.post(
        f"/groups/{group.id}/members",
        data=json.dumps({"user_id": s2.id}),
        headers={"Content-Type": "application/json"},
    )
    assert add_resp.status_code == 200

    remove_resp = test_client.delete(f"/groups/{group.id}/members/{s1.id}")
    assert remove_resp.status_code == 200


def test_cannot_add_unenrolled_student(test_client, dbsession):
    teacher_pw = "pw123456"
    teacher = User(
        name="Teacher",
        email="teacher3@example.com",
        hash_pass=generate_password_hash(teacher_pw),
        role="teacher",
    )
    enrolled = User(
        name="Enrolled",
        email="enrolled@example.com",
        hash_pass=generate_password_hash("pw"),
        role="student",
    )
    not_enrolled = User(
        name="Not Enrolled",
        email="notenrolled@example.com",
        hash_pass=generate_password_hash("pw"),
        role="student",
    )
    dbsession.add_all([teacher, enrolled, not_enrolled])
    dbsession.commit()

    course = Course(teacherID=teacher.id, name="Course")
    dbsession.add(course)
    dbsession.commit()

    dbsession.add(User_Course(userID=enrolled.id, courseID=course.id))
    dbsession.commit()

    group = Group.create(name="Group A", course_id=course.id)
    GroupMember.add_member(group_id=group.id, user_id=enrolled.id)

    _login(test_client, teacher.email, teacher_pw)

    add_resp = test_client.post(
        f"/groups/{group.id}/members",
        data=json.dumps({"user_id": not_enrolled.id}),
        headers={"Content-Type": "application/json"},
    )
    assert add_resp.status_code == 400
    assert "not enrolled" in add_resp.json["msg"].lower()


def test_adding_student_to_new_group_removes_from_old_group_same_course_only(test_client, dbsession):
    teacher_pw = "pw123456"
    teacher = User(
        name="Teacher",
        email="teacher4@example.com",
        hash_pass=generate_password_hash(teacher_pw),
        role="teacher",
    )
    student = User(
        name="Student",
        email="student@example.com",
        hash_pass=generate_password_hash("pw"),
        role="student",
    )
    dbsession.add_all([teacher, student])
    dbsession.commit()

    course1 = Course(teacherID=teacher.id, name="Course 1")
    course2 = Course(teacherID=teacher.id, name="Course 2")
    dbsession.add_all([course1, course2])
    dbsession.commit()

    dbsession.add_all(
        [
            User_Course(userID=student.id, courseID=course1.id),
            User_Course(userID=student.id, courseID=course2.id),
        ]
    )
    dbsession.commit()

    # Student starts in groupA for course1 and groupX for course2
    group_a = Group.create(name="Group A", course_id=course1.id)
    group_b = Group.create(name="Group B", course_id=course1.id)
    group_x = Group.create(name="Group X", course_id=course2.id)
    GroupMember.add_member(group_id=group_a.id, user_id=student.id)
    GroupMember.add_member(group_id=group_x.id, user_id=student.id)

    _login(test_client, teacher.email, teacher_pw)

    # Add student to group_b (same course) => removed from group_a
    add_resp = test_client.post(
        f"/groups/{group_b.id}/members",
        data=json.dumps({"user_id": student.id}),
        headers={"Content-Type": "application/json"},
    )
    assert add_resp.status_code == 200

    in_group_a = GroupMember.query.filter_by(group_id=group_a.id, user_id=student.id).first()
    in_group_b = GroupMember.query.filter_by(group_id=group_b.id, user_id=student.id).first()
    in_group_x = GroupMember.query.filter_by(group_id=group_x.id, user_id=student.id).first()

    assert in_group_a is None
    assert in_group_b is not None
    assert in_group_x is not None
