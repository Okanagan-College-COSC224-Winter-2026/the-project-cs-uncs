"""Tests for new peer evaluation flows.

Covers:
- Group peer eval: included groups must review all other included groups; one submission per reviewer group.
- Individual peer eval: reviewer can only submit for current teammates.
"""

from werkzeug.security import generate_password_hash

from api.models import (
    Assignment,
    Course,
    CriteriaDescription,
    Rubric,
    Group,
    GroupMember,
    Review,
    User,
    db,
)


def login_as(client, email: str, password: str = "password123"):
    res = client.post("/auth/login", json={"email": email, "password": password})
    assert res.status_code == 200
    return res


def _create_user(name: str, email: str, role: str):
    user = User(
        name=name,
        email=email,
        hash_pass=generate_password_hash("password123"),
        role=role,
    )
    User.create_user(user)
    return user


def _create_course(teacher_id: int):
    course = Course(teacherID=teacher_id, name="Test Course")
    Course.create_course(course)
    return course


def _create_group(course_id: int, name: str):
    group = Group(name=name, course_id=course_id)
    db.session.add(group)
    db.session.commit()
    return group


class TestPeerEvalGroup:
    def test_group_peer_eval_allows_custom_rubric_at_create_time(self, test_client, dbsession):
        teacher = _create_user("Teacher", "teacher_custom@test.com", "teacher")
        s1 = _create_user("Student 1", "cs1@test.com", "student")
        s2 = _create_user("Student 2", "cs2@test.com", "student")
        s3 = _create_user("Student 3", "cs3@test.com", "student")

        course = _create_course(teacher.id)
        g1 = _create_group(course.id, "G1")
        g2 = _create_group(course.id, "G2")

        GroupMember.add_member(g1.id, s1.id)
        GroupMember.add_member(g1.id, s2.id)
        GroupMember.add_member(g2.id, s3.id)

        login_as(test_client, "teacher_custom@test.com")
        res = test_client.post(
            "/assignment/create_assignment",
            json={
                "courseID": course.id,
                "name": "Group Peer Eval",
                "assignment_type": "peer_eval_group",
                "included_group_ids": [g1.id, g2.id],
                "rubric_criteria": [
                    {"question": "Custom Q1", "scoreMax": 7, "hasScore": True},
                    {"question": "Custom freeform", "hasScore": False},
                ],
            },
        )
        assert res.status_code == 201
        assignment_id = res.get_json()["assignment"]["id"]

        rubric = Rubric.query.filter_by(assignmentID=assignment_id).first()
        assert rubric is not None
        criteria = CriteriaDescription.query.filter_by(rubricID=rubric.id).all()
        assert [c.question for c in criteria] == ["Custom Q1", "Custom freeform"]
        assert criteria[0].scoreMax == 7
        assert criteria[0].hasScore is True
        assert criteria[1].scoreMax == 0
        assert criteria[1].hasScore is False

    def test_group_peer_eval_requires_at_least_two_included_groups(self, test_client, dbsession):
        teacher = _create_user("Teacher", "teacher_min@test.com", "teacher")
        s1 = _create_user("Student 1", "ms1@test.com", "student")

        course = _create_course(teacher.id)
        g1 = _create_group(course.id, "G1")
        GroupMember.add_member(g1.id, s1.id)

        login_as(test_client, "teacher_min@test.com")
        res = test_client.post(
            "/assignment/create_assignment",
            json={
                "courseID": course.id,
                "name": "Group Peer Eval",
                "assignment_type": "peer_eval_group",
                "included_group_ids": [g1.id],
            },
        )
        assert res.status_code == 400

    def test_group_peer_eval_submit_locks_per_group(self, test_client, dbsession):
        teacher = _create_user("Teacher", "teacher@test.com", "teacher")
        s1 = _create_user("Student 1", "s1@test.com", "student")
        s2 = _create_user("Student 2", "s2@test.com", "student")
        s3 = _create_user("Student 3", "s3@test.com", "student")
        s4 = _create_user("Student 4", "s4@test.com", "student")

        course = _create_course(teacher.id)

        g1 = _create_group(course.id, "G1")
        g2 = _create_group(course.id, "G2")
        g3 = _create_group(course.id, "G3")

        GroupMember.add_member(g1.id, s1.id)
        GroupMember.add_member(g1.id, s2.id)
        GroupMember.add_member(g2.id, s3.id)
        GroupMember.add_member(g3.id, s4.id)

        login_as(test_client, "teacher@test.com")
        res = test_client.post(
            "/assignment/create_assignment",
            json={
                "courseID": course.id,
                "name": "Group Peer Eval",
                "assignment_type": "peer_eval_group",
                "included_group_ids": [g1.id, g2.id, g3.id],
            },
        )
        assert res.status_code == 201
        assignment_id = res.get_json()["assignment"]["id"]

        # Status shows targets and criteria.
        login_as(test_client, "s1@test.com")
        status = test_client.get(f"/peer_eval/group/status/{assignment_id}")
        assert status.status_code == 200
        status_data = status.get_json()
        assert status_data["submitted"] is False
        assert {t["id"] for t in status_data["targets"]} == {g2.id, g3.id}
        assert len(status_data["criteria"]) > 0

        criteria_payload = []
        for c in status_data["criteria"]:
            item = {"criterionRowID": c["id"], "comments": "ok"}
            if c["hasScore"]:
                item["grade"] = 0
            criteria_payload.append(item)

        submit = test_client.post(
            f"/peer_eval/group/submit/{assignment_id}",
            json={
                "evaluations": [
                    {"reviewee_group_id": g2.id, "criteria": criteria_payload},
                    {"reviewee_group_id": g3.id, "criteria": criteria_payload},
                ]
            },
        )
        assert submit.status_code == 200

        # After any member submits, the whole group is locked out.
        login_as(test_client, "s2@test.com")
        submit_again = test_client.post(
            f"/peer_eval/group/submit/{assignment_id}",
            json={
                "evaluations": [
                    {"reviewee_group_id": g2.id, "criteria": criteria_payload},
                    {"reviewee_group_id": g3.id, "criteria": criteria_payload},
                ]
            },
        )
        assert submit_again.status_code == 400

        status2 = test_client.get(f"/peer_eval/group/status/{assignment_id}")
        assert status2.status_code == 200
        assert status2.get_json()["submitted"] is True

    def test_group_change_affects_eligibility_immediately(self, test_client, dbsession):
        teacher = _create_user("Teacher", "teacher2@test.com", "teacher")
        s1 = _create_user("Student 1", "gs1@test.com", "student")
        s2 = _create_user("Student 2", "gs2@test.com", "student")
        s3 = _create_user("Student 3", "gs3@test.com", "student")

        course = _create_course(teacher.id)
        g1 = _create_group(course.id, "G1")
        g2 = _create_group(course.id, "G2")
        g3 = _create_group(course.id, "G3")

        GroupMember.add_member(g1.id, s1.id)
        GroupMember.add_member(g1.id, s2.id)
        GroupMember.add_member(g2.id, s3.id)

        login_as(test_client, "teacher2@test.com")
        res = test_client.post(
            "/assignment/create_assignment",
            json={
                "courseID": course.id,
                "name": "Group Peer Eval",
                "assignment_type": "peer_eval_group",
                "included_group_ids": [g1.id, g2.id, g3.id],
            },
        )
        assert res.status_code == 201
        assignment_id = res.get_json()["assignment"]["id"]

        # Student 1 submits for group 1.
        login_as(test_client, "gs1@test.com")
        status = test_client.get(f"/peer_eval/group/status/{assignment_id}")
        criteria_payload = []
        for c in status.get_json()["criteria"]:
            item = {"criterionRowID": c["id"], "comments": "ok"}
            if c["hasScore"]:
                item["grade"] = 0
            criteria_payload.append(item)
        submit = test_client.post(
            f"/peer_eval/group/submit/{assignment_id}",
            json={
                "evaluations": [
                    {"reviewee_group_id": g2.id, "criteria": criteria_payload},
                    {"reviewee_group_id": g3.id, "criteria": criteria_payload},
                ]
            },
        )
        assert submit.status_code == 200

        # Student 2 moves from group 1 to group 2 and can now submit for group 2.
        GroupMember.remove_member(g1.id, s2.id)
        GroupMember.add_member(g2.id, s2.id)

        login_as(test_client, "gs2@test.com")
        status2 = test_client.get(f"/peer_eval/group/status/{assignment_id}")
        assert status2.status_code == 200
        assert status2.get_json()["reviewer_group"]["id"] == g2.id

        submit2 = test_client.post(
            f"/peer_eval/group/submit/{assignment_id}",
            json={
                "evaluations": [
                    {"reviewee_group_id": g1.id, "criteria": criteria_payload},
                    {"reviewee_group_id": g3.id, "criteria": criteria_payload},
                ]
            },
        )
        assert submit2.status_code == 200


