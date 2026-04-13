"""Tests for gradebook endpoints: GET /class/<id>/gradebook and PATCH /class/<id>/gradebook/<student_id>/<assignment_id>."""

import json
import pytest
from werkzeug.security import generate_password_hash

from api.models import (
    Assignment,
    Course,
    CriteriaDescription,
    Criterion,
    Group,
    GroupEvaluationCriterion,
    GroupEvaluationSubmission,
    GroupEvaluationTarget,
    GroupMember,
    Review,
    Rubric,
    Submission,
    User,
)
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


@pytest.fixture
def make_assignment():
    def _make_assignment(course_id, name="Assignment 1"):
        assignment = Assignment(
            courseID=course_id,
            name=name,
            rubric_text=None,
            assignment_type="standard",
        )
        _db.session.add(assignment)
        _db.session.commit()
        return assignment

    return _make_assignment


def test_teacher_can_get_gradebook(test_client, make_user, make_course, make_assignment, enroll_user_in_course):
    teacher = make_user(role="teacher", email="t@example.com", password="tpass", name="Teacher")
    student = make_user(role="student", email="s@example.com", password="spass", name="Student")
    course = make_course(teacher_id=teacher.id)
    assignment = make_assignment(course_id=course.id)
    enroll_user_in_course(student.id, course.id)

    login_as(test_client, "t@example.com", "tpass")
    resp = test_client.get(f"/class/{course.id}/gradebook")
    assert resp.status_code == 200
    data = resp.json
    assert "assignments" in data
    assert "rows" in data
    assert len(data["assignments"]) == 1
    assert data["assignments"][0]["id"] == assignment.id
    assert data["assignments"][0]["assignment_type"] == "standard"
    assert data["assignments"][0]["max_points"] is None
    assert len(data["rows"]) == 1
    assert data["rows"][0]["student"]["id"] == student.id
    assert data["rows"][0]["grades"][str(assignment.id)] is None
    assert data["rows"][0]["feedback_counts"][str(assignment.id)] is None


def test_gradebook_shows_existing_grade(test_client, make_user, make_course, make_assignment, enroll_user_in_course):
    teacher = make_user(role="teacher", email="t@example.com", password="tpass", name="Teacher")
    student = make_user(role="student", email="s@example.com", password="spass", name="Student")
    course = make_course(teacher_id=teacher.id)
    assignment = make_assignment(course_id=course.id)
    enroll_user_in_course(student.id, course.id)

    # Create a submission with a grade
    submission = Submission(path=None, studentID=student.id, assignmentID=assignment.id)
    submission.grade = 85.0
    _db.session.add(submission)
    _db.session.commit()

    login_as(test_client, "t@example.com", "tpass")
    resp = test_client.get(f"/class/{course.id}/gradebook")
    assert resp.status_code == 200
    assert resp.json["rows"][0]["grades"][str(assignment.id)] == 85.0


def test_teacher_can_update_grade(test_client, make_user, make_course, make_assignment, enroll_user_in_course):
    teacher = make_user(role="teacher", email="t@example.com", password="tpass", name="Teacher")
    student = make_user(role="student", email="s@example.com", password="spass", name="Student")
    course = make_course(teacher_id=teacher.id)
    assignment = make_assignment(course_id=course.id)
    enroll_user_in_course(student.id, course.id)

    login_as(test_client, "t@example.com", "tpass")
    resp = test_client.patch(
        f"/class/{course.id}/gradebook/{student.id}/{assignment.id}",
        data=json.dumps({"grade": 92.5}),
        headers={"Content-Type": "application/json"},
    )
    assert resp.status_code == 200
    assert resp.json["grade"] == 92.5

    # Confirm it shows in gradebook
    gb_resp = test_client.get(f"/class/{course.id}/gradebook")
    assert gb_resp.json["rows"][0]["grades"][str(assignment.id)] == 92.5


