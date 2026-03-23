"""
Tests for assignments endpoints
"""

import json
import datetime
from api.models import Assignment

def test_teacher_can_create_assignment(test_client, make_admin):
    """
    GIVEN a teacher user
    WHEN they create a new assignment via POST /assignment
    THEN the assignment should be created successfully
    """
    # Use make_admin fixture to create a teacher user
    make_admin(email="admin@example.com", password="admin", name="adminuser")

    # Create a teacher user and log in
    test_client.post(
        "/auth/login",
        data=json.dumps({"email": "admin@example.com", "password": "admin"}),
        headers={"Content-Type": "application/json"},
    )
    # First, create a class to assign the assignment to
    class_response = test_client.post(
        "/class/create_class",
        data=json.dumps({"name": "History 101"}),
        headers={"Content-Type": "application/json"},
    )

    class_id = class_response.json["class"]["id"]
    due_date = (datetime.datetime.utcnow() + datetime.timedelta(days=10)).isoformat()

    # Now, create the assignment
    assignment_response = test_client.post(
        "/assignment/create_assignment",
        data=json.dumps(
            {"courseID": class_id, "name": "Essay 1", "rubric": "Quality of writing", "due_date": due_date}
        ),
        headers={"Content-Type": "application/json"},
    )
    
    assert assignment_response.status_code == 201
    assert assignment_response.json["msg"] == "Assignment created"
    assert assignment_response.json["assignment"]["name"] == "Essay 1"
    assert assignment_response.json["assignment"]["rubric_text"] == "Quality of writing"
    assert assignment_response.json["assignment"]["due_date"] == due_date


def test_teacher_cannot_create_assignment_with_past_due_date(test_client, make_admin):
    make_admin(email="admin@example.com", password="admin", name="adminuser")

    test_client.post(
        "/auth/login",
        data=json.dumps({"email": "admin@example.com", "password": "admin"}),
        headers={"Content-Type": "application/json"},
    )

    class_response = test_client.post(
        "/class/create_class",
        data=json.dumps({"name": "History 102"}),
        headers={"Content-Type": "application/json"},
    )

    class_id = class_response.json["class"]["id"]
    past_due_date = (datetime.datetime.utcnow() - datetime.timedelta(days=1)).isoformat()

    assignment_response = test_client.post(
        "/assignment/create_assignment",
        data=json.dumps(
            {"courseID": class_id, "name": "Essay Past", "rubric": "Quality", "due_date": past_due_date}
        ),
        headers={"Content-Type": "application/json"},
    )

    assert assignment_response.status_code == 400
    assert assignment_response.json["msg"] == "Due date cannot be in the past"


def test_create_assignment_missing_fields(test_client, make_admin):
    """
    GIVEN a teacher user
    WHEN they try to create an assignment with missing fields
    THEN the API should return a 400 error
    """
    # Use make_admin fixture to create a teacher user
    make_admin(email="admin@example.com", password="admin", name="adminuser")
    # Create a teacher user and log in
    test_client.post(
        "/auth/login",
        data=json.dumps({"email": "admin@example.com", "password": "admin"}),
        headers={"Content-Type": "application/json"},
    )
    # Attempt to create an assignment without a class_id
    response = test_client.post(
        "/assignment/create_assignment",
        data=json.dumps({"name": "Essay 1", "rubric": "Quality of writing"}),
        headers={"Content-Type": "application/json"},
    )
    assert response.status_code == 400
    assert response.json["msg"] == "Course ID is required"

    # Attempt to create an assignment without a name
    response = test_client.post(
        "/assignment/create_assignment",
        data=json.dumps({"courseID": 1, "rubric": "Quality of writing"}),
        headers={"Content-Type": "application/json"},
    )
    assert response.status_code == 400
    assert response.json["msg"] == "Assignment name is required"

