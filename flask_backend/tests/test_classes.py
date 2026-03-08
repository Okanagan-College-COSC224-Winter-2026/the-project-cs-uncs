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
    # Login other user
    test_client.post(
        "/auth/login",
        data=json.dumps({"email": "teacher@example.com", "password": "teacher"}),
        headers={"Content-Type": "application/json"},
    )
    # Create a class
    test_client.post(
        "/class/create_class",
        data=json.dumps({"name": "History 201"}),
        headers={"Content-Type": "application/json"},
    )
    # Get classes
    response = test_client.get("/class/classes", headers={"Content-Type": "application/json"})
    assert response.status_code == 200
    classes = response.json
    assert any(c["name"] == "History 201" for c in classes)
    assert len(classes) >= 1

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

def test_enroll_in_class(test_client, make_admin):
    """
    GIVEN a logged-in teacher user
    WHEN POST /class/enroll_students is called with valid data
    THEN the teacher should enroll students in the class
    """
    # Set the admin user by default into the database
    make_admin(email="teacher@example.com", password="teacher", name="teacheruser")
    # Login as teacher/admin
    test_client.post(
        "/auth/login",
        data=json.dumps({"email": "teacher@example.com", "password": "teacher"}),
        headers={"Content-Type": "application/json"},
    )
    # Create a class
    response = test_client.post(
        "/class/create_class",
        data=json.dumps({"name": "Science 101"}),
        headers={"Content-Type": "application/json"},
    )
    class_id = response.json["class"]["id"]
    # Enroll students
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
    """
    GIVEN a logged-in non-teacher user
    WHEN POST /class/enroll_students is called
    THEN the request should be forbidden
    """
    # Register and login as non-teacher
    test_client.post(
        "/auth/register",
        data=json.dumps(
            {"name": "studentuser", "password": "123456", "email": "student@example.com"}),
        headers={"Content-Type": "application/json"},
    )
    test_client.post(
        "/auth/login",
        data=json.dumps({"email": "student@example.com", "password": "123456"}),
        headers={"Content-Type": "application/json"},
    )
    # Attempt to enroll students
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
    """
    GIVEN a logged-in teacher user
    WHEN POST /class/enroll_students is called with missing data
    THEN the request should return a 400 error
    """
    # Set the admin user by default into the database
    make_admin(email="teacher@example.com", password="teacher", name="teacheruser")
    # Login as teacher/admin
    test_client.post(
        "/auth/login",
        data=json.dumps({"email": "teacher@example.com", "password": "teacher"}),
        headers={"Content-Type": "application/json"},
    )
    # Attempt to enroll students with missing data
    response = test_client.post(
        "/class/enroll_students",
        data=json.dumps({"class_id": 1}),
        headers={"Content-Type": "application/json"},
    )
    assert response.status_code == 400
    assert response.json["msg"] == "Class ID and student emails are required"

def test_enroll_in_class_not_found(test_client, make_admin):
    """
    GIVEN a logged-in teacher user
    WHEN POST /class/enroll_students is called with a non-existent class ID
    THEN the request should return a 404 error
    """
    # Set the admin user by default into the database
    make_admin(email="teacher@example.com", password="teacher", name="teacheruser")
    # Login as teacher/admin
    test_client.post(
        "/auth/login",
        data=json.dumps({"email": "teacher@example.com", "password": "teacher"}),
        headers={"Content-Type": "application/json"},
    )
    # Attempt to enroll students in a non-existent class
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
    """
    GIVEN a logged-in teacher user who is not the teacher of the class
    WHEN POST /class/enroll_students is called
    THEN the request should return a 403 error
    """
    # Set the admin user by default into the database
    make_admin(email="teacher@example.com", password="teacher", name="teacheruser")
    make_admin(email="otherteacher@example.com", password="teacher", name="otherteacheruser")
    # Login as teacher/admin
    test_client.post(
        "/auth/login",
        data=json.dumps({"email": "otherteacher@example.com", "password": "teacher"}),
        headers={"Content-Type": "application/json"},
    )
    # Create a class as the first teacher
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
    # Login as other teacher
    test_client.post(
        "/auth/login",
        data=json.dumps({"email": "otherteacher@example.com", "password": "teacher"}),
        headers={"Content-Type": "application/json"},
    )
    # Attempt to enroll students
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
    """
    GIVEN a non-logged-in user
    WHEN POST /class/enroll_students is called
    THEN the request should be unauthorized
    """
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
    """
    GIVEN a logged-in teacher user
    WHEN POST /class/enroll_students is called with an empty CSV
    THEN no students should be enrolled
    """
    # Set the admin user by default into the database
    make_admin(email="teacher@example.com", password="teacher", name="teacheruser")
    # Login as teacher/admin
    test_client.post(
        "/auth/login",
        data=json.dumps({"email": "teacher@example.com", "password": "teacher"}),
        headers={"Content-Type": "application/json"},
    )
    # Create a class
    response = test_client.post(
        "/class/create_class",
        data=json.dumps({"name": "Science 101"}),
        headers={"Content-Type": "application/json"},
    )
    class_id = response.json["class"]["id"]
    # Enroll students with empty CSV
    csv_text = ""
    response = test_client.post(
        "/class/enroll_students",
        data=json.dumps({"class_id": class_id, "students": csv_text}),
        headers={"Content-Type": "application/json"},
    )
    assert response.status_code == 400
    assert response.json["msg"] == "Class ID and student emails are required"