def test_teacher_can_clear_grade(test_client, make_user, make_course, make_assignment, enroll_user_in_course):
    teacher = make_user(role="teacher", email="t@example.com", password="tpass", name="Teacher")
    student = make_user(role="student", email="s@example.com", password="spass", name="Student")
    course = make_course(teacher_id=teacher.id)
    assignment = make_assignment(course_id=course.id)
    enroll_user_in_course(student.id, course.id)

    # Set grade first
    login_as(test_client, "t@example.com", "tpass")
    test_client.patch(
        f"/class/{course.id}/gradebook/{student.id}/{assignment.id}",
        data=json.dumps({"grade": 75.0}),
        headers={"Content-Type": "application/json"},
    )

    # Clear the grade
    resp = test_client.patch(
        f"/class/{course.id}/gradebook/{student.id}/{assignment.id}",
        data=json.dumps({"grade": None}),
        headers={"Content-Type": "application/json"},
    )
    assert resp.status_code == 200
    assert resp.json["grade"] is None


def test_student_cannot_access_gradebook(test_client, make_user, make_course, enroll_user_in_course):
    teacher = make_user(role="teacher", email="t@example.com", password="tpass", name="Teacher")
    student = make_user(role="student", email="s@example.com", password="spass", name="Student")
    course = make_course(teacher_id=teacher.id)
    enroll_user_in_course(student.id, course.id)

    login_as(test_client, "s@example.com", "spass")
    resp = test_client.get(f"/class/{course.id}/gradebook")
    assert resp.status_code == 403


def test_student_cannot_update_grade(test_client, make_user, make_course, make_assignment, enroll_user_in_course):
    teacher = make_user(role="teacher", email="t@example.com", password="tpass", name="Teacher")
    student = make_user(role="student", email="s@example.com", password="spass", name="Student")
    course = make_course(teacher_id=teacher.id)
    assignment = make_assignment(course_id=course.id)
    enroll_user_in_course(student.id, course.id)

    login_as(test_client, "s@example.com", "spass")
    resp = test_client.patch(
        f"/class/{course.id}/gradebook/{student.id}/{assignment.id}",
        data=json.dumps({"grade": 100}),
        headers={"Content-Type": "application/json"},
    )
    assert resp.status_code == 403


def test_update_grade_negative_rejected(test_client, make_user, make_course, make_assignment, enroll_user_in_course):
    teacher = make_user(role="teacher", email="t@example.com", password="tpass", name="Teacher")
    student = make_user(role="student", email="s@example.com", password="spass", name="Student")
    course = make_course(teacher_id=teacher.id)
    assignment = make_assignment(course_id=course.id)
    enroll_user_in_course(student.id, course.id)

    login_as(test_client, "t@example.com", "tpass")
    resp = test_client.patch(
        f"/class/{course.id}/gradebook/{student.id}/{assignment.id}",
        data=json.dumps({"grade": -5}),
        headers={"Content-Type": "application/json"},
    )
    assert resp.status_code == 400


def test_other_teacher_cannot_access_gradebook(test_client, make_user, make_course, enroll_user_in_course):
    teacher1 = make_user(role="teacher", email="t1@example.com", password="t1pass", name="Teacher1")
    teacher2 = make_user(role="teacher", email="t2@example.com", password="t2pass", name="Teacher2")
    course = make_course(teacher_id=teacher1.id)

    login_as(test_client, "t2@example.com", "t2pass")
    resp = test_client.get(f"/class/{course.id}/gradebook")
    assert resp.status_code == 403


def test_gradebook_shows_individual_peer_eval_received_total(test_client, make_user, make_course, enroll_user_in_course):
    teacher = make_user(role="teacher", email="t@example.com", password="tpass", name="Teacher")
    reviewer = make_user(role="student", email="r@example.com", password="rpass", name="Reviewer")
    reviewee = make_user(role="student", email="e@example.com", password="epass", name="Reviewee")
    course = make_course(teacher_id=teacher.id)
    enroll_user_in_course(reviewer.id, course.id)
    enroll_user_in_course(reviewee.id, course.id)

    assignment = Assignment(
        courseID=course.id,
        name="Peer Eval",
        rubric_text="",
        assignment_type="peer_eval_individual",
    )
    _db.session.add(assignment)
    _db.session.commit()

    rubric = Rubric(assignmentID=assignment.id)
    _db.session.add(rubric)
    _db.session.commit()

    row = CriteriaDescription(rubricID=rubric.id, question="Q1", scoreMax=10)
    _db.session.add(row)
    _db.session.commit()

    review = Review(
        assignmentID=assignment.id,
        reviewerID=reviewer.id,
        revieweeID=reviewee.id,
        completed=True,
    )
    _db.session.add(review)
    _db.session.commit()

    criterion = Criterion(reviewID=review.id, criterionRowID=row.id, grade=8, comments="good")
    _db.session.add(criterion)
    _db.session.commit()

    login_as(test_client, "t@example.com", "tpass")
    resp = test_client.get(f"/class/{course.id}/gradebook")
    assert resp.status_code == 200

    rows_by_student = {r["student"]["id"]: r for r in resp.json["rows"]}
    assignments_by_id = {a["id"]: a for a in resp.json["assignments"]}
    assert assignments_by_id[assignment.id]["max_points"] == 10
    assert assignments_by_id[assignment.id]["assignment_type"] == "peer_eval_individual"
    assert rows_by_student[reviewee.id]["grades"][str(assignment.id)] == 8.0
    assert rows_by_student[reviewee.id]["feedback_counts"][str(assignment.id)] == 1
    assert rows_by_student[reviewer.id]["grades"][str(assignment.id)] is None
    assert rows_by_student[reviewer.id]["feedback_counts"][str(assignment.id)] is None


