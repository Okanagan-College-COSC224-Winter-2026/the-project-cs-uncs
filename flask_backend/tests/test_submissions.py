"""Tests for student submissions upload/list/download."""

import io
import json

import pytest
from werkzeug.security import generate_password_hash

from api.models import Course, User, User_Course, Group, GroupMember
from api.models.db import db as _db


def login_as(client, email, password):
    return client.post(
        "/auth/login",
        data=json.dumps({"email": email, "password": password}),
        headers={"Content-Type": "application/json"},
    )


@pytest.fixture
def make_user():
    def _make_user(role="student", email="user@example.com", password="pass", name="User"):
        user = User(name=name, email=email, hash_pass=generate_password_hash(password), role=role)
        _db.session.add(user)
        _db.session.commit()
        return user

    return _make_user


@pytest.fixture
def make_course():
    def _make_course(teacher_id, name="Course 1"):
        course = Course(teacherID=teacher_id, name=name)
        _db.session.add(course)
        _db.session.commit()
        return course

    return _make_course


def test_student_can_upload_and_download_own_submission(test_client, make_user, make_course, enroll_user_in_course):
    teacher = make_user(role="teacher", email="t@example.com", password="tpass", name="Teacher")
    student = make_user(role="student", email="s@example.com", password="spass", name="Student")
    course = make_course(teacher_id=teacher.id)
    enroll_user_in_course(student.id, course.id)

    login_as(test_client, "t@example.com", "tpass")
    create_resp = test_client.post(
        "/assignment/create_assignment",
        data=json.dumps({"courseID": course.id, "name": "A1", "rubric": "R"}),
        headers={"Content-Type": "application/json"},
    )
    assert create_resp.status_code == 201
    assignment_id = create_resp.json["assignment"]["id"]

    # Switch to student
    login_as(test_client, "s@example.com", "spass")

    upload_resp = test_client.post(
        f"/assignment/submit/{assignment_id}",
        data={"file": (io.BytesIO(b"hello"), "hello.txt")},
        content_type="multipart/form-data",
    )
    assert upload_resp.status_code == 200
    submission_id = upload_resp.json["submission"]["id"]

    my_resp = test_client.get(f"/assignment/my_submission/{assignment_id}")
    assert my_resp.status_code == 200
    assert my_resp.json["submission"]["id"] == submission_id
    assert my_resp.json["submission"]["file_name"] == "hello.txt"

    download_resp = test_client.get(f"/assignment/submission/download/{submission_id}")
    assert download_resp.status_code == 200
    assert download_resp.data == b"hello"


def test_teacher_can_list_and_download_submissions(test_client, make_user, make_course, enroll_user_in_course):
    teacher = make_user(role="teacher", email="t@example.com", password="tpass", name="Teacher")
    student = make_user(role="student", email="s@example.com", password="spass", name="Student")
    course = make_course(teacher_id=teacher.id)
    enroll_user_in_course(student.id, course.id)

    login_as(test_client, "t@example.com", "tpass")
    create_resp = test_client.post(
        "/assignment/create_assignment",
        data=json.dumps({"courseID": course.id, "name": "A1", "rubric": "R"}),
        headers={"Content-Type": "application/json"},
    )
    assignment_id = create_resp.json["assignment"]["id"]

    # student upload
    login_as(test_client, "s@example.com", "spass")
    upload_resp = test_client.post(
        f"/assignment/submit/{assignment_id}",
        data={"file": (io.BytesIO(b"abc"), "work.pdf")},
        content_type="multipart/form-data",
    )
    submission_id = upload_resp.json["submission"]["id"]

    # teacher list and download
    login_as(test_client, "t@example.com", "tpass")

    list_resp = test_client.get(f"/assignment/submissions/{assignment_id}")
    assert list_resp.status_code == 200
    assert len(list_resp.json["submissions"]) == 1
    assert list_resp.json["submissions"][0]["id"] == submission_id

    download_resp = test_client.get(f"/assignment/submission/download/{submission_id}")
    assert download_resp.status_code == 200
    assert download_resp.data == b"abc"