def test_non_assigned_teacher_cannot_create_assignment(test_client, make_admin):
    """
    GIVEN a teacher user who is not assigned to the class
    WHEN they try to create an assignment for that class
    THEN the API should return a 403 error
    """
    # Use make_admin fixture to create a teacher user
    make_admin(email="teacher@example.com", password="teacher", name="teacheruser")
    make_admin(email="otherteacher@example.com", password="otherteacher", name="otherteacheruser")
    # Create a teacher user and log in
    test_client.post(
        "/auth/login",
        data=json.dumps({"email": "teacher@example.com", "password": "teacher"}),
        headers={"Content-Type": "application/json"},
    )
    # Create a class with a different teacher
    class_response = test_client.post(
        "/class/create_class",
        data=json.dumps({"name": "Math 101"}),
        headers={"Content-Type": "application/json"},
    )
    class_id = class_response.json["class"]["id"]
    # Log in as the other teacher
    test_client.post(
        "/auth/login",
        data=json.dumps({"email": "otherteacher@example.com", "password": "otherteacher"}),
        headers={"Content-Type": "application/json"},
    )

    # Attempt to create an assignment for the class
    response = test_client.post(
        "/assignment/create_assignment",
        data=json.dumps(
            {"courseID": class_id, "name": "Homework 1", "rubric": "Accuracy"}
        ),
        headers={"Content-Type": "application/json"},
    )
    assert response.status_code == 403
    assert response.json["msg"] == "Unauthorized: You are not the teacher of this class"
def test_nonexistent_class_cannot_create_assignment(test_client, make_admin):
    """
    GIVEN a teacher user
    WHEN they try to create an assignment for a non-existent class
    THEN the API should return a 404 error
    """
    # Use make_admin fixture to create a teacher user
    make_admin(email="teacher@example.com", password="teacher", name="teacheruser")
    # Create a teacher user and log in
    test_client.post(
        "/auth/login",
        data=json.dumps({"email": "teacher@example.com", "password": "teacher"}),
        headers={"Content-Type": "application/json"},
    )
    # Attempt to create an assignment for a non-existent class
    response = test_client.post(
        "/assignment/create_assignment",
        data=json.dumps(
            {"courseID": 999, "name": "Homework 1", "rubric": "Accuracy"}
        ),
        headers={"Content-Type": "application/json"},
    )
    assert response.status_code == 404
    assert response.json["msg"] == "Class not found"

def test_unauthenticated_user_cannot_create_assignment(test_client):
    """
    GIVEN an unauthenticated user
    WHEN they try to create an assignment
    THEN the API should return a 401 error
    """
    # Attempt to create an assignment without logging in
    response = test_client.post(
        "/assignment/create_assignment",
        data=json.dumps(
            {"class_id": 1, "name": "Homework 1", "rubric": "Accuracy"}
        ),
        headers={"Content-Type": "application/json"},
    )
    assert response.status_code == 401

# Test cases for editing and deleting assignments
def test_teacher_can_edit_assignment_before_due_date(test_client, make_admin):
    """
    GIVEN a teacher user
    WHEN they edit an assignment before its due date
    THEN the assignment should be updated successfully
    """
    # Use make_admin fixture to create a teacher user
    make_admin(email="teacher@example.com", password="teacher", name="teacheruser")
    # Create a teacher user and log in
    test_client.post(
        "/auth/login",
        data=json.dumps({"email": "teacher@example.com", "password": "teacher"}),
        headers={"Content-Type": "application/json"},
    )
    # First, create a class to assign the assignment to
    class_response = test_client.post(
        "/class/create_class",
        data=json.dumps({"name": "Science 101"}),
        headers={"Content-Type": "application/json"},
    )
    class_id = class_response.json["class"]["id"]
    # Now, create the assignment with a future due date relative to now
    future_due = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=60)
    assignment_response = test_client.post(
        "/assignment/create_assignment",
        data=json.dumps(
            {
                "courseID": class_id,
                "name": "Lab Report 1",
                "rubric": "Completeness",
                "due_date": future_due.replace(microsecond=0).isoformat(),
            }
        ),
        headers={"Content-Type": "application/json"},
    )
    assignment_id = assignment_response.json["assignment"]["id"]

    # Now, edit the assignment to an earlier (but still future) due date
    new_due = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=30)
    edit_response = test_client.patch(
        f"/assignment/edit_assignment/{assignment_id}",
        data=json.dumps(
            {
                "name": "Updated Lab Report 1",
                "rubric": "Thoroughness",
                "due_date": new_due.replace(microsecond=0).isoformat(),
            }
        ),
        headers={"Content-Type": "application/json"},
    )
    assert edit_response.status_code == 200
    assert edit_response.json["msg"] == "Assignment updated"
    assert edit_response.json["assignment"]["name"] == "Updated Lab Report 1"
    assert edit_response.json["assignment"]["rubric_text"] == "Thoroughness"
    # Ensure due_date returned matches the new due date (without microseconds)
    returned_due = edit_response.json["assignment"].get("due_date")
    assert returned_due is not None
    # Parse the returned ISO datetime (may include timezone) and compare to expected
    parsed_returned = datetime.datetime.fromisoformat(returned_due)
    # Normalize both datetimes to UTC timestamps and allow a small delta for processing time
    from datetime import timezone as _tz
    if parsed_returned.tzinfo is None:
        parsed_ts = parsed_returned.replace(tzinfo=_tz.utc).timestamp()
    else:
        parsed_ts = parsed_returned.astimezone(_tz.utc).timestamp()

    expected_ts = new_due.replace(microsecond=0).astimezone(_tz.utc).timestamp()
    assert abs(parsed_ts - expected_ts) < 2  # within 2 seconds


