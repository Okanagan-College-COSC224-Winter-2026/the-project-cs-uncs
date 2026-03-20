"""Peer evaluation controller.

Implements group peer evaluation (group -> other groups) where a group submits exactly once
for an assignment, and individual peer evaluation (member -> member) sync helpers.
"""

from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity

from ..models import (
    Assignment,
    AssignmentIncludedGroup,
    Course,
    CriteriaDescription,
    Group,
    GroupEvaluationCriterion,
    GroupEvaluationSubmission,
    GroupEvaluationTarget,
    GroupMember,
    Review,
    Rubric,
    User,
    db,
)
from .auth_controller import jwt_role_required

bp = Blueprint("peer_eval", __name__, url_prefix="/peer_eval")


def _get_user_and_course_group(user_id: int, course_id: int):
    group = (
        Group.query.join(GroupMember, GroupMember.group_id == Group.id)
        .filter(Group.course_id == int(course_id), GroupMember.user_id == int(user_id))
        .first()
    )
    return group


def _assignment_or_404(assignment_id: int):
    assignment = Assignment.get_by_id(assignment_id)
    if not assignment:
        return None, (jsonify({"msg": "Assignment not found"}), 404)
    return assignment, None


@bp.route("/group/status/<int:assignment_id>", methods=["GET"])
@jwt_role_required("student", "teacher", "admin")
def group_status(assignment_id: int):
    assignment, err = _assignment_or_404(assignment_id)
    if err:
        return err

    if assignment.assignment_type != "peer_eval_group":
        return jsonify({"msg": "Not a group peer evaluation assignment"}), 400

    current_email = get_jwt_identity()
    user = User.get_by_email(current_email)
    if not user:
        return jsonify({"msg": "User not found"}), 404

    course = Course.get_by_id(assignment.courseID)
    if not course:
        return jsonify({"msg": "Course not found"}), 404

    my_group = _get_user_and_course_group(user.id, course.id)
    if not my_group:
        return jsonify({"msg": "You are not in a group for this course"}), 400

    included = AssignmentIncludedGroup.query.filter_by(assignment_id=assignment.id).all()
    included_ids = [row.group_id for row in included]
    included_groups = Group.query.filter(Group.id.in_(included_ids)).all() if included_ids else []

    if my_group.id not in included_ids:
        return jsonify({"msg": "Your group is not included in this assignment"}), 403

    submission = GroupEvaluationSubmission.get_by_assignment_and_group(assignment.id, my_group.id)

    rubric = Rubric.query.filter_by(assignmentID=assignment.id).first()
    criteria = []
    if rubric:
        criteria = CriteriaDescription.query.filter_by(rubricID=rubric.id).all()

    target_groups = [g for g in included_groups if g.id != my_group.id]

    submitted_evaluations = None
    if submission is not None:
        evaluations = []
        for t in submission.targets.all():
            crit_list = []
            for crit in t.criteria.all():
                crit_list.append(
                    {
                        "criterionRowID": crit.criterionRowID,
                        "grade": crit.grade,
                        "comments": crit.comments,
                    }
                )

            evaluations.append(
                {
                    "reviewee_group": {
                        "id": t.reviewee_group.id,
                        "name": t.reviewee_group.name,
                    },
                    "criteria": crit_list,
                }
            )

        submitted_evaluations = {
            "id": submission.id,
            "submitted_at": submission.submitted_at.isoformat() if submission.submitted_at else None,
            "submitted_by_user_id": submission.submitted_by_user_id,
            "evaluations": evaluations,
        }

    return jsonify(
        {
            "assignment": {"id": assignment.id, "name": assignment.name},
            "reviewer_group": {"id": my_group.id, "name": my_group.name},
            "submitted": submission is not None,
            "targets": [{"id": g.id, "name": g.name} for g in target_groups],
            "criteria": [
                {
                    "id": c.id,
                    "question": c.question,
                    "scoreMax": c.scoreMax,
                    "hasScore": c.hasScore,
                }
                for c in criteria
            ],
            "submission": submitted_evaluations,
        }
    ), 200


