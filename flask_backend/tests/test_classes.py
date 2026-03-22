"""
Tests for classes endpoints
"""

import json


def test_create_classes(test_client, make_admin):
    """
    GIVEN a logged-in teacher user
    WHEN POST /class/create_class is called with valid data
    THEN a new class should be created
    """
    # Set the admin user by default into the database
    make_admin(email="admin@example.com", password="admin", name="adminuser")

    # Login as teacher/admin
    test_client.post(
        "/auth/login",
        data=json.dumps({"email": "admin@example.com", "password": "admin"}),
        headers={"Content-Type": "application/json"},
    )
    response = test_client.post(
        "/class/create_class",
        data=json.dumps({"name": "Math 101"}),
        headers={"Content-Type": "application/json"},
    )

    assert response.status_code == 201
    assert response.json["msg"] == "Class created"
    assert "id" in response.json["class"]


def test_create_class_not_teacher(test_client):
    """
    GIVEN a logged-in non-teacher user
    WHEN POST /class/create_class is called
    THEN the request should be forbidden
    """
    # Register and login as non-teacher
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
    # Attempt to create class
    response = test_client.post(
        "/class/create_class",
        data=json.dumps({"name": "Math 101"}),
        headers={"Content-Type": "application/json"},
    )
    assert response.status_code == 403
    assert response.json["msg"] == "Insufficient permissions"


def test_get_classes(test_client, make_admin):
    """
    GIVEN a logged-in user
    WHEN GET /class/browse_classes is called
    THEN the list of classes should be returned
    """

    # Set the admin user by default into the database
    make_admin(email="admin@example.com", password="admin", name="adminuser")

    # Login as teacher/admin
    test_client.post(
        "/auth/login",
        data=json.dumps({"email": "admin@example.com", "password": "admin"}),
        headers={"Content-Type": "application/json"},
    )
    # Create a class
    test_client.post(
        "/class/create_class",
        data=json.dumps({"name": "Math 101"}),
        headers={"Content-Type": "application/json"},
    )
    # Get classes
    response = test_client.get("/class/browse_classes", headers={"Content-Type": "application/json"})
    assert response.status_code == 200
    classes = response.json
    assert any(c["name"] == "Math 101" for c in classes)
    assert len(classes) >= 1

def test_get_classes_not_logged_in(test_client):
    """
    GIVEN a non-logged-in user
    WHEN GET /class/browse_classes is called
    THEN the request should be unauthorized
    """
    response = test_client.get("/class/browse_classes", headers={"Content-Type": "application/json"})
    assert response.status_code == 401

def test_get_courses_for_teacher(test_client, make_admin):
    """
    GIVEN a logged-in teacher user
    WHEN GET /class/classes is called
    THEN the list of classes taught by the teacher should be returned
    """

    # Set the admin user by default into the database
    make_admin(email="admin@example.com", password="admin", name="adminuser")
    make_admin(email="teacher@example.com", password="teacher", name="teacheruser")
    # Login as teacher/admin
    test_client.post(
        "/auth/login",
        data=json.dumps({"email": "admin@example.com", "password": "admin"}),
        headers={"Content-Type": "application/json"},
    )
    # Create a class
    test_client.post(
        "/class/create_class",
        data=json.dumps({"name": "Math 101"}),
        headers={"Content-Type": "application/json"},
    )

