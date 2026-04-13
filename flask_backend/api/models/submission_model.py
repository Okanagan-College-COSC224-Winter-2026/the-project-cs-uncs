"""Submission model for the peer evaluation app."""

from datetime import datetime

from .db import db


class Submission(db.Model):
    """Submission model representing student submissions"""

    __tablename__ = "Submission"

    id = db.Column(db.Integer, primary_key=True)
    path = db.Column(db.String(255), nullable=True)
    studentID = db.Column(db.Integer, db.ForeignKey("User.id"), nullable=False, index=True)
    assignmentID = db.Column(db.Integer, db.ForeignKey("Assignment.id"), nullable=False, index=True)
    submitted_at = db.Column(db.DateTime, nullable=False, default=datetime.now, index=True)
    grade = db.Column(db.Float, nullable=True)

    # relationships
    student = db.relationship("User", back_populates="submissions")
    assignment = db.relationship("Assignment", back_populates="submissions")
    attachments = db.relationship(
        "SubmissionAttachment",
        back_populates="submission",
        cascade="all, delete-orphan",
        lazy=True,
    )

    def __init__(self, path, studentID, assignmentID, submitted_at=None):
        self.path = path
        self.studentID = studentID
        self.assignmentID = assignmentID
        if submitted_at is not None:
            self.submitted_at = submitted_at

    def __repr__(self):
        return f"<Submission id={self.id} student={self.studentID} assignment={self.assignmentID}>"

    @classmethod
    def get_by_id(cls, submission_id):
        """Get submission by ID"""
        return db.session.get(cls, int(submission_id))

    @classmethod
    def create_submission(cls, submission):
        """Add a new submission to the database"""
        db.session.add(submission)
        db.session.commit()
        return submission

    def update(self):
        """Update submission in the database"""
        db.session.commit()

    def delete(self):
        """Delete submission from the database"""
        db.session.delete(self)
        db.session.commit()