class TestPeerEvalIndividualEligibility:
    def test_individual_peer_eval_blocks_after_group_change(self, test_client, dbsession):
        teacher = _create_user("Teacher", "teacher3@test.com", "teacher")
        s1 = _create_user("Student 1", "is1@test.com", "student")
        s2 = _create_user("Student 2", "is2@test.com", "student")
        s3 = _create_user("Student 3", "is3@test.com", "student")

        course = _create_course(teacher.id)
        g1 = _create_group(course.id, "G1")
        g2 = _create_group(course.id, "G2")
        GroupMember.add_member(g1.id, s1.id)
        GroupMember.add_member(g1.id, s2.id)
        GroupMember.add_member(g2.id, s3.id)

        login_as(test_client, "teacher3@test.com")
        res = test_client.post(
            "/assignment/create_assignment",
            json={
                "courseID": course.id,
                "name": "Individual Peer Eval",
                "assignment_type": "peer_eval_individual",
            },
        )
        assert res.status_code == 201
        assignment_id = res.get_json()["assignment"]["id"]

        # Sync creates teammate review tasks.
        login_as(test_client, "is1@test.com")
        sync = test_client.post(f"/peer_eval/individual/sync/{assignment_id}")
        assert sync.status_code == 200

        review = Review.query.filter_by(
            assignmentID=assignment_id, reviewerID=s1.id, revieweeID=s2.id
        ).first()
        assert review is not None

        # Move reviewee to a different group.
        GroupMember.remove_member(g1.id, s2.id)
        GroupMember.add_member(g2.id, s2.id)

        # Attempt to submit: should be blocked as no longer teammates.
        criteria = []
        assignment = Assignment.get_by_id(assignment_id)
        rubric = assignment.rubrics.first()
        assert rubric is not None
        for row in rubric.criteria_descriptions.all():
            item = {"criterionRowID": row.id, "comments": "ok"}
            if row.hasScore:
                item["grade"] = 0
            criteria.append(item)

        submit = test_client.post(f"/review/submit/{review.id}", json={"criteria": criteria})
        assert submit.status_code == 403
        assert submit.get_json()["msg"] == "You are not eligible to submit this review"