def test_teacher_can_edit_assignment_details_title_and_due_date(test_client, make_admin):
    make_admin(email="teacher@example.com", password="teacher", name="teacheruser")

    test_client.post(
        "/auth/login",
        data=json.dumps({"email": "teacher@example.com", "password": "teacher"}),
        headers={"Content-Type": "application/json"},
    )

    class_response = test_client.post(
        "/class/create_class",
        data=json.dumps({"name": "English 101"}),
        headers={"Content-Type": "application/json"},
    )
    class_id = class_response.json["class"]["id"]

    future_due = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=14)
    assignment_response = test_client.post(
        "/assignment/create_assignment",
        data=json.dumps(
            {
                "courseID": class_id,
                "name": "Essay Draft",
                "rubric": "Clarity",
                "due_date": future_due.replace(microsecond=0).isoformat(),
            }
        ),
        headers={"Content-Type": "application/json"},
    )
    assignment_id = assignment_response.json["assignment"]["id"]

    new_due_date_only = (datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=21)).date().isoformat()
    edit_response = test_client.patch(
        f"/assignment/edit_details/{assignment_id}",
        data=json.dumps(
            {
                "name": "Essay Final",
                "due_date": new_due_date_only,
                "description": "Updated instructions",
            }
        ),
        headers={"Content-Type": "application/json"},
    )

    assert edit_response.status_code == 200
    assert edit_response.json["msg"] == "Assignment details updated"
    assert edit_response.json["assignment"]["name"] == "Essay Final"
    assert edit_response.json["assignment"]["description"] == "Updated instructions"

    returned_due = edit_response.json["assignment"].get("due_date")
    assert returned_due is not None
    # For date-only updates, backend interprets end-of-day and should preserve the same calendar date.
    assert str(returned_due).startswith(new_due_date_only)


def test_teacher_cannot_set_past_due_date_via_edit_details(test_client, make_admin):
    make_admin(email="teacher@example.com", password="teacher", name="teacheruser")

    test_client.post(
        "/auth/login",
        data=json.dumps({"email": "teacher@example.com", "password": "teacher"}),
        headers={"Content-Type": "application/json"},
    )

    class_response = test_client.post(
        "/class/create_class",
        data=json.dumps({"name": "Biology 101"}),
        headers={"Content-Type": "application/json"},
    )
    class_id = class_response.json["class"]["id"]

    future_due = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=7)
    assignment_response = test_client.post(
        "/assignment/create_assignment",
        data=json.dumps(
            {
                "courseID": class_id,
                "name": "Lab 1",
                "rubric": "Accuracy",
                "due_date": future_due.replace(microsecond=0).isoformat(),
            }
        ),
        headers={"Content-Type": "application/json"},
    )
    assignment_id = assignment_response.json["assignment"]["id"]

    past_date_only = (datetime.datetime.now() - datetime.timedelta(days=1)).date().isoformat()
    edit_response = test_client.patch(
        f"/assignment/edit_details/{assignment_id}",
        data=json.dumps({"due_date": past_date_only}),
        headers={"Content-Type": "application/json"},
    )

    assert edit_response.status_code == 400
    assert edit_response.json["msg"] == "Due date cannot be in the past"


