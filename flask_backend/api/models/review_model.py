"""
Review model for the peer evaluation app.
"""

from datetime import datetime

from sqlalchemy.orm import joinedload

from .db import db


class Review(db.Model):
    """Review model representing peer evaluations"""

    __tablename__ = "Review"

    id = db.Column(db.Integer, primary_key=True)
    assignmentID = db.Column(
        db.Integer, db.ForeignKey("Assignment.id"), nullable=False, index=True
    )
    reviewerID = db.Column(db.Integer, db.ForeignKey("User.id"), nullable=False, index=True)
    revieweeID = db.Column(db.Integer, db.ForeignKey("User.id"), nullable=False, index=True)
    completed = db.Column(db.Boolean, default=False, nullable=False)
    completed_at = db.Column(db.DateTime, nullable=True, index=True)

    # relationships
    assignment = db.relationship("Assignment", back_populates="reviews", lazy="joined")
    reviewer = db.relationship(
        "User", foreign_keys=[reviewerID], back_populates="reviews_made", lazy="joined"
    )
    reviewee = db.relationship(
        "User", foreign_keys=[revieweeID], back_populates="reviews_received", lazy="joined"
    )
    criteria = db.relationship(
        "Criterion", back_populates="review", cascade="all, delete-orphan", lazy="dynamic"
    )

    def __init__(self, assignmentID, reviewerID, revieweeID, completed=False, completed_at=None):
        self.assignmentID = assignmentID
        self.reviewerID = reviewerID
        self.revieweeID = revieweeID
        self.completed = completed
        if completed_at is not None:
            self.completed_at = completed_at

    def __repr__(self):
        return f"<Review id={self.id}>"

    @classmethod
    def get_by_id(cls, review_id):
        """Get review by ID (relationships are eagerly loaded via lazy='joined')"""
        return db.session.get(cls, int(review_id))

    @classmethod
    def get_by_id_with_relations(cls, review_id):
        """Get review by ID with all relationships explicitly loaded.
        Relationships (reviewer, reviewee, assignment) are already eagerly loaded via lazy='joined'."""
        return cls.query.filter_by(id=int(review_id)).first()

    @classmethod
    def get_all_with_relations(cls):
        """Get all reviews with relationships loaded.
        Assignment relationships (reviewer, reviewee, assignment) are
        automatically loaded via lazy='joined'."""
        return cls.query.all()

    @classmethod
    def get_by_reviewer_and_assignment(cls, reviewer_id, assignment_id):
        """Get all reviews for a specific reviewer and assignment"""
        return cls.query.filter_by(reviewerID=reviewer_id, assignmentID=assignment_id).all()

    @classmethod
    def get_by_reviewer_reviewee_assignment(cls, reviewer_id, reviewee_id, assignment_id):
        """Get a specific review by reviewer, reviewee, and assignment"""
        return cls.query.filter_by(
            reviewerID=reviewer_id, revieweeID=reviewee_id, assignmentID=assignment_id
        ).first()

    @classmethod
    def get_by_assignment(cls, assignment_id):
        """Get all reviews for a specific assignment (for teacher overview)"""
        return cls.query.filter_by(assignmentID=assignment_id).all()

    @classmethod
    def create_review(cls, review):
        """Add a new review to the database"""
        db.session.add(review)
        db.session.commit()
        return review

    def mark_complete(self):
        """Mark the review as completed"""
        self.completed = True
        self.completed_at = datetime.now()
        db.session.commit()

    def update(self):
        """Update review in the database"""
        db.session.commit()

    def delete(self):
        """Delete review from the database"""
        db.session.delete(self)
        db.session.commit()
