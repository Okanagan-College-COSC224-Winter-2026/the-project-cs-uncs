"""GroupEvaluationTarget model.

Represents a single evaluated target group within a group evaluation submission.
"""

from .db import db


class GroupEvaluationTarget(db.Model):
    __tablename__ = "group_evaluation_targets"

    id = db.Column(db.Integer, primary_key=True)
    submission_id = db.Column(
        db.Integer,
        db.ForeignKey("group_evaluation_submissions.id"),
        nullable=False,
        index=True,
    )
    reviewee_group_id = db.Column(db.Integer, db.ForeignKey("groups.id"), nullable=False, index=True)

    __table_args__ = (
        db.UniqueConstraint("submission_id", "reviewee_group_id", name="_group_eval_target_uc"),
    )

    submission = db.relationship("GroupEvaluationSubmission", back_populates="targets")
    reviewee_group = db.relationship("Group")

    criteria = db.relationship(
        "GroupEvaluationCriterion",
        back_populates="target",
        cascade="all, delete-orphan",
        lazy="dynamic",
    )

    def __repr__(self):
        return f"<GroupEvaluationTarget id={self.id} submission_id={self.submission_id} reviewee_group_id={self.reviewee_group_id}>"
