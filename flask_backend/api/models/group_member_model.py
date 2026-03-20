"""
GroupMember model for the peer evaluation app.
"""
from .db import db

class GroupMember(db.Model):
    __tablename__ = "group_members"

    id = db.Column(db.Integer, primary_key=True)
    group_id = db.Column(db.Integer, db.ForeignKey("groups.id"), nullable=False, index=True)
    user_id = db.Column(db.Integer, db.ForeignKey("User.id"), nullable=False, index=True)

    # Relationships
    group = db.relationship("Group", back_populates="members")
    user = db.relationship("User", back_populates="group_memberships")

    # Unique constraint to prevent a user from being in the same group twice
    __table_args__ = (db.UniqueConstraint('group_id', 'user_id', name='_group_user_uc'),)

    def __repr__(self):
        return f"<GroupMember id={self.id} group_id={self.group_id} user_id={self.user_id}>"

    @classmethod
    def add_member(cls, group_id, user_id):
        member = cls(group_id=group_id, user_id=user_id)
        db.session.add(member)
        db.session.commit()
        return member

    @classmethod
    def remove_member(cls, group_id, user_id):
        member = cls.query.filter_by(group_id=group_id, user_id=user_id).first()
        if member:
            db.session.delete(member)
            db.session.commit()
        return member
