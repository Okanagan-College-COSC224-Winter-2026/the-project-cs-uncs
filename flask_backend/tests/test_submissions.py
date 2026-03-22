"""Tests for student submissions upload/list/download."""

import io
import json
import datetime

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
    due_date = (datetime.datetime.utcnow() + datetime.timedelta(days=7)).isoformat()
    create_resp = test_client.post(
        "/assignment/create_assignment",
        data=json.dumps({"courseID": course.id, "name": "A1", "rubric": "R", "due_date": due_date}),
        headers={"Content-Type": "application/json"},
    )
    assert create_resp.status_code == 201
    assignment_id = create_resp.json["assignment"]["id"]

    # Switch to student
    login_as(test_client, "s@example.com", "spass")

    upload_resp = test_client.post(
        f"/assignment/submit/{assignment_id}",
        data={
            "files": [
                (io.BytesIO(b"hello"), "hello.txt"),
                (io.BytesIO(b"world"), "world.txt"),
            ]
        },
        content_type="multipart/form-data",
    )
    assert upload_resp.status_code == 200
    submission_id = upload_resp.json["submission"]["id"]
    attachments = upload_resp.json["submission"].get("attachments")
    assert attachments is not None
    assert len(attachments) == 2

    my_resp = test_client.get(f"/assignment/my_submission/{assignment_id}")
    assert my_resp.status_code == 200
    assert my_resp.json["submission"]["id"] == submission_id
    assert my_resp.json["submission"]["file_name"] == "hello.txt"
    assert len(my_resp.json["submission"].get("attachments") or []) == 2

    # Back-compat: submission download returns the first attachment.
    download_resp = test_client.get(f"/assignment/submission/download/{submission_id}")
    assert download_resp.status_code == 200
    assert download_resp.data == b"hello"

    # Download each attachment.
    download1 = test_client.get(f"/assignment/submission/attachment/download/{attachments[0]['id']}")
    assert download1.status_code == 200
    assert download1.data == b"hello"

    download2 = test_client.get(f"/assignment/submission/attachment/download/{attachments[1]['id']}")
    assert download2.status_code == 200
    assert download2.data == b"world"


def test_teacher_can_list_and_download_submissions(test_client, make_user, make_course, enroll_user_in_course):
    teacher = make_user(role="teacher", email="t@example.com", password="tpass", name="Teacher")
    student = make_user(role="student", email="s@example.com", password="spass", name="Student")
    course = make_course(teacher_id=teacher.id)
    enroll_user_in_course(student.id, course.id)

    login_as(test_client, "t@example.com", "tpass")
    due_date = (datetime.datetime.utcnow() + datetime.timedelta(days=7)).isoformat()
    create_resp = test_client.post(
        "/assignment/create_assignment",
        data=json.dumps({"courseID": course.id, "name": "A1", "rubric": "R", "due_date": due_date}),
        headers={"Content-Type": "application/json"},
    )
    assignment_id = create_resp.json["assignment"]["id"]

    # student upload
    login_as(test_client, "s@example.com", "spass")
    upload_resp = test_client.post(
        f"/assignment/submit/{assignment_id}",
        data={
            "files": [
                (io.BytesIO(b"abc"), "work.pdf"),
                (io.BytesIO(b"def"), "notes.txt"),
            ]
        },
        content_type="multipart/form-data",
    )
    submission_id = upload_resp.json["submission"]["id"]

    # teacher list and download
    login_as(test_client, "t@example.com", "tpass")

    list_resp = test_client.get(f"/assignment/submissions/{assignment_id}")
    assert list_resp.status_code == 200
    assert len(list_resp.json["submissions"]) == 1
    assert list_resp.json["submissions"][0]["id"] == submission_id
    assert len(list_resp.json["submissions"][0].get("attachments") or []) == 2

    download_resp = test_client.get(f"/assignment/submission/download/{submission_id}")
    assert download_resp.status_code == 200
    assert download_resp.data == b"abc"


def test_assignment_list_student_done_updates_after_submission(
    test_client, make_user, make_course, enroll_user_in_course
):
    teacher = make_user(role="teacher", email="t@example.com", password="tpass", name="Teacher")
    student = make_user(role="student", email="s@example.com", password="spass", name="Student")
    course = make_course(teacher_id=teacher.id)
    enroll_user_in_course(student.id, course.id)

    login_as(test_client, "t@example.com", "tpass")
    due_date = (datetime.datetime.utcnow() + datetime.timedelta(days=7)).isoformat()
    create_resp = test_client.post(
        "/assignment/create_assignment",
        data=json.dumps({"courseID": course.id, "name": "A1", "rubric": "R", "due_date": due_date}),
        headers={"Content-Type": "application/json"},
    )
    assert create_resp.status_code == 201

    login_as(test_client, "s@example.com", "spass")
    list_before = test_client.get(f"/assignment/{course.id}")
    assert list_before.status_code == 200
    row_before = next((a for a in list_before.json if a.get("name") == "A1"), None)
    assert row_before is not None
    assert row_before.get("student_done") is False

    assignment_id = row_before["id"]
    upload_resp = test_client.post(
        f"/assignment/submit/{assignment_id}",
        data={"files": [(io.BytesIO(b"hello"), "hello.txt")]},
        content_type="multipart/form-data",
    )
    assert upload_resp.status_code == 200

    list_after = test_client.get(f"/assignment/{course.id}")
    assert list_after.status_code == 200
    row_after = next((a for a in list_after.json if a.get("id") == assignment_id), None)
    assert row_after is not None
    assert row_after.get("student_done") is True


