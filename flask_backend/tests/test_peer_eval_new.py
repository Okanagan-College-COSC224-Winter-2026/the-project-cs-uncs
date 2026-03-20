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

    def test_group_peer_eval_rejects_custom_rubric_scoremax_above_10(self, test_client, dbsession):
        teacher = _create_user("Teacher", "teacher_custom_max@test.com", "teacher")
        s1 = _create_user("Student 1", "maxs1@test.com", "student")
        s2 = _create_user("Student 2", "maxs2@test.com", "student")
        s3 = _create_user("Student 3", "maxs3@test.com", "student")

        course = _create_course(teacher.id)
        g1 = _create_group(course.id, "G1")
        g2 = _create_group(course.id, "G2")

        GroupMember.add_member(g1.id, s1.id)
        GroupMember.add_member(g1.id, s2.id)
        GroupMember.add_member(g2.id, s3.id)

        login_as(test_client, "teacher_custom_max@test.com")
        res = test_client.post(
            "/assignment/create_assignment",
            json={
                "courseID": course.id,
                "name": "Group Peer Eval",
                "assignment_type": "peer_eval_group",
                "included_group_ids": [g1.id, g2.id],
                "rubric_criteria": [
                    {"question": "Too high", "scoreMax": 11, "hasScore": True},
                ],
            },
        )
        assert res.status_code == 400