@bp.route("/group/submit/<int:assignment_id>", methods=["POST"])
@jwt_role_required("student")
def submit_group_peer_eval(assignment_id: int):
    assignment, err = _assignment_or_404(assignment_id)
    if err:
        return err

    if assignment.assignment_type != "peer_eval_group":
        return jsonify({"msg": "Not a group peer evaluation assignment"}), 400

    # Respect assignment deadline.
    if assignment.due_date and not assignment.can_modify():
        return jsonify({"msg": "The review period has ended. Submissions are no longer accepted."}), 403

    if not request.is_json:
        return jsonify({"msg": "Missing JSON in request"}), 400

    data = request.get_json(silent=True) or {}
    evaluations = data.get("evaluations")
    if not isinstance(evaluations, list):
        return jsonify({"msg": "evaluations is required"}), 400

    current_email = get_jwt_identity()
    user = User.get_by_email(current_email)
    if not user:
        return jsonify({"msg": "User not found"}), 404

    course = Course.get_by_id(assignment.courseID)
    if not course:
        return jsonify({"msg": "Course not found"}), 404

    my_group = _get_user_and_course_group(user.id, course.id)
    if not my_group:
        return jsonify({"msg": "You are not in a group for this course"}), 400

    included = AssignmentIncludedGroup.query.filter_by(assignment_id=assignment.id).all()
    included_ids = {row.group_id for row in included}
    if my_group.id not in included_ids:
        return jsonify({"msg": "Your group is not included in this assignment"}), 403

    existing = GroupEvaluationSubmission.get_by_assignment_and_group(assignment.id, my_group.id)
    if existing:
        return jsonify({"msg": "Your group has already submitted"}), 400

    rubric = Rubric.query.filter_by(assignmentID=assignment.id).first()
    if not rubric:
        return jsonify({"msg": "No rubric found for this assignment"}), 400

    criteria_rows = CriteriaDescription.query.filter_by(rubricID=rubric.id).all()
    criteria_by_id = {c.id: c for c in criteria_rows}
    if not criteria_by_id:
        return jsonify({"msg": "Rubric has no criteria"}), 400

    required_target_ids = set(included_ids) - {my_group.id}
    provided_target_ids = set()

    for ev in evaluations:
        if not isinstance(ev, dict):
            return jsonify({"msg": "Invalid evaluations format"}), 400
        reviewee_group_id = ev.get("reviewee_group_id")
        if reviewee_group_id is None:
            return jsonify({"msg": "reviewee_group_id is required"}), 400
        reviewee_group_id = int(reviewee_group_id)
        if reviewee_group_id not in required_target_ids:
            return jsonify({"msg": "Invalid reviewee_group_id"}), 400
        provided_target_ids.add(reviewee_group_id)

        criteria = ev.get("criteria")
        if not isinstance(criteria, list):
            return jsonify({"msg": "criteria is required for each evaluation"}), 400

        for c in criteria:
            if not isinstance(c, dict):
                return jsonify({"msg": "Invalid criteria format"}), 400
            row_id = c.get("criterionRowID")
            if row_id is None:
                return jsonify({"msg": "criterionRowID is required"}), 400
            row_id = int(row_id)
            row = criteria_by_id.get(row_id)
            if not row:
                return jsonify({"msg": "Invalid criterionRowID"}), 400

            grade = c.get("grade")
            comments = c.get("comments")

            if row.hasScore:
                if grade is None:
                    return jsonify({"msg": "grade is required for scored criteria"}), 400
                try:
                    grade_int = int(grade)
                except (ValueError, TypeError):
                    return jsonify({"msg": "Invalid grade"}), 400
                if grade_int < 0 or (row.scoreMax is not None and grade_int > int(row.scoreMax)):
                    return jsonify({"msg": "Grade out of range"}), 400
            else:
                grade_int = None

            if comments is not None and not isinstance(comments, str):
                return jsonify({"msg": "Invalid comments"}), 400

    if provided_target_ids != required_target_ids:
        return jsonify({"msg": "You must evaluate all included groups"}), 400

    submission = GroupEvaluationSubmission(
        assignment_id=assignment.id,
        reviewer_group_id=my_group.id,
        submitted_by_user_id=user.id,
    )
    db.session.add(submission)
    db.session.flush()

    for ev in evaluations:
        reviewee_group_id = int(ev["reviewee_group_id"])
        target = GroupEvaluationTarget(submission_id=submission.id, reviewee_group_id=reviewee_group_id)
        db.session.add(target)
        db.session.flush()

        for c in ev["criteria"]:
            row_id = int(c["criterionRowID"])
            row = criteria_by_id[row_id]
            grade = c.get("grade")
            comments = c.get("comments")

            grade_int = int(grade) if row.hasScore and grade is not None else None
            comments_text = comments.strip() if isinstance(comments, str) and comments.strip() else None

            db.session.add(
                GroupEvaluationCriterion(
                    target_id=target.id,
                    criterionRowID=row_id,
                    grade=grade_int,
                    comments=comments_text,
                )
            )

    db.session.commit()

    return jsonify({"msg": "Group peer evaluation submitted"}), 200


