"""AssignmentIncludedGroup model.

Stores which groups are included in a group peer evaluation assignment.
"""

from .db import db


class AssignmentIncludedGroup(db.Model):
    __tablename__ = "assignment_included_groups"

    id = db.Column(db.Integer, primary_key=True)
    assignment_id = db.Column(db.Integer, db.ForeignKey("Assignment.id"), nullable=False, index=True)
    group_id = db.Column(db.Integer, db.ForeignKey("groups.id"), nullable=False, index=True)

    __table_args__ = (
        db.UniqueConstraint("assignment_id", "group_id", name="_assignment_group_uc"),
    )

    assignment = db.relationship("Assignment")
    group = db.relationship("Group")

    def __repr__(self):
        return f"<AssignmentIncludedGroup assignment_id={self.assignment_id} group_id={self.group_id}>"