def test_teacher_can_edit_assignment_details_title_and_due_date_multipart(test_client, make_admin):
    make_admin(email="teacher@example.com", password="teacher", name="teacheruser")

    test_client.post(
        "/auth/login",
        data=json.dumps({"email": "teacher@example.com", "password": "teacher"}),
        headers={"Content-Type": "application/json"},
    )

    class_response = test_client.post(
        "/class/create_class",
        data=json.dumps({"name": "CS 101"}),
        headers={"Content-Type": "application/json"},
    )
    class_id = class_response.json["class"]["id"]

    future_due = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=10)
    assignment_response = test_client.post(
        "/assignment/create_assignment",
        data=json.dumps(
            {
                "courseID": class_id,
                "name": "HW 1",
                "rubric": "Correctness",
                "due_date": future_due.replace(microsecond=0).isoformat(),
            }
        ),
        headers={"Content-Type": "application/json"},
    )
    assignment_id = assignment_response.json["assignment"]["id"]

    new_due_date_only = (datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=12)).date().isoformat()
    edit_response = test_client.patch(
        f"/assignment/edit_details/{assignment_id}",
        data={
            "name": "HW 1 (Updated)",
            "due_date": new_due_date_only,
            "description": "New description",
        },
        content_type="multipart/form-data",
    )

    assert edit_response.status_code == 200
    assert edit_response.json["assignment"]["name"] == "HW 1 (Updated)"
    assert edit_response.json["assignment"]["description"] == "New description"
    returned_due = edit_response.json["assignment"].get("due_date")
    assert returned_due is not None
    assert str(returned_due).startswith(new_due_date_only)

def test_teacher_can_edit_assignment_after_due_date(test_client, make_admin, dbsession):
    """
    GIVEN a teacher user
    WHEN they try to edit an assignment after its due date
    THEN the API should allow the edit
    """
    # Use make_admin fixture to create a teacher user
    make_admin(email="teacher@example.com", password="teacher", name="teacheruser")
    # Create a teacher user and log in
    test_client.post(
        "/auth/login",
        data=json.dumps({"email": "teacher@example.com", "password": "teacher"}),
        headers={"Content-Type": "application/json"},
    )
    # First, create a class to assign the assignment to
    class_response = test_client.post(
        "/class/create_class",
        data=json.dumps({"name": "Art 101"}),
        headers={"Content-Type": "application/json"},
    )
    class_id = class_response.json["class"]["id"]
    # Create the assignment with a future due date (past due dates are disallowed at creation)
    assignment_response = test_client.post(
        "/assignment/create_assignment",
        data=json.dumps(
            {
                "courseID": class_id,
                "name": "Painting 1",
                "rubric": "Creativity",
                "due_date": (datetime.datetime.utcnow() + datetime.timedelta(days=1)).isoformat(),
            }
        ),
        headers={"Content-Type": "application/json"},
    )
    assignment_id = assignment_response.json["assignment"]["id"]

    # Simulate overdue by moving due_date into the past
    assignment = dbsession.get(Assignment, assignment_id)
    assignment.due_date = datetime.datetime.utcnow() - datetime.timedelta(days=1)
    dbsession.commit()
    # Now, attempt to edit the assignment
    edit_response = test_client.patch(
        f"/assignment/edit_assignment/{assignment_id}",
        data=json.dumps(
            {
                "name": "Updated Painting 1",
                "rubric": "Originality",
            }
        ),
        headers={"Content-Type": "application/json"},
    )
    assert edit_response.status_code == 200
    assert edit_response.json["msg"] == "Assignment updated"
    assert edit_response.json["assignment"]["name"] == "Updated Painting 1"
    assert edit_response.json["assignment"]["rubric_text"] == "Originality"

