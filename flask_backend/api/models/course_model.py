"""
Course model for the peer evaluation app.
"""

from sqlalchemy.orm import joinedload

from .db import db


class Course(db.Model):
    """Course model"""

    __tablename__ = "Course"

    id = db.Column(db.Integer, primary_key=True)
    teacherID = db.Column(db.Integer, db.ForeignKey("User.id"), nullable=False, index=True)
    name = db.Column(db.String(255), nullable=True)

    # relationships
    teacher = db.relationship("User", back_populates="teaching_courses", foreign_keys=[teacherID])
    assignments = db.relationship(
        "Assignment", back_populates="course", cascade="all, delete-orphan", lazy="dynamic"
    )
    groups = db.relationship("Group", back_populates="course", cascade="all, delete-orphan", lazy="dynamic")
    user_courses = db.relationship(
        "User_Course",
        back_populates="course",
        cascade="all, delete-orphan",
        lazy="dynamic",
        overlaps="students",
    )
    # Note: students uses lazy='selectin' instead of 'dynamic' to support eager loading for serialization
    students = db.relationship(
        "User",
        secondary="User_Courses",
        back_populates="courses",
        lazy="selectin",
        overlaps="user_courses",
    )

    def __init__(self, teacherID, name):
        self.teacherID = teacherID
        self.name = name

    def __repr__(self):
        return f"<Course id={self.id} name={self.name}>"

    @classmethod
    def get_by_id(cls, course_id):
        """Get course by ID"""
        return db.session.get(cls, int(course_id))

    @classmethod
    def get_by_id_with_relations(cls, course_id):
        """Get course by ID with teacher eagerly loaded.
        Students are automatically loaded via lazy='selectin'."""
        return cls.query.options(joinedload(cls.teacher)).filter_by(id=int(course_id)).first()

    @classmethod
    def get_all_with_relations(cls):
        """Get all courses with teacher eagerly loaded.
        Students are automatically loaded via lazy='selectin'."""
        return cls.query.options(joinedload(cls.teacher)).all()

    @classmethod
    def get_all_courses(cls):
        """Get all courses"""
        return cls.query.all()

    @classmethod
    def get_courses_by_teacher(cls, teacher_id):
        """Get all courses taught by a specific teacher"""
        return cls.query.filter_by(teacherID=teacher_id).all()

    @classmethod
    def get_by_name(cls, name):
        """Get course by name"""
        return cls.query.filter_by(name=name).first()

    @classmethod
    def get_by_name_teacher(cls, name, teacher_id):
        """Get course by name and teacher ID"""
        return cls.query.filter_by(name=name, teacherID=teacher_id).first()

    @classmethod
    def create_course(cls, course):
        """Add a new course to the database"""
        db.session.add(course)
        db.session.commit()
        return course

    def update(self):
        """Update course in the database"""
        db.session.commit()

    def delete(self):
        """Delete course from the database"""
        db.session.delete(self)
        db.session.commit()