def test_other_student_cannot_download_someone_elses_submission(test_client, make_user, make_course, enroll_user_in_course):
    teacher = make_user(role="teacher", email="t@example.com", password="tpass", name="Teacher")
    student1 = make_user(role="student", email="s1@example.com", password="spass", name="Student1")
    student2 = make_user(role="student", email="s2@example.com", password="spass", name="Student2")
    course = make_course(teacher_id=teacher.id)
    enroll_user_in_course(student1.id, course.id)
    enroll_user_in_course(student2.id, course.id)

    login_as(test_client, "t@example.com", "tpass")
    create_resp = test_client.post(
        "/assignment/create_assignment",
        data=json.dumps({"courseID": course.id, "name": "A1", "rubric": "R"}),
        headers={"Content-Type": "application/json"},
    )
    assignment_id = create_resp.json["assignment"]["id"]

    login_as(test_client, "s1@example.com", "spass")
    upload_resp = test_client.post(
        f"/assignment/submit/{assignment_id}",
        data={"file": (io.BytesIO(b"secret"), "secret.txt")},
        content_type="multipart/form-data",
    )
    submission_id = upload_resp.json["submission"]["id"]

    login_as(test_client, "s2@example.com", "spass")
    download_resp = test_client.get(f"/assignment/submission/download/{submission_id}")
    assert download_resp.status_code == 403


def test_groupmate_can_view_and_download_group_submission_and_cannot_submit_again(
    test_client, make_user, make_course, enroll_user_in_course
):
    teacher = make_user(role="teacher", email="t@example.com", password="tpass", name="Teacher")
    student1 = make_user(role="student", email="s1@example.com", password="spass", name="Student1")
    student2 = make_user(role="student", email="s2@example.com", password="spass", name="Student2")
    course = make_course(teacher_id=teacher.id)
    enroll_user_in_course(student1.id, course.id)
    enroll_user_in_course(student2.id, course.id)

    group = Group.create(name="G1", course_id=course.id)
    GroupMember.add_member(group_id=group.id, user_id=student1.id)
    GroupMember.add_member(group_id=group.id, user_id=student2.id)

    login_as(test_client, "t@example.com", "tpass")
    create_resp = test_client.post(
        "/assignment/create_assignment",
        data=json.dumps({"courseID": course.id, "name": "A1", "rubric": "R"}),
        headers={"Content-Type": "application/json"},
    )
    assignment_id = create_resp.json["assignment"]["id"]

    # Student1 uploads first (locks the group)
    login_as(test_client, "s1@example.com", "spass")
    upload_resp = test_client.post(
        f"/assignment/submit/{assignment_id}",
        data={"file": (io.BytesIO(b"groupwork"), "group.txt")},
        content_type="multipart/form-data",
    )
    assert upload_resp.status_code == 200
    submission_id = upload_resp.json["submission"]["id"]

    # Student2 sees the group's submission and is locked
    login_as(test_client, "s2@example.com", "spass")
    my_resp = test_client.get(f"/assignment/my_submission/{assignment_id}")
    assert my_resp.status_code == 200
    assert my_resp.json["submission"]["id"] == submission_id
    assert my_resp.json["submission"]["file_name"] == "group.txt"
    assert my_resp.json["locked"] is True

    # Student2 cannot submit another file
    upload2_resp = test_client.post(
        f"/assignment/submit/{assignment_id}",
        data={"file": (io.BytesIO(b"oops"), "oops.txt")},
        content_type="multipart/form-data",
    )
    assert upload2_resp.status_code == 403

    # Student2 can download the group submission
    download_resp = test_client.get(f"/assignment/submission/download/{submission_id}")
    assert download_resp.status_code == 200
    assert download_resp.data == b"groupwork"
