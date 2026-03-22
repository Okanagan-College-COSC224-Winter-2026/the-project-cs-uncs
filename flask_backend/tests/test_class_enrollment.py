"""
Tests for class enrollment endpoints.
"""

import json

from werkzeug.security import check_password_hash
from werkzeug.security import generate_password_hash

from api.models import User
from api.models import Course
from api.models.db import db as _db


def test_teacher_can_enroll_students_by_email(test_client, make_admin, monkeypatch):
    make_admin(email="admin@example.com", password="admin", name="adminuser")

    monkeypatch.setattr(
        "api.controllers.class_controller.generate_temp_password",
        lambda: "TempPass123!",
    )
    monkeypatch.setattr(
        "api.controllers.class_controller.send_new_account_email",
        lambda **kwargs: (True, ""),
    )

    test_client.post(
        "/auth/login",
        data=json.dumps({"email": "admin@example.com", "password": "admin"}),
        headers={"Content-Type": "application/json"},
    )

    class_response = test_client.post(
        "/class/create_class",
        data=json.dumps({"name": "History 101"}),
        headers={"Content-Type": "application/json"},
    )
    class_id = class_response.json["class"]["id"]

    enroll_resp = test_client.post(
        "/class/enroll_students_emails",
        data=json.dumps({"class_id": class_id, "emails": "a@example.com\nb@example.com"}),
        headers={"Content-Type": "application/json"},
    )

    assert enroll_resp.status_code == 200
    assert "students added" in enroll_resp.json["msg"]
    assert "a@example.com" in enroll_resp.json["enrolled"]
    assert "b@example.com" in enroll_resp.json["enrolled"]


def test_enroll_students_emails_creates_new_user_with_temp_password_and_email(
    test_client, make_admin, monkeypatch
):
    make_admin(email="admin@example.com", password="admin", name="adminuser")

    monkeypatch.setattr(
        "api.controllers.class_controller.generate_temp_password",
        lambda: "TempPass123!",
    )
    monkeypatch.setattr(
        "api.controllers.class_controller.send_new_account_email",
        lambda **kwargs: (True, ""),
    )

    test_client.post(
        "/auth/login",
        data=json.dumps({"email": "admin@example.com", "password": "admin"}),
        headers={"Content-Type": "application/json"},
    )

    class_response = test_client.post(
        "/class/create_class",
        data=json.dumps({"name": "Physics 101"}),
        headers={"Content-Type": "application/json"},
    )
    class_id = class_response.json["class"]["id"]

    new_email = "freshstudent@example.com"
    enroll_resp = test_client.post(
        "/class/enroll_students_emails",
        data=json.dumps({"class_id": class_id, "emails": new_email}),
        headers={"Content-Type": "application/json"},
    )

    assert enroll_resp.status_code == 200
    assert new_email in enroll_resp.json["enrolled"]

    created = User.get_by_email(new_email)
    assert created is not None
    assert created.must_change_password is True
    assert check_password_hash(created.hash_pass, "TempPass123!")


def test_enroll_students_emails_returns_error_when_email_send_fails(
    test_client, make_admin, monkeypatch
):
    make_admin(email="admin@example.com", password="admin", name="adminuser")

    monkeypatch.setattr(
        "api.controllers.class_controller.generate_temp_password",
        lambda: "TempPass123!",
    )
    monkeypatch.setattr(
        "api.controllers.class_controller.send_new_account_email",
        lambda **kwargs: (False, "smtp failed"),
    )

    test_client.post(
        "/auth/login",
        data=json.dumps({"email": "admin@example.com", "password": "admin"}),
        headers={"Content-Type": "application/json"},
    )

    class_response = test_client.post(
        "/class/create_class",
        data=json.dumps({"name": "Chemistry 101"}),
        headers={"Content-Type": "application/json"},
    )
    class_id = class_response.json["class"]["id"]

    new_email = "cannot-send@example.com"
    enroll_resp = test_client.post(
        "/class/enroll_students_emails",
        data=json.dumps({"class_id": class_id, "emails": new_email}),
        headers={"Content-Type": "application/json"},
    )

    assert enroll_resp.status_code == 200
    assert new_email not in enroll_resp.json["enrolled"]
    assert any("smtp failed" in err for err in enroll_resp.json["errors"])
    assert User.get_by_email(new_email) is None


def test_student_cannot_enroll_students_by_email(test_client, make_admin):
    test_client.post(
        "/auth/register",
        data=json.dumps(
            {"name": "studentuser", "password": "123456", "email": "student@example.com"}
        ),
        headers={"Content-Type": "application/json"},
    )

    make_admin(email="teacher@example.com", password="teacher", name="teacheruser")

    test_client.post(
        "/auth/login",
        data=json.dumps({"email": "student@example.com", "password": "123456"}),
        headers={"Content-Type": "application/json"},
    )

    resp = test_client.post(
        "/class/enroll_students_emails",
        data=json.dumps({"class_id": 1, "emails": "a@example.com"}),
        headers={"Content-Type": "application/json"},
    )
    assert resp.status_code == 403
    assert resp.json["msg"] == "Insufficient permissions"