@bp.route("/group/received/<int:assignment_id>", methods=["GET"])
@jwt_role_required("student")
def received_group_feedback(assignment_id: int):
    assignment, err = _assignment_or_404(assignment_id)
    if err:
        return err

    if assignment.assignment_type != "peer_eval_group":
        return jsonify({"msg": "Not a group peer evaluation assignment"}), 400

    current_email = get_jwt_identity()
    user = User.get_by_email(current_email)
    if not user:
        return jsonify({"msg": "User not found"}), 404

    course = Course.get_by_id(assignment.courseID)
    if not course:
        return jsonify({"msg": "Course not found"}), 404

    my_group = _get_user_and_course_group(user.id, course.id)
    if not my_group:
        return jsonify({"msg": "You are not in a group for this course"}), 400

    # Find all targets where my group was evaluated.
    targets = (
        GroupEvaluationTarget.query.join(
            GroupEvaluationSubmission,
            GroupEvaluationSubmission.id == GroupEvaluationTarget.submission_id,
        )
        .filter(
            GroupEvaluationSubmission.assignment_id == assignment.id,
            GroupEvaluationTarget.reviewee_group_id == my_group.id,
        )
        .all()
    )

    feedback = []
    for t in targets:
        criteria = []
        for crit in t.criteria.all():
            row = crit.criterion_row
            criteria.append(
                {
                    "criterionRowID": crit.criterionRowID,
                    "question": row.question if row else "Question unavailable",
                    "scoreMax": row.scoreMax if row else None,
                    "hasScore": row.hasScore if row else True,
                    "grade": crit.grade,
                    "comments": crit.comments,
                }
            )
        feedback.append({"target_id": t.id, "criteria": criteria})

    return jsonify(
        {
            "assignment": {"id": assignment.id, "name": assignment.name},
            "feedback": feedback,
            "total_reviews": len(feedback),
        }
    ), 200


@bp.route("/group/assignment/<int:assignment_id>/all", methods=["GET"])
@jwt_role_required("teacher", "admin")
def teacher_group_overview(assignment_id: int):
    assignment, err = _assignment_or_404(assignment_id)
    if err:
        return err

    if assignment.assignment_type != "peer_eval_group":
        return jsonify({"msg": "Not a group peer evaluation assignment"}), 400

    current_email = get_jwt_identity()
    user = User.get_by_email(current_email)
    if not user:
        return jsonify({"msg": "User not found"}), 404

    course = Course.get_by_id(assignment.courseID)
    if not course:
        return jsonify({"msg": "Course not found"}), 404

    if user.is_teacher() and course.teacherID != user.id:
        return jsonify({"msg": "Unauthorized"}), 403

    submissions = GroupEvaluationSubmission.query.filter_by(assignment_id=assignment.id).all()

    result = []
    for sub in submissions:
        sub_data = {
            "id": sub.id,
            "reviewer_group": {"id": sub.reviewer_group.id, "name": sub.reviewer_group.name},
            "submitted_by": {"id": sub.submitted_by.id, "name": sub.submitted_by.name},
            "submitted_at": sub.submitted_at.isoformat() if sub.submitted_at else None,
            "evaluations": [],
        }

        for t in sub.targets.all():
            criteria = []
            for crit in t.criteria.all():
                row = crit.criterion_row
                criteria.append(
                    {
                        "criterionRowID": crit.criterionRowID,
                        "question": row.question if row else "Question unavailable",
                        "scoreMax": row.scoreMax if row else None,
                        "hasScore": row.hasScore if row else True,
                        "grade": crit.grade,
                        "comments": crit.comments,
                    }
                )

            sub_data["evaluations"].append(
                {
                    "reviewee_group": {"id": t.reviewee_group.id, "name": t.reviewee_group.name},
                    "criteria": criteria,
                }
            )

        result.append(sub_data)

    return jsonify(
        {
            "assignment": {"id": assignment.id, "name": assignment.name, "course_id": course.id},
            "submissions": result,
            "total_submissions": len(result),
        }
    ), 200