def test_student_can_delete_own_submission_and_done_flips_back(
    test_client, make_user, make_course, enroll_user_in_course
):
    teacher = make_user(role="teacher", email="t@example.com", password="tpass", name="Teacher")
    student = make_user(role="student", email="s@example.com", password="spass", name="Student")
    course = make_course(teacher_id=teacher.id)
    enroll_user_in_course(student.id, course.id)

    login_as(test_client, "t@example.com", "tpass")
    due_date = (datetime.datetime.utcnow() + datetime.timedelta(days=7)).isoformat()
    create_resp = test_client.post(
        "/assignment/create_assignment",
        data=json.dumps({"courseID": course.id, "name": "A1", "rubric": "R", "due_date": due_date}),
        headers={"Content-Type": "application/json"},
    )
    assert create_resp.status_code == 201
    assignment_id = create_resp.json["assignment"]["id"]

    login_as(test_client, "s@example.com", "spass")

    upload_resp = test_client.post(
        f"/assignment/submit/{assignment_id}",
        data={
            "files": [
                (io.BytesIO(b"hello"), "hello.txt"),
                (io.BytesIO(b"world"), "world.txt"),
            ]
        },
        content_type="multipart/form-data",
    )
    assert upload_resp.status_code == 200

    list_after_upload = test_client.get(f"/assignment/{course.id}")
    assert list_after_upload.status_code == 200
    row_after_upload = next((a for a in list_after_upload.json if a.get("id") == assignment_id), None)
    assert row_after_upload is not None
    assert row_after_upload.get("student_done") is True

    delete_resp = test_client.delete(f"/assignment/my_submission/{assignment_id}")
    assert delete_resp.status_code == 200

    my_resp = test_client.get(f"/assignment/my_submission/{assignment_id}")
    assert my_resp.status_code == 200
    assert my_resp.json["submission"] is None

    list_after_delete = test_client.get(f"/assignment/{course.id}")
    assert list_after_delete.status_code == 200
    row_after_delete = next((a for a in list_after_delete.json if a.get("id") == assignment_id), None)
    assert row_after_delete is not None
    assert row_after_delete.get("student_done") is False


def test_other_student_cannot_download_someone_elses_submission(test_client, make_user, make_course, enroll_user_in_course):
    teacher = make_user(role="teacher", email="t@example.com", password="tpass", name="Teacher")
    student1 = make_user(role="student", email="s1@example.com", password="spass", name="Student1")
    student2 = make_user(role="student", email="s2@example.com", password="spass", name="Student2")
    course = make_course(teacher_id=teacher.id)
    enroll_user_in_course(student1.id, course.id)
    enroll_user_in_course(student2.id, course.id)

    login_as(test_client, "t@example.com", "tpass")
    due_date = (datetime.datetime.utcnow() + datetime.timedelta(days=7)).isoformat()
    create_resp = test_client.post(
        "/assignment/create_assignment",
        data=json.dumps({"courseID": course.id, "name": "A1", "rubric": "R", "due_date": due_date}),
        headers={"Content-Type": "application/json"},
    )
    assignment_id = create_resp.json["assignment"]["id"]

    login_as(test_client, "s1@example.com", "spass")
    upload_resp = test_client.post(
        f"/assignment/submit/{assignment_id}",
        data={"files": [(io.BytesIO(b"secret"), "secret.txt")]},
        content_type="multipart/form-data",
    )
    submission_id = upload_resp.json["submission"]["id"]
    attachment_id = upload_resp.json["submission"]["attachments"][0]["id"]

    login_as(test_client, "s2@example.com", "spass")
    download_resp = test_client.get(f"/assignment/submission/download/{submission_id}")
    assert download_resp.status_code == 403

    download_resp2 = test_client.get(f"/assignment/submission/attachment/download/{attachment_id}")
    assert download_resp2.status_code == 403


def test_groupmate_cannot_view_or_download_other_students_submission(
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
    due_date = (datetime.datetime.utcnow() + datetime.timedelta(days=7)).isoformat()
    create_resp = test_client.post(
        "/assignment/create_assignment",
        data=json.dumps({"courseID": course.id, "name": "A1", "rubric": "R", "due_date": due_date}),
        headers={"Content-Type": "application/json"},
    )
    assignment_id = create_resp.json["assignment"]["id"]

    # Student1 uploads a submission
    login_as(test_client, "s1@example.com", "spass")
    upload_resp = test_client.post(
        f"/assignment/submit/{assignment_id}",
        data={"files": [(io.BytesIO(b"groupwork"), "group.txt")]},
        content_type="multipart/form-data",
    )
    assert upload_resp.status_code == 200
    submission_id = upload_resp.json["submission"]["id"]
    attachment_id = upload_resp.json["submission"]["attachments"][0]["id"]

    # Student2 should NOT see student1's submission via my_submission
    login_as(test_client, "s2@example.com", "spass")
    my_resp = test_client.get(f"/assignment/my_submission/{assignment_id}")
    assert my_resp.status_code == 200
    assert my_resp.json["submission"] is None
    assert my_resp.json["locked"] is False

    # Student2 CAN submit their own file
    upload2_resp = test_client.post(
        f"/assignment/submit/{assignment_id}",
        data={"file": (io.BytesIO(b"oops"), "oops.txt")},
        content_type="multipart/form-data",
    )
    assert upload2_resp.status_code == 200

    # Student2 cannot download student1's submission
    download_resp = test_client.get(f"/assignment/submission/download/{submission_id}")
    assert download_resp.status_code == 403

    download_resp2 = test_client.get(f"/assignment/submission/attachment/download/{attachment_id}")
    assert download_resp2.status_code == 403
