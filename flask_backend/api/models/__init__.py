from .assignment_model import Assignment
from .assignment_included_group_model import AssignmentIncludedGroup
from .course_model import Course
from .criteria_description_model import CriteriaDescription
from .criterion_model import Criterion
from .db import db, ma
from .group_model import Group
from .group_evaluation_criterion_model import GroupEvaluationCriterion
from .group_evaluation_submission_model import GroupEvaluationSubmission
from .group_evaluation_target_model import GroupEvaluationTarget
from .group_member_model import GroupMember
from .review_model import Review
from .rubric_model import Rubric
from .submission_model import Submission
from .submission_attachment_model import SubmissionAttachment
from .user_course_model import User_Course
from .user_model import User

# Schemas import triggers SQLAlchemy mapper configuration via Marshmallow.
# Keep it after all models are imported so relationship targets are registered.
from .schemas import (
    AssignmentSchema,
    CourseListSchema,
    CourseSchema,
    CriteriaDescriptionSchema,
    CourseGroupSchema,
    CriterionSchema,
    GroupMemberSchema,
    ReviewSchema,
    RubricSchema,
    SubmissionSchema,
    UserCourseSchema,
    UserListSchema,
    UserLoginSchema,
    UserRegistrationSchema,
    UserSchema,
)

__all__ = [
    "db",
    "ma",
    "User",
    "Course",
    "Group",
    "GroupMember",
    "Assignment",
    "AssignmentIncludedGroup",
    "Rubric",
    "CriteriaDescription",
    "Criterion",
    "Review",
    "GroupEvaluationSubmission",
    "GroupEvaluationTarget",
    "GroupEvaluationCriterion",
    "User_Course",
    "Submission",
    "SubmissionAttachment",
    "UserSchema",
    "UserRegistrationSchema",
    "UserLoginSchema",
    "UserListSchema",
    "CourseSchema",
    "CourseListSchema",
    "AssignmentSchema",
    "RubricSchema",
    "CriteriaDescriptionSchema",
    "CriterionSchema",
    "ReviewSchema",
    "CourseGroupSchema",
    "GroupMemberSchema",
    "UserCourseSchema",
    "SubmissionSchema",
]