def test_enroll_in_class(test_client, make_admin, monkeypatch):
    make_admin(email="teacher@example.com", password="teacher", name="teacheruser")

    monkeypatch.setattr(
        "api.controllers.class_controller.generate_temp_password",
        lambda: "TempPass123!",
    )
    monkeypatch.setattr(
        "api.controllers.class_controller.send_new_account_email",
        lambda **kwargs: (True, ""),
    )
    test_client.post(
        "/auth/login",
        data=json.dumps({"email": "teacher@example.com", "password": "teacher"}),
        headers={"Content-Type": "application/json"},
    )

    response = test_client.post(
        "/class/create_class",
        data=json.dumps({"name": "Science 101"}),
        headers={"Content-Type": "application/json"},
    )
    class_id = response.json["class"]["id"]

    csv_text = (
        "id,name,email\n"
        "300325853,Gregory Bigglesworth,gbizzle@yandex.ru\n"
        "300325854,Sarah Connor,sconnor@example.com\n"
    )
    response = test_client.post(
        "/class/enroll_students",
        data=json.dumps({"class_id": class_id, "students": csv_text}),
        headers={"Content-Type": "application/json"},
    )
    assert response.status_code == 200
    assert response.json["msg"] == "2 students added to course Science 101"


def test_enroll_in_class_not_teacher(test_client):
    test_client.post(
        "/auth/register",
        data=json.dumps(
            {"name": "studentuser", "password": "123456", "email": "student@example.com"}
        ),
        headers={"Content-Type": "application/json"},
    )
    test_client.post(
        "/auth/login",
        data=json.dumps({"email": "student@example.com", "password": "123456"}),
        headers={"Content-Type": "application/json"},
    )

    csv_text = (
        "id,name,email\n"
        "300325853,Gregory Bigglesworth,gbizzle@yandex.ru\n"
        "300325854,Sarah Connor,sconnor@example.com\n"
    )
    response = test_client.post(
        "/class/enroll_students",
        data=json.dumps({"class_id": 1, "students": csv_text}),
        headers={"Content-Type": "application/json"},
    )
    assert response.status_code == 403
    assert response.json["msg"] == "Insufficient permissions"


def test_enroll_in_class_missing_data(test_client, make_admin):
    make_admin(email="teacher@example.com", password="teacher", name="teacheruser")
    test_client.post(
        "/auth/login",
        data=json.dumps({"email": "teacher@example.com", "password": "teacher"}),
        headers={"Content-Type": "application/json"},
    )

    response = test_client.post(
        "/class/enroll_students",
        data=json.dumps({"class_id": 1}),
        headers={"Content-Type": "application/json"},
    )
    assert response.status_code == 400
    assert response.json["msg"] == "Class ID and student emails are required"


def test_enroll_in_class_not_found(test_client, make_admin):
    make_admin(email="teacher@example.com", password="teacher", name="teacheruser")
    test_client.post(
        "/auth/login",
        data=json.dumps({"email": "teacher@example.com", "password": "teacher"}),
        headers={"Content-Type": "application/json"},
    )

    csv_text = (
        "id,name,email\n"
        "300325853,Gregory Bigglesworth,gbizzle@yandex.ru\n"
        "300325854,Sarah Connor,sconnor@example.com\n"
    )
    response = test_client.post(
        "/class/enroll_students",
        data=json.dumps({"class_id": 9999, "students": csv_text}),
        headers={"Content-Type": "application/json"},
    )
    assert response.status_code == 404
    assert response.json["msg"] == "Class not found"


def test_enroll_in_class_unauthorized(test_client, make_admin):
    teacher = User(
        name="teacheruser",
        email="teacher@example.com",
        hash_pass=generate_password_hash("teacher"),
        role="teacher",
    )
    other_teacher = User(
        name="otherteacheruser",
        email="otherteacher@example.com",
        hash_pass=generate_password_hash("teacher"),
        role="teacher",
    )
    _db.session.add(teacher)
    _db.session.add(other_teacher)
    _db.session.commit()

    # Create the course owned by `teacher`.
    course = Course(teacherID=teacher.id, name="Science 101")
    _db.session.add(course)
    _db.session.commit()
    class_id = course.id

    # Login as the other teacher and try to enroll into a course they don't own.
    test_client.post(
        "/auth/login",
        data=json.dumps({"email": "otherteacher@example.com", "password": "teacher"}),
        headers={"Content-Type": "application/json"},
    )

    csv_text = (
        "id,name,email\n"
        "300325853,Gregory Bigglesworth,gbizzle@yandex.ru\n"
        "300325854,Sarah Connor,sconnor@example.com\n"
    )
    response = test_client.post(
        "/class/enroll_students",
        data=json.dumps({"class_id": class_id, "students": csv_text}),
        headers={"Content-Type": "application/json"},
    )
    assert response.status_code == 403
    assert response.json["msg"] == "You are not authorized to enroll students in this class"