class TestRubricScoreMaxCap:
    def test_rubric_endpoints_reject_scoremax_above_10(self, test_client, dbsession):
        teacher = _create_user("Teacher", "rubric_cap_teacher@test.com", "teacher")
        course = _create_course(teacher.id)

        login_as(test_client, "rubric_cap_teacher@test.com")
        res = test_client.post(
            "/assignment/create_assignment",
            json={
                "courseID": course.id,
                "name": "Peer Eval",
                "assignment_type": "peer_eval_individual",
            },
        )
        assert res.status_code == 201
        assignment_id = res.get_json()["assignment"]["id"]

        rubric = Rubric.query.filter_by(assignmentID=assignment_id).first()
        assert rubric is not None

        too_high = test_client.post(
            "/create_criteria",
            json={"rubricID": rubric.id, "question": "Q1", "scoreMax": 11, "hasScore": True},
        )
        assert too_high.status_code == 400

        ok = test_client.post(
            "/create_criteria",
            json={"rubricID": rubric.id, "question": "Q1", "scoreMax": 5, "hasScore": True},
        )
        assert ok.status_code == 201
        criteria_id = ok.get_json()["id"]

        update = test_client.patch(
            f"/update_criteria/{criteria_id}",
            json={"scoreMax": 11},
        )
        assert update.status_code == 400

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
        status2_data = status2.get_json()
        assert status2_data["submitted"] is True

        # Status should include what was submitted so the student UI can show it read-only.
        assert status2_data.get("submission") is not None
        assert isinstance(status2_data["submission"].get("evaluations"), list)
        assert {e["reviewee_group"]["id"] for e in status2_data["submission"]["evaluations"]} == {g2.id, g3.id}

        # Ensure at least one criterion response is persisted.
        first_eval = status2_data["submission"]["evaluations"][0]
        assert isinstance(first_eval.get("criteria"), list)
        assert len(first_eval["criteria"]) == len(status_data["criteria"])

    def test_group_peer_eval_submit_rejected_after_deadline(self, test_client, dbsession):
        teacher = _create_user("Teacher", "deadline_teacher@test.com", "teacher")
        s1 = _create_user("Student 1", "deadline_s1@test.com", "student")
        s2 = _create_user("Student 2", "deadline_s2@test.com", "student")
        s3 = _create_user("Student 3", "deadline_s3@test.com", "student")

        course = _create_course(teacher.id)
        g1 = _create_group(course.id, "DG1")
        g2 = _create_group(course.id, "DG2")

        GroupMember.add_member(g1.id, s1.id)
        GroupMember.add_member(g1.id, s2.id)
        GroupMember.add_member(g2.id, s3.id)

        login_as(test_client, "deadline_teacher@test.com")
        res = test_client.post(
            "/assignment/create_assignment",
            json={
                "courseID": course.id,
                "name": "Group Peer Eval Deadline",
                "assignment_type": "peer_eval_group",
                "included_group_ids": [g1.id, g2.id],
            },
        )
        assert res.status_code == 201
        assignment_id = res.get_json()["assignment"]["id"]

        # Force due date into the past.
        from api.models import Assignment
        from datetime import datetime, timedelta, timezone

        assignment = Assignment.get_by_id(assignment_id)
        assignment.due_date = datetime.now(timezone.utc) - timedelta(days=1)
        assignment.update()

        login_as(test_client, "deadline_s1@test.com")
        status = test_client.get(f"/peer_eval/group/status/{assignment_id}")
        assert status.status_code == 200
        status_data = status.get_json()

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
                ]
            },
        )
        assert submit.status_code == 403

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

    def test_teacher_can_view_group_peer_eval_submissions_after_student_submit(self, test_client, dbsession):
        teacher = _create_user("Teacher", "teacher_view@test.com", "teacher")
        s1 = _create_user("Student 1", "tv_s1@test.com", "student")
        s2 = _create_user("Student 2", "tv_s2@test.com", "student")
        s3 = _create_user("Student 3", "tv_s3@test.com", "student")

        course = _create_course(teacher.id)
        g1 = _create_group(course.id, "G1")
        g2 = _create_group(course.id, "G2")

        GroupMember.add_member(g1.id, s1.id)
        GroupMember.add_member(g1.id, s2.id)
        GroupMember.add_member(g2.id, s3.id)

        login_as(test_client, "teacher_view@test.com")
        res = test_client.post(
            "/assignment/create_assignment",
            json={
                "courseID": course.id,
                "name": "Group Peer Eval",
                "assignment_type": "peer_eval_group",
                "included_group_ids": [g1.id, g2.id],
            },
        )
        assert res.status_code == 201
        assignment_id = res.get_json()["assignment"]["id"]

        # Student submits for their group.
        login_as(test_client, "tv_s1@test.com")
        status = test_client.get(f"/peer_eval/group/status/{assignment_id}")
        assert status.status_code == 200
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
                ]
            },
        )
        assert submit.status_code == 200

        # Teacher can see the submission in the overview.
        login_as(test_client, "teacher_view@test.com")
        overview = test_client.get(f"/peer_eval/group/assignment/{assignment_id}/all")
        assert overview.status_code == 200
        data = overview.get_json()
        assert data["assignment"]["id"] == assignment_id
        assert data["total_submissions"] == 1
        assert len(data["submissions"]) == 1
        assert data["submissions"][0]["reviewer_group"]["id"] == g1.id
        assert {ev["reviewee_group"]["id"] for ev in data["submissions"][0]["evaluations"]} == {g2.id}

    def test_teacher_group_peer_eval_summary_returns_totals_per_group(self, test_client, dbsession):
        teacher = _create_user("Teacher", "teacher_summary@test.com", "teacher")
        s1 = _create_user("Student 1", "ts_s1@test.com", "student")
        s2 = _create_user("Student 2", "ts_s2@test.com", "student")
        s3 = _create_user("Student 3", "ts_s3@test.com", "student")
        s4 = _create_user("Student 4", "ts_s4@test.com", "student")

        course = _create_course(teacher.id)
        g1 = _create_group(course.id, "G1")
        g2 = _create_group(course.id, "G2")
        g3 = _create_group(course.id, "G3")

        GroupMember.add_member(g1.id, s1.id)
        GroupMember.add_member(g1.id, s2.id)
        GroupMember.add_member(g2.id, s3.id)
        GroupMember.add_member(g3.id, s4.id)

        login_as(test_client, "teacher_summary@test.com")
        res = test_client.post(
            "/assignment/create_assignment",
            json={
                "courseID": course.id,
                "name": "Group Peer Eval",
                "assignment_type": "peer_eval_group",
                "included_group_ids": [g1.id, g2.id, g3.id],
                "rubric_criteria": [
                    {"question": "Q1", "scoreMax": 5, "hasScore": True},
                    {"question": "Q2", "scoreMax": 5, "hasScore": True},
                ],
            },
        )
        assert res.status_code == 201
        assignment_id = res.get_json()["assignment"]["id"]

        # Student submits grades: for g2 -> 3+4, for g3 -> 1+5
        login_as(test_client, "ts_s1@test.com")
        status = test_client.get(f"/peer_eval/group/status/{assignment_id}")
        assert status.status_code == 200
        crit_rows = status.get_json()["criteria"]
        assert len(crit_rows) == 2

        row1 = crit_rows[0]["id"]
        row2 = crit_rows[1]["id"]

        submit = test_client.post(
            f"/peer_eval/group/submit/{assignment_id}",
            json={
                "evaluations": [
                    {
                        "reviewee_group_id": g2.id,
                        "criteria": [
                            {"criterionRowID": row1, "grade": 3, "comments": "ok"},
                            {"criterionRowID": row2, "grade": 4, "comments": "ok"},
                        ],
                    },
                    {
                        "reviewee_group_id": g3.id,
                        "criteria": [
                            {"criterionRowID": row1, "grade": 1, "comments": "ok"},
                            {"criterionRowID": row2, "grade": 5, "comments": "ok"},
                        ],
                    },
                ]
            },
        )
        assert submit.status_code == 200

        login_as(test_client, "teacher_summary@test.com")
        summary = test_client.get(f"/peer_eval/group/assignment/{assignment_id}/summary")
        assert summary.status_code == 200
        data = summary.get_json()
        assert data["max_per_review"] == 10

        by_id = {g["group"]["id"]: g for g in data["groups"]}
        assert by_id[g1.id]["reviews_received"] == 0
        assert by_id[g1.id]["total_received"] == 0
        assert by_id[g1.id]["max_possible"] == 0

        assert by_id[g2.id]["reviews_received"] == 1
        assert by_id[g2.id]["total_received"] == 7
        assert by_id[g2.id]["max_possible"] == 10

        assert by_id[g3.id]["reviews_received"] == 1
        assert by_id[g3.id]["total_received"] == 6
        assert by_id[g3.id]["max_possible"] == 10


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

    def test_individual_assigned_reviews_only_show_current_teammates_after_group_change(self, test_client, dbsession):
        teacher = _create_user("Teacher", "teacher4@test.com", "teacher")
        s1 = _create_user("Student 1", "as1@test.com", "student")
        s2 = _create_user("Student 2", "as2@test.com", "student")
        s3 = _create_user("Student 3", "as3@test.com", "student")

        course = _create_course(teacher.id)
        g1 = _create_group(course.id, "G1")
        g2 = _create_group(course.id, "G2")
        GroupMember.add_member(g1.id, s1.id)
        GroupMember.add_member(g1.id, s2.id)
        GroupMember.add_member(g2.id, s3.id)

        login_as(test_client, "teacher4@test.com")
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

        # Student 1 syncs and sees Student 2 assigned.
        login_as(test_client, "as1@test.com")
        sync = test_client.post(f"/peer_eval/individual/sync/{assignment_id}")
        assert sync.status_code == 200

        assigned = test_client.get(f"/review/assigned/{assignment_id}")
        assert assigned.status_code == 200
        assigned_data = assigned.get_json()
        assert {r["reviewee"]["id"] for r in assigned_data["reviews"]} == {s2.id}

        # Student 1 submits the review for Student 2.
        review = Review.query.filter_by(
            assignmentID=assignment_id, reviewerID=s1.id, revieweeID=s2.id
        ).first()
        assert review is not None

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
        assert submit.status_code == 200

        # Move reviewer (Student 1) to a new group with Student 3.
        GroupMember.remove_member(g1.id, s1.id)
        GroupMember.add_member(g2.id, s1.id)

        # Sync should create a new review for the new teammate.
        login_as(test_client, "as1@test.com")
        sync2 = test_client.post(f"/peer_eval/individual/sync/{assignment_id}")
        assert sync2.status_code == 200

        assigned2 = test_client.get(f"/review/assigned/{assignment_id}")
        assert assigned2.status_code == 200
        assigned2_data = assigned2.get_json()
        assert {r["reviewee"]["id"] for r in assigned2_data["reviews"]} == {s3.id}

        status = test_client.get(f"/review/status/{assignment_id}")
        assert status.status_code == 200
        status_data = status.get_json()
        assert status_data["total_assigned"] == 1

        # Teacher can still see the historical submitted review for Student 2.
        login_as(test_client, "teacher4@test.com")
        all_reviews = test_client.get(f"/review/assignment/{assignment_id}/all")
        assert all_reviews.status_code == 200
        teacher_data = all_reviews.get_json()
        matches = [
            r
            for r in teacher_data.get("reviews", [])
            if r["reviewer"]["id"] == s1.id and r["reviewee"]["id"] == s2.id and r["completed"] is True
        ]
        assert len(matches) == 1

        # Reviewee can still see the received feedback.
        login_as(test_client, "as2@test.com")
        received = test_client.get(f"/review/received/{assignment_id}")
        assert received.status_code == 200
        assert received.get_json()["total_reviews"] == 1
