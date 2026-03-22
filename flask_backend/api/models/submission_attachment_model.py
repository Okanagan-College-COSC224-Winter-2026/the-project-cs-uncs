"""SubmissionAttachment model for file attachments on a submission."""

from datetime import datetime

from .db import db


class SubmissionAttachment(db.Model):
    """Represents a single uploaded file attached to a Submission."""

    __tablename__ = "SubmissionAttachment"

    id = db.Column(db.Integer, primary_key=True)
    submissionID = db.Column(db.Integer, db.ForeignKey("Submission.id"), nullable=False, index=True)
    path = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.now, index=True)

    submission = db.relationship("Submission", back_populates="attachments")

    def __repr__(self):
        return f"<SubmissionAttachment id={self.id} submission={self.submissionID}>"

    @classmethod
    def get_by_id(cls, attachment_id):
        return db.session.get(cls, int(attachment_id))