def test_enroll_in_class_not_logged_in(test_client):
    csv_text = (
        "id,name,email\n"
        "300325853,Gregory Bigglesworth,gbizzle@yandex.ru\n"
        "300325854,Sarah Connor,sconnor@example.com\n"
    )
    response = test_client.post(
        "/class/enroll_students",
        data=json.dumps({"class_id": 1, "students": csv_text}),
        headers={"Content-Type": "application/json"},
    )
    assert response.status_code == 401


def test_enroll_in_class_empty_csv(test_client, make_admin):
    make_admin(email="teacher@example.com", password="teacher", name="teacheruser")
    test_client.post(
        "/auth/login",
        data=json.dumps({"email": "teacher@example.com", "password": "teacher"}),
        headers={"Content-Type": "application/json"},
    )

    response = test_client.post(
        "/class/create_class",
        data=json.dumps({"name": "Science 101"}),
        headers={"Content-Type": "application/json"},
    )
    class_id = response.json["class"]["id"]

    response = test_client.post(
        "/class/enroll_students",
        data=json.dumps({"class_id": class_id, "students": ""}),
        headers={"Content-Type": "application/json"},
    )
    assert response.status_code == 400
    assert response.json["msg"] == "Class ID and student emails are required"


def test_enroll_in_class_malformed_csv(test_client, make_admin):
    make_admin(email="teacher@example.com", password="teacher", name="teacheruser")
    test_client.post(
        "/auth/login",
        data=json.dumps({"email": "teacher@example.com", "password": "teacher"}),
        headers={"Content-Type": "application/json"},
    )

    response = test_client.post(
        "/class/create_class",
        data=json.dumps({"name": "Science 101"}),
        headers={"Content-Type": "application/json"},
    )
    class_id = response.json["class"]["id"]

    csv_text = (
        "id,name,email\n"
        "300325853,Gregory Bigglesworth\n"
        "300325854,Sarah Connor,sconnor@example.com\n"
    )
    response = test_client.post(
        "/class/enroll_students",
        data=json.dumps({"class_id": class_id, "students": csv_text}),
        headers={"Content-Type": "application/json"},
    )
    assert response.status_code == 400
    assert response.json["msg"] == "Errors in CSV"


def test_enroll_in_class_existing_student(test_client, make_admin, monkeypatch):
    make_admin(email="teacher@example.com", password="teacher", name="teacheruser")

    monkeypatch.setattr(
        "api.controllers.class_controller.generate_temp_password",
        lambda: "TempPass123!",
    )
    monkeypatch.setattr(
        "api.controllers.class_controller.send_new_account_email",
        lambda **kwargs: (True, ""),
    )
    test_client.post(
        "/auth/login",
        data=json.dumps({"email": "teacher@example.com", "password": "teacher"}),
        headers={"Content-Type": "application/json"},
    )

    response = test_client.post(
        "/class/create_class",
        data=json.dumps({"name": "Science 101"}),
        headers={"Content-Type": "application/json"},
    )
    class_id = response.json["class"]["id"]

    csv_text = "id,name,email\n300325854,Sarah Connor,sconnor@example.com\n"
    test_client.post(
        "/class/enroll_students",
        data=json.dumps({"class_id": class_id, "students": csv_text}),
        headers={"Content-Type": "application/json"},
    )

    response = test_client.post(
        "/class/enroll_students",
        data=json.dumps({"class_id": class_id, "students": csv_text}),
        headers={"Content-Type": "application/json"},
    )
    assert response.status_code == 200
    assert response.json["msg"] == "0 students added to course Science 101"


def test_enroll_in_class_invalid_email_format(test_client, make_admin):
    make_admin(email="teacher@example.com", password="teacher", name="teacheruser")
    test_client.post(
        "/auth/login",
        data=json.dumps({"email": "teacher@example.com", "password": "teacher"}),
        headers={"Content-Type": "application/json"},
    )

    response = test_client.post(
        "/class/create_class",
        data=json.dumps({"name": "Science 101"}),
        headers={"Content-Type": "application/json"},
    )
    class_id = response.json["class"]["id"]

    csv_text = (
        "id,name,email\n"
        "300500123,John Doe,johndoeatexample.com\n"
        "300325853,Gregory Bigglesworth,gbizzle-at-yandex.ru\n"
        "300325854,Sarah Connor,sconnor@example.com\n"
    )
    response = test_client.post(
        "/class/enroll_students",
        data=json.dumps({"class_id": class_id, "students": csv_text}),
        headers={"Content-Type": "application/json"},
    )
    assert response.status_code == 400
    assert response.json["msg"] == "Invalid email format: johndoeatexample.com"
