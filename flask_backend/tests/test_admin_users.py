import json
from werkzeug.security import generate_password_hash

from api.models import User, Course


def login_as(client, email, password):
    return client.post(
        "/auth/login",
        data=json.dumps({"email": email, "password": password}),
        headers={"Content-Type": "application/json"},
    )


def test_admin_can_create_list_update_and_delete_users(test_client, make_admin):
    # Create admin and login
    admin = make_admin(email="admin@example.com", password="admin", name="adminuser")
    login_as(test_client, "admin@example.com", "admin")

    # Create a student via admin endpoint
    resp = test_client.post(
        "/admin/users/create",
        data=json.dumps({
            "name": "Student A",
            "email": "studenta@test.com",
            "password": "password123",
            "role": "student",
            "must_change_password": False,
        }),
        headers={"Content-Type": "application/json"},
    )
    assert resp.status_code == 201
    created = resp.json["user"]
    assert created["email"] == "studenta@test.com"

    # List users
    resp = test_client.get("/admin/users")
    assert resp.status_code == 200
    emails = [u["email"] for u in resp.json]
    assert "studenta@test.com" in emails

    # Update user's name/email
    resp = test_client.put(
        f"/admin/users/{created['id']}",
        data=json.dumps({"name": "Student A Renamed", "email": "studenta2@test.com"}),
        headers={"Content-Type": "application/json"},
    )
    assert resp.status_code == 200
    assert resp.json["user"]["name"] == "Student A Renamed"
    assert resp.json["user"]["email"] == "studenta2@test.com"

    # Promote the user to teacher via role endpoint
    resp = test_client.put(
        f"/admin/users/{created['id']}/role",
        data=json.dumps({"role": "teacher"}),
        headers={"Content-Type": "application/json"},
    )
    assert resp.status_code == 200
    assert resp.json["user"]["role"] == "teacher"

    # Attempt to delete this teacher while they own a course: first create a course owned by them
    teacher_id = created["id"]
    course = Course(teacherID=teacher_id, name="Owned Course")
    Course.create_course(course)

    # Deleting should fail because teacher owns a course
    resp = test_client.delete(f"/admin/users/{teacher_id}")
    assert resp.status_code == 400
    assert "assigned to one or more courses" in resp.json["msg"]

    # Create another student and delete them successfully
    resp = test_client.post(
        "/admin/users/create",
        data=json.dumps({
            "name": "Student B",
            "email": "studentb@test.com",
            "password": "password123",
            "role": "student",
        }),
        headers={"Content-Type": "application/json"},
    )
    assert resp.status_code == 201
    sid = resp.json["user"]["id"]

    resp = test_client.delete(f"/admin/users/{sid}")
    assert resp.status_code == 200
    assert resp.json["msg"] == "User deleted successfully"


def test_admin_cannot_delete_self(test_client, make_admin):
    admin = make_admin(email="me@example.com", password="admin", name="meuser")
    login_as(test_client, "me@example.com", "admin")

    resp = test_client.delete(f"/admin/users/{admin.id}")
    assert resp.status_code == 400
    assert "Cannot delete your own account" in resp.json["msg"]
