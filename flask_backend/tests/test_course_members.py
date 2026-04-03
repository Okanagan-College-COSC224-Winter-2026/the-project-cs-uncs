"""Tests for course members endpoint."""

import json

import pytest
from werkzeug.security import generate_password_hash

from api.models import Assignment, Course, Group, GroupMember, Review, User
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


def test_course_teacher_can_fetch_members(test_client, make_user, enroll_user_in_course):
    teacher = make_user(role="teacher", email="t@example.com", password="tpass", name="Teacher")
    student = make_user(role="student", email="s@example.com", password="spass", name="Student")

    course = Course(teacherID=teacher.id, name="History")
    _db.session.add(course)
    _db.session.commit()

    enroll_user_in_course(student.id, course.id)

    login_as(test_client, "t@example.com", "tpass")

    resp = test_client.post(
        "/class/members",
        data=json.dumps({"id": course.id}),
        headers={"Content-Type": "application/json"},
    )

    assert resp.status_code == 200
    assert any(m["id"] == student.id for m in resp.json)


def test_non_enrolled_student_cannot_fetch_members(test_client, make_user):
    teacher = make_user(role="teacher", email="t@example.com", password="tpass", name="Teacher")
    student = make_user(role="student", email="s@example.com", password="spass", name="Student")

    course = Course(teacherID=teacher.id, name="History")
    _db.session.add(course)
    _db.session.commit()

    login_as(test_client, "s@example.com", "spass")

    resp = test_client.post(
        "/class/members",
        data=json.dumps({"id": course.id}),
        headers={"Content-Type": "application/json"},
    )

    assert resp.status_code == 403


def test_course_teacher_can_remove_member(test_client, make_user, enroll_user_in_course):
    teacher = make_user(role="teacher", email="t@example.com", password="tpass", name="Teacher")
    student = make_user(role="student", email="s@example.com", password="spass", name="Student")

    course = Course(teacherID=teacher.id, name="History")
    _db.session.add(course)
    _db.session.commit()

    enroll_user_in_course(student.id, course.id)

    login_as(test_client, "t@example.com", "tpass")

    resp = test_client.post(
        "/class/remove_member",
        data=json.dumps({"class_id": course.id, "user_id": student.id}),
        headers={"Content-Type": "application/json"},
    )
    assert resp.status_code == 200

    members_resp = test_client.post(
        "/class/members",
        data=json.dumps({"id": course.id}),
        headers={"Content-Type": "application/json"},
    )
    assert members_resp.status_code == 200
    assert not any(m["id"] == student.id for m in members_resp.json)


def test_student_cannot_remove_member(test_client, make_user, enroll_user_in_course):
    teacher = make_user(role="teacher", email="t@example.com", password="tpass", name="Teacher")
    student = make_user(role="student", email="s@example.com", password="spass", name="Student")

    course = Course(teacherID=teacher.id, name="History")
    _db.session.add(course)
    _db.session.commit()

    enroll_user_in_course(student.id, course.id)

    login_as(test_client, "s@example.com", "spass")

    resp = test_client.post(
        "/class/remove_member",
        data=json.dumps({"class_id": course.id, "user_id": student.id}),
        headers={"Content-Type": "application/json"},
    )
    assert resp.status_code == 403


def test_remove_member_also_removes_group_membership(test_client, make_user, enroll_user_in_course):
    teacher = make_user(role="teacher", email="t2@example.com", password="tpass", name="Teacher")
    student = make_user(role="student", email="s2@example.com", password="spass", name="Student")

    course = Course(teacherID=teacher.id, name="History")
    _db.session.add(course)
    _db.session.commit()

    enroll_user_in_course(student.id, course.id)

    group = Group(name="G1", course_id=course.id)
    _db.session.add(group)
    _db.session.commit()
    GroupMember.add_member(group.id, student.id)

    assert GroupMember.query.filter_by(group_id=group.id, user_id=student.id).first() is not None

    login_as(test_client, "t2@example.com", "tpass")
    resp = test_client.post(
        "/class/remove_member",
        data=json.dumps({"class_id": course.id, "user_id": student.id}),
        headers={"Content-Type": "application/json"},
    )
    assert resp.status_code == 200

    assert GroupMember.query.filter_by(group_id=group.id, user_id=student.id).first() is None


def test_remove_member_deletes_incomplete_individual_reviews_involving_student(
    test_client, make_user, enroll_user_in_course
):
    teacher = make_user(role="teacher", email="t3@example.com", password="tpass", name="Teacher")
    reviewer = make_user(role="student", email="r@example.com", password="spass", name="Reviewer")
    removed = make_user(role="student", email="x@example.com", password="spass", name="Removed")

    course = Course(teacherID=teacher.id, name="History")
    _db.session.add(course)
    _db.session.commit()

    enroll_user_in_course(reviewer.id, course.id)
    enroll_user_in_course(removed.id, course.id)

    assignment = Assignment(
        courseID=course.id,
        name="Indiv Peer Eval",
        rubric_text="",
        assignment_type="peer_eval_individual",
    )
    _db.session.add(assignment)
    _db.session.commit()

    review = Review(assignmentID=assignment.id, reviewerID=reviewer.id, revieweeID=removed.id)
    _db.session.add(review)
    _db.session.commit()

    assert Review.query.filter_by(id=review.id).first() is not None

    login_as(test_client, "t3@example.com", "tpass")
    resp = test_client.post(
        "/class/remove_member",
        data=json.dumps({"class_id": course.id, "user_id": removed.id}),
        headers={"Content-Type": "application/json"},
    )
    assert resp.status_code == 200

    assert Review.query.filter_by(id=review.id).first() is None


def test_received_feedback_hides_reviews_from_removed_course_member(
    test_client, make_user, enroll_user_in_course
):
    teacher = make_user(role="teacher", email="t4@example.com", password="tpass", name="Teacher")
    reviewer = make_user(role="student", email="rev@example.com", password="spass", name="Reviewer")
    reviewee = make_user(role="student", email="mee@example.com", password="spass", name="Reviewee")

    course = Course(teacherID=teacher.id, name="History")
    _db.session.add(course)
    _db.session.commit()

    enroll_user_in_course(reviewer.id, course.id)
    enroll_user_in_course(reviewee.id, course.id)

    assignment = Assignment(
        courseID=course.id,
        name="Indiv Peer Eval",
        rubric_text="",
        assignment_type="peer_eval_individual",
    )
    _db.session.add(assignment)
    _db.session.commit()

    review = Review(assignmentID=assignment.id, reviewerID=reviewer.id, revieweeID=reviewee.id, completed=True)
    _db.session.add(review)
    _db.session.commit()

    login_as(test_client, "mee@example.com", "spass")
    before = test_client.get(f"/review/received/{assignment.id}")
    assert before.status_code == 200
    assert before.get_json()["total_reviews"] == 1

    # Remove the reviewer from the course.
    login_as(test_client, "t4@example.com", "tpass")
    resp = test_client.post(
        "/class/remove_member",
        data=json.dumps({"class_id": course.id, "user_id": reviewer.id}),
        headers={"Content-Type": "application/json"},
    )
    assert resp.status_code == 200

    # Review is deleted so it no longer appears in "My Feedback".
    assert Review.query.filter_by(id=review.id).first() is None

    login_as(test_client, "mee@example.com", "spass")
    after = test_client.get(f"/review/received/{assignment.id}")
    assert after.status_code == 200
    assert after.get_json()["total_reviews"] == 0
