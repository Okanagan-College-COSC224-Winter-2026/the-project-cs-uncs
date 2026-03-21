"""
Assignment model for the peer evaluation app.
"""

from .db import db
from datetime import datetime, timedelta, timezone


class Assignment(db.Model):
    """Assignment model representing assignments in the peer evaluation app."""

    __tablename__ = "Assignment"

    id = db.Column(db.Integer, primary_key=True)
    courseID = db.Column(db.Integer, db.ForeignKey("Course.id"), index=True)
    name = db.Column(db.String(255), nullable=True)
    rubric_text = db.Column("rubric", db.String(255), nullable=True)

    description = db.Column(db.Text, nullable=True)

    # Optional downloadable attachment
    attachment_original_name = db.Column(db.String(255), nullable=True)
    attachment_storage_name = db.Column(db.String(255), nullable=True)

    # NEW: due date field (acceptance criteria: edit/delete allowed before due date)
    due_date = db.Column(db.DateTime, nullable=True, index=True)

    # Assignment type determines peer-eval workflows.
    assignment_type = db.Column(db.String(50), nullable=False, default="standard", index=True)

    # relationships
    course = db.relationship("Course", back_populates="assignments", lazy="joined")
    rubrics = db.relationship(
        "Rubric", back_populates="assignment", cascade="all, delete-orphan", lazy="dynamic"
    )
    submissions = db.relationship(
        "Submission", back_populates="assignment", cascade="all, delete-orphan", lazy="dynamic"
    )
    reviews = db.relationship(
        "Review", back_populates="assignment", cascade="all, delete-orphan", lazy="dynamic"
    )

    def __init__(
        self,
        courseID,
        name,
        rubric_text,
        due_date=None,
        description=None,
        attachment_original_name=None,
        attachment_storage_name=None,
        assignment_type="standard",
    ):
        self.courseID = courseID
        self.name = name
        self.rubric_text = rubric_text
        self.due_date = due_date
        self.description = description
        self.attachment_original_name = attachment_original_name
        self.attachment_storage_name = attachment_storage_name
        self.assignment_type = assignment_type

    def __repr__(self):
        return f"<Assignment id={self.id} name={self.name}>"

    @classmethod
    def get_by_id(cls, assignment_id):
        """Get assignment by ID"""
        return db.session.get(cls, int(assignment_id))
    
    @classmethod
    def get_by_class_id(cls, class_id):
        """Get assignments by class ID"""
        return cls.query.filter_by(courseID=class_id).all()

    @classmethod
    def create(cls, assignment):
        """Add a new assignment to the database"""
        db.session.add(assignment)
        db.session.commit()
        return assignment

    def _get_current_utc_time(self):
        return datetime.now(timezone.utc)
    
    def _ensure_timezone_aware(self, dt):
        if dt is None:
            return None
        return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
    
    def can_modify(self, tz_offset_minutes: int | None = None):
        """Check if the assignment can be modified (edited/deleted) right now.

        Notes:
        - For date-only due dates we store an end-of-day timestamp (23:59:59) without tzinfo.
          Those should behave as a calendar-day cutoff in the requester's local timezone.
        - For timestamp due dates (including those normalized to UTC), we keep exact time comparison.
        """
        if self.due_date is None:
            return True

        # Date-only (stored as naive 23:59:59) => compare by calendar day.
        if (
            self.due_date.tzinfo is None
            and (self.due_date.hour, self.due_date.minute, self.due_date.second) == (23, 59, 59)
        ):
            if tz_offset_minutes is not None:
                now_utc = datetime.now(timezone.utc)
                requester_today = (now_utc - timedelta(minutes=tz_offset_minutes)).date()
            else:
                requester_today = datetime.now().date()
            return requester_today <= self.due_date.date()

        due = self._ensure_timezone_aware(self.due_date)
        now = self._get_current_utc_time()
        return now < due

    def update(self):
        """Update assignment in the database"""
        db.session.commit()

    def delete(self):
        """Delete assignment from the database"""
        db.session.delete(self)
        db.session.commit()