def test_non_assigned_teacher_cannot_edit_assignment(test_client, make_admin):
    """
    GIVEN a teacher user who is not assigned to the class
    WHEN they try to edit an assignment for that class
    THEN the API should return a 403 error
    """
    # Use make_admin fixture to create a teacher user
    make_admin(email="teacher@example.com", password="teacher", name="teacheruser")
    make_admin(email="otherteacher@example.com", password="teacher", name="otherteacheruser")
    # Create a teacher user and log in
    test_client.post(
        "/auth/login",
        data=json.dumps({"email": "teacher@example.com", "password": "teacher"}),
        headers={"Content-Type": "application/json"},
    )
    # First, create a class to assign the assignment to
    class_response = test_client.post(
        "/class/create_class",
        data=json.dumps({"name": "Music 101"}),
        headers={"Content-Type": "application/json"},
    )
    class_id = class_response.json["class"]["id"]
    # Now, create the assignment
    assignment_response = test_client.post(
        "/assignment/create_assignment",
        data=json.dumps(
            {
                "courseID": class_id,
                "name": "Composition 1",
                "rubric": "Harmony",
                "due_date": (datetime.datetime.utcnow() + datetime.timedelta(days=5)).isoformat(),
            }
        ),
        headers={"Content-Type": "application/json"},
    )
    assignment_id = assignment_response.json["assignment"]["id"]
    # Log in as the other teacher
    test_client.post(
        "/auth/login",
        data=json.dumps({"email": "otherteacher@example.com", "password": "teacher"}),
        headers={"Content-Type": "application/json"},
    )
    # Now, attempt to edit the assignment
    edit_response = test_client.patch(
        f"/assignment/edit_assignment/{assignment_id}",
        data=json.dumps(
            {
                "name": "Updated Composition 1",
                "rubric": "Melody",
            }
        ),
        headers={"Content-Type": "application/json"},
    )
    assert edit_response.status_code == 403
    assert edit_response.json["msg"] == "Unauthorized: You are not the teacher of this class"

def test_unauthenticated_user_cannot_edit_assignment(test_client):
    """
    GIVEN an unauthenticated user
    WHEN they try to edit an assignment
    THEN the API should return a 401 error
    """
    # Attempt to edit an assignment without logging in
    edit_response = test_client.patch(
        "/assignment/edit_assignment/1",
        data=json.dumps(
            {
                "name": "Updated Assignment",
                "rubric": "New Rubric",
            }
        ),
        headers={"Content-Type": "application/json"},
    )
    assert edit_response.status_code == 401

def test_edit_nonexistent_assignment(test_client, make_admin):
    """
    GIVEN a teacher user
    WHEN they try to edit a non-existent assignment
    THEN the API should return a 404 error
    """
    # Use make_admin fixture to create a teacher user
    make_admin(email="teacher@example.com", password="teacher", name="teacheruser")
    # Create a teacher user and log in
    test_client.post(
        "/auth/login",
        data=json.dumps({"email": "teacher@example.com", "password": "teacher"}),
        headers={"Content-Type": "application/json"},
    )
    # Attempt to edit a non-existent assignment
    edit_response = test_client.patch(
        "/assignment/edit_assignment/999",
        data=json.dumps(
            {
                "name": "Updated Assignment",
                "rubric": "New Rubric",
            }
        ),
        headers={"Content-Type": "application/json"},
    )
    assert edit_response.status_code == 404
    assert edit_response.json["msg"] == "Assignment not found"

def test_delete_assignment(test_client, make_admin):
    """
    GIVEN a teacher user
    WHEN they delete an assignment before its due date
    THEN the assignment should be deleted successfully
    """
    # Use make_admin fixture to create a teacher user
    make_admin(email="teacher@example.com", password="teacher", name="teacheruser")
    # Create a teacher user and log in
    test_client.post(
        "/auth/login",
        data=json.dumps({"email": "teacher@example.com", "password": "teacher"}),
        headers={"Content-Type": "application/json"},
    )
    # First, create a class to assign the assignment to
    class_response = test_client.post(
        "/class/create_class",
        data=json.dumps({"name": "Philosophy 101"}),
        headers={"Content-Type": "application/json"},
    )
    class_id = class_response.json["class"]["id"]
    # Now, create the assignment with a future due date
    assignment_response = test_client.post(
        "/assignment/create_assignment",
        data=json.dumps(
            {
                "courseID": class_id,
                "name": "Essay on Ethics",
                "rubric": "Argumentation",
                "due_date": (datetime.datetime.utcnow() + datetime.timedelta(days=7)).isoformat(),
            }
        ),
        headers={"Content-Type": "application/json"},
    )
    assignment_id = assignment_response.json["assignment"]["id"]
    # Now, delete the assignment
    delete_response = test_client.delete(
        f"/assignment/delete_assignment/{assignment_id}",
        headers={"Content-Type": "application/json"},
    )
    assert delete_response.status_code == 200
    assert delete_response.json["msg"] == "Assignment deleted"