def test_get_courses_for_student(test_client, make_admin, enroll_user_in_course):
    """
    GIVEN a logged-in student user
    WHEN GET /class/classes is called
    THEN the list of classes the student is enrolled in should be returned
    """

    # Set the admin user by default into the database
    make_admin(email="teacher@example.com", password="teacher", name="teacheruser")
    test_client.post(
        "/auth/login",
        data=json.dumps({"email": "teacher@example.com", "password": "teacher"}),
        headers={"Content-Type": "application/json"},
    )
    # Create a class
    response = test_client.post(
        "/class/create_class",
        data=json.dumps({"name": "History 201"}),
        headers={"Content-Type": "application/json"},
    )
    class_id = response.json["class"]["id"]
    # Register and login as student
    test_client.post(
        "/auth/register",
        data=json.dumps(
            {"name": "studentuser", "password": "123456", "email": "student@example.com"}),
        headers={"Content-Type": "application/json"},
    )
    login_response = test_client.post(
        "/auth/login",
        data=json.dumps({"email": "student@example.com", "password": "123456"}),
        headers={"Content-Type": "application/json"},
    )
    student_id = login_response.json["id"]
    # Enroll student in class
    enrollment = enroll_user_in_course(user_id=student_id, course_id=class_id)
    assert enrollment.userID == student_id and enrollment.courseID == class_id
    # Get classes
    response = test_client.get("/class/classes", headers={"Content-Type": "application/json"})
    assert response.status_code == 200
    classes = response.json
    assert any(c["name"] == "History 201" for c in classes)
    assert len(classes) >= 1

def test_get_courses_for_student_not_enrolled(test_client):
    """
    GIVEN a logged-in student user not enrolled in any classes
    WHEN GET /class/classes is called
    THEN an empty list should be returned
    """
    # Register and login as student
    test_client.post(
        "/auth/register",
        data=json.dumps(
            {"name": "studentuser2", "password": "123456", "email": "student2@example.com"}),
        headers={"Content-Type": "application/json"},
    )
    test_client.post(
        "/auth/login",
        data=json.dumps({"email": "student2@example.com", "password": "123456"}),
        headers={"Content-Type": "application/json"},
    )
    # Get classes
    response = test_client.get("/class/classes", headers={"Content-Type": "application/json"})
    assert response.status_code == 200
    classes = response.json
    assert classes == []

def test_get_courses_not_logged_in(test_client):
    """
    GIVEN a non-logged-in user
    WHEN GET /class/classes is called
    THEN the request should be unauthorized
    """
    response = test_client.get("/class/classes", headers={"Content-Type": "application/json"})
    assert response.status_code == 401


def test_search_classes_by_name(test_client, make_admin):
    """
    GIVEN a created class
    WHEN a student searches by a partial name
    THEN the class should appear in the results with metadata
    """
    # Create a teacher and a class
    make_admin(email="teacher@example.com", password="teacher", name="teacheruser")
    test_client.post(
        "/auth/login",
        data=json.dumps({"email": "teacher@example.com", "password": "teacher"}),
        headers={"Content-Type": "application/json"},
    )
    response = test_client.post(
        "/class/create_class",
        data=json.dumps({"name": "Calculus 101"}),
        headers={"Content-Type": "application/json"},
    )
    assert response.status_code == 201

    # Register and login as a student
    test_client.post(
        "/auth/register",
        data=json.dumps({"name": "studentuser", "password": "123456", "email": "student@example.com"}),
        headers={"Content-Type": "application/json"},
    )
    test_client.post(
        "/auth/login",
        data=json.dumps({"email": "student@example.com", "password": "123456"}),
        headers={"Content-Type": "application/json"},
    )

    # Search for the class
    resp = test_client.get("/class/search?q=Calculus", headers={"Content-Type": "application/json"})
    assert resp.status_code == 200
    data = resp.json
    assert "results" in data
    assert any(r["name"] == "Calculus 101" for r in data["results"])


def test_search_classes_no_results(test_client):
    """
    GIVEN no class matching a query
    WHEN searching
    THEN return an empty results list and a clear message
    """
    # Register and login as a student
    test_client.post(
        "/auth/register",
        data=json.dumps({"name": "studentuser2", "password": "123456", "email": "student2@example.com"}),
        headers={"Content-Type": "application/json"},
    )
    test_client.post(
        "/auth/login",
        data=json.dumps({"email": "student2@example.com", "password": "123456"}),
        headers={"Content-Type": "application/json"},
    )

    resp = test_client.get("/class/search?q=NoSuchCourse", headers={"Content-Type": "application/json"})
    assert resp.status_code == 200
    data = resp.json
    assert "results" in data and data["results"] == []
    assert data.get("message") == "No courses found"
