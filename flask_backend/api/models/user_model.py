"""
User model for the peer evaluation app.
"""

from sqlalchemy import CheckConstraint

from .db import db


class User(db.Model):
    """User model with role-based authentication"""

    __tablename__ = "User"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), nullable=False)
    email = db.Column(db.String(255), nullable=False, unique=True, index=True)
    hash_pass = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(50), default="student", nullable=False)
    must_change_password = db.Column(db.Boolean, default=False, nullable=False)

    __table_args__ = (
        CheckConstraint("role IN ('student', 'teacher', 'admin')", name="check_valid_role"),
    )

    # relationships
    teaching_courses = db.relationship(
        "Course", back_populates="teacher", foreign_keys="Course.teacherID", lazy="dynamic"
    )
    user_courses = db.relationship(
        "User_Course", back_populates="user", cascade="all, delete-orphan", lazy="dynamic"
    )
    courses = db.relationship(
        "Course",
        secondary="User_Courses",
        back_populates="students",
        lazy="dynamic",
        overlaps="user_courses",
    )
    submissions = db.relationship(
        "Submission", back_populates="student", cascade="all, delete-orphan", lazy="dynamic"
    )
    reviews_made = db.relationship(
        "Review", back_populates="reviewer", foreign_keys="Review.reviewerID", lazy="dynamic"
    )
    reviews_received = db.relationship(
        "Review", back_populates="reviewee", foreign_keys="Review.revieweeID", lazy="dynamic"
    )
    group_memberships = db.relationship(
        "GroupMember", back_populates="user", cascade="all, delete-orphan", lazy="dynamic"
    )

    def __init__(self, name, email, hash_pass, role="student", must_change_password=False):
        valid_roles = ["student", "teacher", "admin"]
        if role not in valid_roles:
            raise ValueError(f"Invalid role '{role}'. Must be one of: {', '.join(valid_roles)}")
        self.name = name
        self.email = email
        self.hash_pass = hash_pass
        self.role = role
        self.must_change_password = must_change_password

    def __repr__(self):
        return f"<User id={self.id} email={self.email}>"

    @classmethod
    def get_by_id(cls, user_id):
        return db.session.get(cls, int(user_id))

    @classmethod
    def get_by_email(cls, email):
        """Get user by email"""
        return cls.query.filter_by(email=email).first()

    @classmethod
    def create_user(cls, user):
        """Add a new user to the database"""
        db.session.add(user)
        db.session.commit()
        return user

    def update(self):
        """Update user in the database"""
        db.session.commit()

    def delete(self):
        """Delete user from the database"""
        db.session.delete(self)
        db.session.commit()

    def is_teacher_user(self):
        """Check if the user is a teacher (backward compatibility)"""
        return self.role == "teacher"

    def is_teacher(self):
        """Check if the user is a teacher"""
        return self.role == "teacher"

    def is_admin(self):
        """Check if the user is an admin"""
        return self.role == "admin"

    def is_student(self):
        """Check if the user is a student"""
        return self.role == "student"

    def has_role(self, *roles):
        """Check if the user has any of the specified roles"""
        return self.role in roles