def test_delete_assignment_after_due_date(test_client, make_admin, dbsession):
    """
    GIVEN a teacher user
    WHEN they try to delete an assignment after its due date
    THEN the API should allow deletion
    """
    # Use make_admin fixture to create a teacher user
    make_admin(email="teacher@example.com", password="teacher", name="teacheruser")
    # Create a teacher user and log in
    test_client.post(
        "/auth/login",
        data=json.dumps({"email": "teacher@example.com", "password": "teacher"}),
        headers={"Content-Type": "application/json"},
    )
    # First, create a class to assign the assignment to
    class_response = test_client.post(
        "/class/create_class",
        data=json.dumps({"name": "Economics 101"}),
        headers={"Content-Type": "application/json"},
    )
    class_id = class_response.json["class"]["id"]
    # Create the assignment with a future due date (past due dates are disallowed at creation)
    assignment_response = test_client.post(
        "/assignment/create_assignment",
        data=json.dumps(
            {
                "courseID": class_id,
                "name": "Market Analysis",
                "rubric": "Data Interpretation",
                "due_date": (datetime.datetime.utcnow() + datetime.timedelta(days=1)).isoformat(),
            }
        ),
        headers={"Content-Type": "application/json"},
    )
    assignment_id = assignment_response.json["assignment"]["id"]

    # Simulate overdue by moving due_date into the past
    assignment = dbsession.get(Assignment, assignment_id)
    assignment.due_date = datetime.datetime.utcnow() - datetime.timedelta(days=1)
    dbsession.commit()
    # Now, attempt to delete the assignment
    delete_response = test_client.delete(
        f"/assignment/delete_assignment/{assignment_id}",
        headers={"Content-Type": "application/json"},
    )
    assert delete_response.status_code == 200
    assert delete_response.json["msg"] == "Assignment deleted"

def test_non_assigned_teacher_cannot_delete_assignment(test_client, make_admin):
    """
    GIVEN a teacher user who is not assigned to the class
    WHEN they try to delete an assignment for that class
    THEN the API should allow deletion (admin override)
    """
    # Use make_admin fixture to create a teacher user
    make_admin(email="teacher@example.com", password="teacher", name="teacheruser")
    make_admin(email="otherteacher@example.com", password="teacher", name="otherteacheruser")
    # Create a teacher user and log in
    test_client.post(
        "/auth/login",
        data=json.dumps({"email": "otherteacher@example.com", "password": "teacher"}),
        headers={"Content-Type": "application/json"},
    )
    # First, create a class to assign the assignment to
    class_response = test_client.post(
        "/class/create_class",
        data=json.dumps({"name": "Geography 101"}),
        headers={"Content-Type": "application/json"},
    )
    class_id = class_response.json["class"]["id"]
    # Now, create the assignment as the first teacher
    assignment_response = test_client.post(
        "/assignment/create_assignment",
        data=json.dumps(
            {
                "courseID": class_id,
                "name": "Geography Assignment",
                "rubric": "Map Skills",
                "due_date": (datetime.datetime.utcnow() + datetime.timedelta(days=7)).isoformat(),
            }
        ),
        headers={"Content-Type": "application/json"},
    )
    assignment_id = assignment_response.json["assignment"]["id"]

    # Now, attempt to delete the assignment as the other teacher
    test_client.post(
        "/auth/login",
        data=json.dumps({"email": "teacher@example.com", "password": "teacher"}),
        headers={"Content-Type": "application/json"},
    )

    delete_response = test_client.delete(
        f"/assignment/delete_assignment/{assignment_id}",
        headers={"Content-Type": "application/json"},
    )
    assert delete_response.status_code == 200
    assert delete_response.json["msg"] == "Assignment deleted"

