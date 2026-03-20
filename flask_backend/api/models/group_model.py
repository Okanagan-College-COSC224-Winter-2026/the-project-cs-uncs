"""
Group model for the peer evaluation app.
"""
from .db import db

class Group(db.Model):
    __tablename__ = "groups"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), nullable=False)
    course_id = db.Column(db.Integer, db.ForeignKey("Course.id"), nullable=False, index=True)

    # Relationships
    course = db.relationship("Course", back_populates="groups")
    members = db.relationship("GroupMember", back_populates="group", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Group id={self.id} name='{self.name}' course_id={self.course_id}>"

    @classmethod
    def create(cls, name, course_id):
        group = cls(name=name, course_id=course_id)
        db.session.add(group)
        db.session.commit()
        return group

    @classmethod
    def get_by_id(cls, group_id):
        return db.session.get(cls, group_id)

    def update_name(self, name):
        self.name = name
        db.session.commit()

    def delete(self):
        db.session.delete(self)
        db.session.commit()