def test_enroll_in_class_malformed_csv(test_client, make_admin):
    """
    GIVEN a logged-in teacher user
    WHEN POST /class/enroll_students is called with a malformed CSV
    THEN the request should return a 400 error
    """
    # Set the admin user by default into the database
    make_admin(email="teacher@example.com", password="teacher", name="teacheruser")
    # Login as teacher/admin
    test_client.post(
        "/auth/login",
        data=json.dumps({"email": "teacher@example.com", "password": "teacher"}),
        headers={"Content-Type": "application/json"},
    )
    # Create a class
    response = test_client.post(
        "/class/create_class",
        data=json.dumps({"name": "Science 101"}),
        headers={"Content-Type": "application/json"},
    )
    class_id = response.json["class"]["id"]
    # Enroll students with malformed CSV
    csv_text = (
        "id,name,email\n"
        "300325853,Gregory Bigglesworth\n"  # Missing email
        "300325854,Sarah Connor,sconnor@example.com\n"
    )
    response = test_client.post(
        "/class/enroll_students",
        data=json.dumps({"class_id": class_id, "students": csv_text}),
        headers={"Content-Type": "application/json"},
    )
    assert response.status_code == 400
    assert response.json["msg"] == "Errors in CSV"

def test_enroll_in_class_existing_student(test_client, make_admin):
    """
    GIVEN a logged-in teacher user
    WHEN POST /class/enroll_students is called with a student already enrolled
    THEN the student should not be enrolled again
    """
    # Set the admin user by default into the database
    make_admin(email="teacher@example.com", password="teacher", name="teacheruser")
    # Login as teacher/admin
    test_client.post(
        "/auth/login",
        data=json.dumps({"email": "teacher@example.com", "password": "teacher"}),
        headers={"Content-Type": "application/json"},
    )
    # Create a class
    response = test_client.post(
        "/class/create_class",
        data=json.dumps({"name": "Science 101"}),
        headers={"Content-Type": "application/json"},
    )
    class_id = response.json["class"]["id"]
    # Enroll a student
    csv_text = (
        "id,name,email\n"
        "300325854,Sarah Connor,sconnor@example.com\n"
    )
    test_client.post(
        "/class/enroll_students",
        data=json.dumps({"class_id": class_id, "students": csv_text}),
        headers={"Content-Type": "application/json"},
    )
    # Enroll the same student again
    response = test_client.post(
        "/class/enroll_students",
        data=json.dumps({"class_id": class_id, "students": csv_text}),
        headers={"Content-Type": "application/json"},
    )
    assert response.status_code == 200
    assert response.json["msg"] == "0 students added to course Science 101"

def test_enroll_in_class_invalid_email_format(test_client, make_admin):
    """
    GIVEN a logged-in teacher user
    WHEN POST /class/enroll_students is called with an invalid email format
    THEN the request should return a 400 error
    """
    # Set the admin user by default into the database
    make_admin(email="teacher@example.com", password="teacher", name="teacheruser")
    # Login as teacher/admin
    test_client.post(
        "/auth/login",
        data=json.dumps({"email": "teacher@example.com", "password": "teacher"}),
        headers={"Content-Type": "application/json"},
    )
    # Create a class
    response = test_client.post(
        "/class/create_class",
        data=json.dumps({"name": "Science 101"}),
        headers={"Content-Type": "application/json"},
    )
    class_id = response.json["class"]["id"]
    # Enroll students with invalid email format
    csv_text = (
        "id,name,email\n"
        "300500123,John Doe,johndoeatexample.com\n"
        "300325853,Gregory Bigglesworth,gbizzle-at-yandex.ru\n"  # Invalid email
        "300325854,Sarah Connor,sconnor@example.com\n"
    )
    response = test_client.post(
        "/class/enroll_students",
        data=json.dumps({"class_id": class_id, "students": csv_text}),
        headers={"Content-Type": "application/json"},
    )
    assert response.status_code == 400
    assert response.json["msg"] == "Invalid email format: johndoeatexample.com"

    # Backend test (pytest)
    # Add to flask_backend/tests/test_classes.py

    def test_roster_matched_registration(test_client, make_admin):
        """Test student registration with roster-matched courses"""
        # Create teacher and course
        make_admin(email="teacher@example.com", password="teacher", name="Teacher")
        test_client.post("/auth/login",
                         json={"email": "teacher@example.com", "password": "teacher"})

        course_resp = test_client.post("/class/create_class",
                                       json={"name": "CS 101"})
        course_id = course_resp.json["class"]["id"]

        # Upload roster with student email
        csv_data = "id,name,email\n1,John Doe,john@example.com"
        test_client.post("/class/enroll_students",
                         json={"class_id": course_id, "students": csv_data})

        # Student registers with same email
        register_resp = test_client.post("/auth/register",
                                         json={"name": "John Doe", "email": "john@example.com",
                                               "password": "newpass123"})

        # Should return available_courses
        assert register_resp.json["available_courses"][0]["id"] == course_id
        assert register_resp.status_code == 201