def test_unauthenticated_user_cannot_delete_assignment(test_client):
    """
    GIVEN an unauthenticated user
    WHEN they try to delete an assignment
    THEN the API should return a 401 error
    """
    # Attempt to delete an assignment without logging in
    delete_response = test_client.delete(
        "/assignment/delete_assignment/1",
        headers={"Content-Type": "application/json"},
    )
    assert delete_response.status_code == 401

def test_delete_nonexistent_assignment(test_client, make_admin):
    """
    GIVEN a teacher user
    WHEN they try to delete a non-existent assignment
    THEN the API should return a 404 error
    """
    # Use make_admin fixture to create a teacher user
    make_admin(email="teacher@example.com", password="teacher", name="teacheruser")
    # Create a teacher user and log in
    test_client.post(
        "/auth/login",
        data=json.dumps({"email": "teacher@example.com", "password": "teacher"}),
        headers={"Content-Type": "application/json"},
    )
    # Attempt to delete a non-existent assignment
    delete_response = test_client.delete(
        "/assignment/delete_assignment/999",
        headers={"Content-Type": "application/json"},
    )
    assert delete_response.status_code == 404
    assert delete_response.json["msg"] == "Assignment not found"

def test_get_assignments_by_class_id(test_client, make_admin):
    """
    GIVEN a teacher user
    WHEN they request assignments for a specific class
    THEN the API should return the list of assignments for that class
    """
    # Use make_admin fixture to create a teacher user
    make_admin(email="teacher@example.com", password="teacher", name="teacheruser")
    # Create a teacher user and log in
    test_client.post(
        "/auth/login",
        data=json.dumps({"email": "teacher@example.com", "password": "teacher"}),
        headers={"Content-Type": "application/json"},
    )
    # First, create a class to assign the assignments to
    class_response = test_client.post(
        "/class/create_class",
        data=json.dumps({"name": "Literature 101"}),
        headers={"Content-Type": "application/json"},
    )
    class_id = class_response.json["class"]["id"]
    # Now, create multiple assignments for the class
    assignment_names = ["Poetry Analysis", "Novel Review", "Drama Essay"]
    for name in assignment_names:
        test_client.post(
            "/assignment/create_assignment",
            data=json.dumps(
                {
                    "courseID": class_id,
                    "name": name,
                    "rubric": "Content Quality",
                    "due_date": (datetime.datetime.utcnow() + datetime.timedelta(days=10)).isoformat(),
                }
            ),
            headers={"Content-Type": "application/json"},
        )
    # Now, retrieve assignments for the class
    assignments = test_client.get(f"/assignment/{class_id}")
    assert assignments.status_code == 200
    assert len(assignments.json) == 3
    returned_names = [assignment["name"] for assignment in assignments.json]
    for name in assignment_names:
        assert name in returned_names

def test_get_assignments_by_class_id_no_assignments(test_client, make_admin):
    """
    GIVEN a teacher user
    WHEN they request assignments for a class with no assignments
    THEN the API should return an empty list
    """
    # Use make_admin fixture to create a teacher user
    make_admin(email="teacher@example.com", password="teacher", name="teacheruser")
    # Create a teacher user and log in
    test_client.post(
        "/auth/login",
        data=json.dumps({"email": "teacher@example.com", "password": "teacher"}),
        headers={"Content-Type": "application/json"},
    )
    # First, create a class with no assignments
    class_response = test_client.post(
        "/class/create_class",
        data=json.dumps({"name": "Philosophy 102"}),
        headers={"Content-Type": "application/json"},
    )
    class_id = class_response.json["class"]["id"]
    # Now, retrieve assignments for the class
    assignments = test_client.get(f"/assignment/{class_id}")
    assert assignments.status_code == 200
    assert len(assignments.json) == 0

def test_get_assignments_by_class_id_nonexistent_class(test_client, make_admin):
    """
    GIVEN a teacher user
    WHEN they request assignments for a non-existent class
    THEN the API should return a 404 error
    """
    # Use make_admin fixture to create a teacher user
    make_admin(email="teacher@example.com", password="teacher", name="teacheruser")
    # Create a teacher user and log in
    test_client.post(
        "/auth/login",
        data=json.dumps({"email": "teacher@example.com", "password": "teacher"}),
        headers={"Content-Type": "application/json"},
    )
    # Attempt to retrieve assignments for a non-existent class
    assignments = test_client.get(f"/assignment/999")
    assert assignments.status_code == 404
    assert assignments.json["msg"] == "Class not found"