@bp.route("/group/assignment/<int:assignment_id>/summary", methods=["GET"])
@jwt_role_required("teacher", "admin")
def teacher_group_summary(assignment_id: int):
    """Return easy-to-display totals of scores received per group for group peer eval."""
    assignment, err = _assignment_or_404(assignment_id)
    if err:
        return err

    if assignment.assignment_type != "peer_eval_group":
        return jsonify({"msg": "Not a group peer evaluation assignment"}), 400

    current_email = get_jwt_identity()
    user = User.get_by_email(current_email)
    if not user:
        return jsonify({"msg": "User not found"}), 404

    course = Course.get_by_id(assignment.courseID)
    if not course:
        return jsonify({"msg": "Course not found"}), 404

    if user.is_teacher() and course.teacherID != user.id:
        return jsonify({"msg": "Unauthorized"}), 403

    included = AssignmentIncludedGroup.query.filter_by(assignment_id=assignment.id).all()
    included_ids = [row.group_id for row in included]
    groups = Group.query.filter(Group.id.in_(included_ids)).all() if included_ids else []

    # Determine max score for a single evaluation (scored criteria only).
    rubric = Rubric.query.filter_by(assignmentID=assignment.id).first()
    max_per_review = 0
    if rubric:
        rows = CriteriaDescription.query.filter_by(rubricID=rubric.id).all()
        for r in rows:
            if r.hasScore:
                try:
                    max_per_review += int(r.scoreMax or 0)
                except (ValueError, TypeError):
                    max_per_review += 0

    by_group_id = {
        g.id: {
            "group": {"id": g.id, "name": g.name},
            "reviews_received": 0,
            "total_received": 0,
            "max_possible": 0,
        }
        for g in groups
    }

    # Aggregate all targets where a group was evaluated.
    targets = (
        GroupEvaluationTarget.query.join(
            GroupEvaluationSubmission,
            GroupEvaluationSubmission.id == GroupEvaluationTarget.submission_id,
        )
        .filter(GroupEvaluationSubmission.assignment_id == assignment.id)
        .all()
    )

    for t in targets:
        agg = by_group_id.get(t.reviewee_group_id)
        if not agg:
            continue

        score = 0
        for crit in t.criteria.all():
            if crit.grade is None:
                continue
            try:
                score += int(crit.grade)
            except (ValueError, TypeError):
                continue

        agg["reviews_received"] += 1
        agg["total_received"] += score
        agg["max_possible"] += max_per_review

    summary = list(by_group_id.values())
    summary.sort(key=lambda x: x["group"]["name"])

    return jsonify(
        {
            "assignment": {"id": assignment.id, "name": assignment.name, "course_id": course.id},
            "max_per_review": max_per_review,
            "groups": summary,
        }
    ), 200


@bp.route("/individual/sync/<int:assignment_id>", methods=["POST"])
@jwt_role_required("student")
def sync_individual_reviews(assignment_id: int):
    assignment, err = _assignment_or_404(assignment_id)
    if err:
        return err

    if assignment.assignment_type != "peer_eval_individual":
        return jsonify({"msg": "Not an individual peer evaluation assignment"}), 400

    current_email = get_jwt_identity()
    user = User.get_by_email(current_email)
    if not user:
        return jsonify({"msg": "User not found"}), 404

    course = Course.get_by_id(assignment.courseID)
    if not course:
        return jsonify({"msg": "Course not found"}), 404

    my_group = _get_user_and_course_group(user.id, course.id)
    if not my_group:
        return jsonify({"msg": "You are not in a group for this course"}), 400

    member_ids = [m.user_id for m in my_group.members]
    created = 0
    deduped = 0

    for reviewee_id in member_ids:
        if int(reviewee_id) == int(user.id):
            continue

        # Clean up any historical duplicates so the UI can't show the same teammate twice.
        dupes = (
            Review.query.filter_by(
                reviewerID=user.id,
                revieweeID=reviewee_id,
                assignmentID=assignment.id,
            )
            .order_by(Review.id.asc())
            .all()
        )
        if len(dupes) > 1:
            keep = next((r for r in dupes if r.completed), None) or dupes[0]
            for r in dupes:
                if r.id == keep.id:
                    continue
                db.session.delete(r)
                deduped += 1
            db.session.commit()

        existing = Review.get_by_reviewer_reviewee_assignment(user.id, reviewee_id, assignment.id)
        if existing:
            continue
        review = Review(assignmentID=assignment.id, reviewerID=user.id, revieweeID=reviewee_id)
        Review.create_review(review)
        created += 1

    return jsonify({"msg": "Synced", "created": created, "deduped": deduped}), 200
