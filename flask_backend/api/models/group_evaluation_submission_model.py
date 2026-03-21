"""GroupEvaluationSubmission model.

Represents a single group-level submission for a group peer evaluation assignment.
Only one submission per (assignment, reviewer_group).
"""

from datetime import datetime

from .db import db


class GroupEvaluationSubmission(db.Model):
    __tablename__ = "group_evaluation_submissions"

    id = db.Column(db.Integer, primary_key=True)
    assignment_id = db.Column(db.Integer, db.ForeignKey("Assignment.id"), nullable=False, index=True)
    reviewer_group_id = db.Column(db.Integer, db.ForeignKey("groups.id"), nullable=False, index=True)
    submitted_by_user_id = db.Column(db.Integer, db.ForeignKey("User.id"), nullable=False, index=True)
    submitted_at = db.Column(db.DateTime, nullable=False, default=datetime.now)

    __table_args__ = (
        db.UniqueConstraint(
            "assignment_id",
            "reviewer_group_id",
            name="_group_eval_one_submission_per_group_uc",
        ),
    )

    assignment = db.relationship("Assignment")
    reviewer_group = db.relationship("Group")
    submitted_by = db.relationship("User")

    targets = db.relationship(
        "GroupEvaluationTarget",
        back_populates="submission",
        cascade="all, delete-orphan",
        lazy="dynamic",
    )

    def __repr__(self):
        return (
            f"<GroupEvaluationSubmission id={self.id} assignment_id={self.assignment_id} "
            f"reviewer_group_id={self.reviewer_group_id}>"
        )

    @classmethod
    def get_by_assignment_and_group(cls, assignment_id: int, reviewer_group_id: int):
        return cls.query.filter_by(
            assignment_id=int(assignment_id), reviewer_group_id=int(reviewer_group_id)
        ).first()

    @classmethod
    def create(cls, submission):
        db.session.add(submission)
        db.session.commit()
        return submission