def test_unauthenticated_user_cannot_get_assignments(test_client):
    """
    GIVEN an unauthenticated user
    WHEN they try to get assignments for a class
    THEN the API should return a 401 error
    """
    # Attempt to retrieve assignments for a class without logging in
    assignments = test_client.get(f"/assignment/1")
    assert assignments.status_code == 401


def test_teacher_can_create_assignment_with_due_date(test_client, make_admin):
    """
    GIVEN a teacher user
    WHEN they create a new assignment with a due date via POST /assignment/create_assignment
    THEN the assignment should be created with the due date stored
    """
    # ARRANGE - Create teacher and login
    make_admin(email="teacher@example.com", password="teacher", name="teacheruser")
    test_client.post(
        "/auth/login",
        data=json.dumps({"email": "teacher@example.com", "password": "teacher"}),
        headers={"Content-Type": "application/json"},
    )
    
    # Create a class first
    class_response = test_client.post(
        "/class/create_class",
        data=json.dumps({"name": "Math 101"}),
        headers={"Content-Type": "application/json"},
    )
    class_id = class_response.json["class"]["id"]
    due_date = (datetime.datetime.utcnow() + datetime.timedelta(days=14)).isoformat()

    # ACT - Create assignment with due date
    response = test_client.post(
        "/assignment/create_assignment",
        data=json.dumps(
            {"courseID": class_id, "name": "Homework 1", "due_date": due_date}
        ),
        headers={"Content-Type": "application/json"},
    )
    
    # ASSERT - Verify success
    assert response.status_code == 201
    assert response.json["msg"] == "Assignment created"
    assert response.json["assignment"]["name"] == "Homework 1"
    assert response.json["assignment"]["due_date"] == due_date


def test_create_assignment_without_due_date_is_rejected(test_client, make_admin):
    """
    GIVEN a teacher user
    WHEN they create an assignment without a due date
    THEN the API should reject the request
    """
    # ARRANGE
    make_admin(email="teacher@example.com", password="teacher", name="teacheruser")
    test_client.post(
        "/auth/login",
        data=json.dumps({"email": "teacher@example.com", "password": "teacher"}),
        headers={"Content-Type": "application/json"},
    )
    
    class_response = test_client.post(
        "/class/create_class",
        data=json.dumps({"name": "English 101"}),
        headers={"Content-Type": "application/json"},
    )
    class_id = class_response.json["class"]["id"]

    # ACT - Create assignment WITHOUT due date
    response = test_client.post(
        "/assignment/create_assignment",
        data=json.dumps(
            {"courseID": class_id, "name": "Essay"}
        ),
        headers={"Content-Type": "application/json"},
    )
    
    # ASSERT
    assert response.status_code == 400
    assert response.json["msg"] == "Due date is required"


def test_create_assignment_with_invalid_due_date_format(test_client, make_admin):
    """
    GIVEN a teacher user
    WHEN they try to create an assignment with an invalid due date format
    THEN the API should return a 400 error
    """
    # ARRANGE
    make_admin(email="teacher@example.com", password="teacher", name="teacheruser")
    test_client.post(
        "/auth/login",
        data=json.dumps({"email": "teacher@example.com", "password": "teacher"}),
        headers={"Content-Type": "application/json"},
    )
    
    class_response = test_client.post(
        "/class/create_class",
        data=json.dumps({"name": "Science 101"}),
        headers={"Content-Type": "application/json"},
    )
    class_id = class_response.json["class"]["id"]

    # ACT - Try to create with bad date format
    response = test_client.post(
        "/assignment/create_assignment",
        data=json.dumps(
            {"courseID": class_id, "name": "Lab Report", "due_date": "not-a-date"}
        ),
        headers={"Content-Type": "application/json"},
    )
    
    # ASSERT
    assert response.status_code == 400
    assert "Invalid due date format" in response.json["msg"]