def test_gradebook_shows_group_peer_eval_received_total_for_group_members(
    test_client,
    make_user,
    make_course,
    enroll_user_in_course,
):
    teacher = make_user(role="teacher", email="t@example.com", password="tpass", name="Teacher")
    member1 = make_user(role="student", email="m1@example.com", password="m1pass", name="Member 1")
    member2 = make_user(role="student", email="m2@example.com", password="m2pass", name="Member 2")
    other = make_user(role="student", email="o@example.com", password="opass", name="Other")
    course = make_course(teacher_id=teacher.id)
    enroll_user_in_course(member1.id, course.id)
    enroll_user_in_course(member2.id, course.id)
    enroll_user_in_course(other.id, course.id)

    assignment = Assignment(
        courseID=course.id,
        name="Group Peer Eval",
        rubric_text="",
        assignment_type="peer_eval_group",
    )
    _db.session.add(assignment)
    _db.session.commit()

    rubric = Rubric(assignmentID=assignment.id)
    _db.session.add(rubric)
    _db.session.commit()

    row = CriteriaDescription(rubricID=rubric.id, question="Q1", scoreMax=10)
    _db.session.add(row)
    _db.session.commit()

    g1 = Group(name="G1", course_id=course.id)
    g2 = Group(name="G2", course_id=course.id)
    _db.session.add(g1)
    _db.session.add(g2)
    _db.session.commit()

    _db.session.add(GroupMember(group_id=g1.id, user_id=member1.id))
    _db.session.add(GroupMember(group_id=g1.id, user_id=member2.id))
    _db.session.add(GroupMember(group_id=g2.id, user_id=other.id))
    _db.session.commit()

    submission = GroupEvaluationSubmission(
        assignment_id=assignment.id,
        reviewer_group_id=g2.id,
        submitted_by_user_id=other.id,
    )
    _db.session.add(submission)
    _db.session.commit()

    target = GroupEvaluationTarget(submission_id=submission.id, reviewee_group_id=g1.id)
    _db.session.add(target)
    _db.session.commit()

    _db.session.add(GroupEvaluationCriterion(target_id=target.id, criterionRowID=row.id, grade=7))
    _db.session.commit()

    login_as(test_client, "t@example.com", "tpass")
    resp = test_client.get(f"/class/{course.id}/gradebook")
    assert resp.status_code == 200

    rows_by_student = {r["student"]["id"]: r for r in resp.json["rows"]}
    assignments_by_id = {a["id"]: a for a in resp.json["assignments"]}
    assert assignments_by_id[assignment.id]["max_points"] == 10
    assert assignments_by_id[assignment.id]["assignment_type"] == "peer_eval_group"
    assert rows_by_student[member1.id]["grades"][str(assignment.id)] == 7.0
    assert rows_by_student[member1.id]["feedback_counts"][str(assignment.id)] == 1
    assert rows_by_student[member2.id]["grades"][str(assignment.id)] == 7.0
    assert rows_by_student[member2.id]["feedback_counts"][str(assignment.id)] == 1
    assert rows_by_student[other.id]["grades"][str(assignment.id)] is None
    assert rows_by_student[other.id]["feedback_counts"][str(assignment.id)] is None

