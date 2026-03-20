"""GroupEvaluationCriterion model.

Stores a single rubric response (grade/comments) for a specific criterion row
within a group evaluation target.
"""

from .db import db


class GroupEvaluationCriterion(db.Model):
    __tablename__ = "group_evaluation_criteria"

    id = db.Column(db.Integer, primary_key=True)
    target_id = db.Column(
        db.Integer,
        db.ForeignKey("group_evaluation_targets.id"),
        nullable=False,
        index=True,
    )
    criterionRowID = db.Column(
        db.Integer,
        db.ForeignKey("Criteria_Description.id"),
        nullable=False,
        index=True,
    )
    grade = db.Column(db.Integer, nullable=True)
    comments = db.Column(db.Text, nullable=True)

    target = db.relationship("GroupEvaluationTarget", back_populates="criteria")
    criterion_row = db.relationship("CriteriaDescription")

    def __repr__(self):
        return f"<GroupEvaluationCriterion id={self.id} target_id={self.target_id} criterionRowID={self.criterionRowID}>"
