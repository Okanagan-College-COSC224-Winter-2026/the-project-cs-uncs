"""
Tests for review controller - peer review operations for students
"""

import pytest
from datetime import datetime, timedelta, timezone
from werkzeug.security import generate_password_hash

from api.models import (
    Assignment,
    Course,
    Criterion,
    CriteriaDescription,
    Group,
    GroupMember,
    Review,
    Rubric,
    Submission,
    User,
    db,
)


@pytest.fixture
def teacher(db):
    """Create a teacher user"""
    teacher = User(
        name="Teacher User",
        email="teacher@test.com",
        hash_pass=generate_password_hash("password123"),
        role="teacher"
    )
    User.create_user(teacher)
    return teacher


@pytest.fixture
def students(db):
    """Create multiple student users"""
    student_list = []
    for i in range(5):
        student = User(
            name=f"Student {i+1}",
            email=f"student{i+1}@test.com",
            hash_pass=generate_password_hash("password123"),
            role="student"
        )
        User.create_user(student)
        student_list.append(student)
    return student_list


@pytest.fixture
def course_with_assignment(db, teacher):
    """Create a course with an assignment"""
    course = Course(teacherID=teacher.id, name="Test Course")
    Course.create_course(course)

    # Create assignment with due date in the future
    due_date = datetime.now(timezone.utc) + timedelta(days=7)
    assignment = Assignment(
        courseID=course.id,
        name="Test Assignment",
        rubric_text="Test rubric",
        due_date=due_date
    )
    Assignment.create(assignment)

    return course, assignment


@pytest.fixture
def rubric_with_criteria(db, course_with_assignment):
    """Create a rubric with criteria descriptions"""
    _, assignment = course_with_assignment

    rubric = Rubric(assignmentID=assignment.id, canComment=True)
    db.session.add(rubric)
    db.session.commit()

    criteria = []
    for i in range(3):
        criterion = CriteriaDescription(
            rubricID=rubric.id,
            question=f"Question {i+1}",
            scoreMax=10,
            hasScore=True
        )
        db.session.add(criterion)
        criteria.append(criterion)

    db.session.commit()
    return rubric, criteria


@pytest.fixture
def reviews_assigned(db, course_with_assignment, students):
    """Create reviews where student1 reviews student2 and student3"""
    _, assignment = course_with_assignment

    review1 = Review(
        assignmentID=assignment.id,
        reviewerID=students[0].id,
        revieweeID=students[1].id
    )
    review2 = Review(
        assignmentID=assignment.id,
        reviewerID=students[0].id,
        revieweeID=students[2].id
    )

    Review.create_review(review1)
    Review.create_review(review2)

    return [review1, review2]


@pytest.fixture
def submissions(db, course_with_assignment, students):
    """Create submissions for students"""
    _, assignment = course_with_assignment

    submission1 = Submission(
        path="/submissions/student1.pdf",
        studentID=students[1].id,
        assignmentID=assignment.id
    )
    submission2 = Submission(
        path="/submissions/student2.pdf",
        studentID=students[2].id,
        assignmentID=assignment.id
    )

    Submission.create_submission(submission1)
    Submission.create_submission(submission2)

    return [submission1, submission2]


class TestGetAssignedReviews:
    """Test GET /review/assigned/<assignment_id>"""

    def test_get_assigned_reviews_success(self, test_client, students, reviews_assigned, submissions):
        """Student can view their assigned reviews"""
        # Login as student1 who has 2 reviews assigned
        response = test_client.post('/auth/login', json={
            'email': 'student1@test.com',
            'password': 'password123'
        })
        assert response.status_code == 200

        assignment_id = reviews_assigned[0].assignmentID

        # Get assigned reviews
        response = test_client.get(f'/review/assigned/{assignment_id}')
        assert response.status_code == 200

        data = response.get_json()
        assert data['total_count'] == 2
        assert len(data['reviews']) == 2
        assert data['assignment']['can_submit'] is True

        # Check that each review has submission info
        for review_data in data['reviews']:
            assert 'submission' in review_data
            assert 'completed' in review_data
            assert review_data['completed'] is False

    def test_get_assigned_reviews_no_reviews(self, test_client, students, course_with_assignment):
        """Student with no assigned reviews gets empty list"""
        # Login as student4 who has no reviews
        response = test_client.post('/auth/login', json={
            'email': 'student4@test.com',
            'password': 'password123'
        })
        assert response.status_code == 200

        _, assignment = course_with_assignment

        response = test_client.get(f'/review/assigned/{assignment.id}')
        assert response.status_code == 200

        data = response.get_json()
        assert data['total_count'] == 0
        assert len(data['reviews']) == 0

    def test_get_assigned_reviews_unauthorized(self, test_client, reviews_assigned):
        """Unauthenticated user cannot access reviews"""
        assignment_id = reviews_assigned[0].assignmentID

        response = test_client.get(f'/review/assigned/{assignment_id}')
        assert response.status_code == 401

    def test_get_assigned_reviews_nonexistent_assignment(self, test_client, students):
        """Returns 404 for nonexistent assignment"""
        response = test_client.post('/auth/login', json={
            'email': 'student1@test.com',
            'password': 'password123'
        })
        assert response.status_code == 200

        response = test_client.get('/review/assigned/99999')
        assert response.status_code == 404

    def test_get_assigned_reviews_dedupes_peer_eval_individual(self, test_client, students, reviews_assigned):
        """Assigned reviews should not show the same teammate twice for peer_eval_individual."""
        assignment_id = reviews_assigned[0].assignmentID
        assignment = Assignment.get_by_id(assignment_id)
        assignment.assignment_type = 'peer_eval_individual'
        assignment.update()

        # Peer-eval individual assignments are group-based; ensure the reviewer
        # and reviewees are teammates so the assigned endpoint returns them.
        group = Group(name="G1", course_id=assignment.courseID)
        db.session.add(group)
        db.session.commit()
        GroupMember.add_member(group.id, students[0].id)
        GroupMember.add_member(group.id, students[1].id)
        GroupMember.add_member(group.id, students[2].id)

        # Create a historical duplicate review row for the same teammate.
        duplicate = Review(
            assignmentID=assignment_id,
            reviewerID=students[0].id,
            revieweeID=students[1].id,
        )
        Review.create_review(duplicate)

        response = test_client.post('/auth/login', json={
            'email': 'student1@test.com',
            'password': 'password123'
        })
        assert response.status_code == 200

        response = test_client.get(f'/review/assigned/{assignment_id}')
        assert response.status_code == 200
        data = response.get_json()

        # Only one review per teammate should be returned.
        reviewee_ids = [r['reviewee']['id'] for r in data['reviews']]
        assert len(reviewee_ids) == len(set(reviewee_ids))
        assert data['total_count'] == 2

        # And duplicates should be cleaned from the DB.
        remaining = Review.query.filter_by(
            assignmentID=assignment_id,
            reviewerID=students[0].id,
            revieweeID=students[1].id,
        ).all()
        assert len(remaining) == 1


class TestGetReviewSubmission:
    """Test GET /review/submission/<review_id>"""

    def test_get_submission_as_reviewer(self, test_client, students, reviews_assigned, submissions):
        """Reviewer can view the submission they need to review"""
        # Login as student1 (reviewer)
        response = test_client.post('/auth/login', json={
            'email': 'student1@test.com',
            'password': 'password123'
        })
        assert response.status_code == 200

        review_id = reviews_assigned[0].id

        response = test_client.get(f'/review/submission/{review_id}')
        assert response.status_code == 200

        data = response.get_json()
        assert 'submission' in data
        assert 'review' in data
        assert data['submission']['path'] == '/submissions/student1.pdf'

    def test_get_submission_unauthorized_student(self, test_client, students, reviews_assigned):
        """Student cannot view submission for review they're not assigned to"""
        # Login as student3 who is not the reviewer
        response = test_client.post('/auth/login', json={
            'email': 'student3@test.com',
            'password': 'password123'
        })
        assert response.status_code == 200

        review_id = reviews_assigned[0].id

        response = test_client.get(f'/review/submission/{review_id}')
        assert response.status_code == 403

    def test_get_submission_as_teacher(self, test_client, teacher, reviews_assigned, submissions):
        """Teacher can view any submission"""
        response = test_client.post('/auth/login', json={
            'email': 'teacher@test.com',
            'password': 'password123'
        })
        assert response.status_code == 200

        review_id = reviews_assigned[0].id

        response = test_client.get(f'/review/submission/{review_id}')
        assert response.status_code == 200

        data = response.get_json()
        assert 'submission' in data

    def test_get_submission_not_found(self, test_client, students, reviews_assigned, submissions):
        """Returns 200 with submission=null when submission doesn't exist"""
        # Create a review without a submission
        _, assignment = reviews_assigned[0].assignment, reviews_assigned[0].assignmentID
        review_no_sub = Review(
            assignmentID=assignment,
            reviewerID=students[0].id,
            revieweeID=students[3].id  # student4 has no submission
        )
        Review.create_review(review_no_sub)

        response = test_client.post('/auth/login', json={
            'email': 'student1@test.com',
            'password': 'password123'
        })
        assert response.status_code == 200

        response = test_client.get(f'/review/submission/{review_no_sub.id}')
        assert response.status_code == 200

        data = response.get_json()
        assert 'submission' in data
        assert data['submission'] is None


class TestSubmitReviewFeedback:
    """Test POST /review/submit/<review_id>"""

    def test_submit_review_success(self, test_client, students, reviews_assigned, rubric_with_criteria):
        """Student can submit review feedback"""
        rubric, criteria = rubric_with_criteria

        response = test_client.post('/auth/login', json={
            'email': 'student1@test.com',
            'password': 'password123'
        })
        assert response.status_code == 200

        review_id = reviews_assigned[0].id

        # Submit review with criteria
        response = test_client.post(f'/review/submit/{review_id}', json={
            'criteria': [
                {
                    'criterionRowID': criteria[0].id,
                    'grade': 8,
                    'comments': 'Good work!'
                },
                {
                    'criterionRowID': criteria[1].id,
                    'grade': 9,
                    'comments': 'Excellent!'
                }
            ]
        })

        assert response.status_code == 200
        data = response.get_json()
        assert data['msg'] == 'Review submitted successfully'
        assert data['review']['completed'] is True

    def test_submit_review_marks_complete(self, test_client, students, reviews_assigned, rubric_with_criteria):
        """Submitting a review marks it as completed"""
        rubric, criteria = rubric_with_criteria

        response = test_client.post('/auth/login', json={
            'email': 'student1@test.com',
            'password': 'password123'
        })
        assert response.status_code == 200

        review = reviews_assigned[0]
        assert review.completed is False

        response = test_client.post(f'/review/submit/{review.id}', json={
            'criteria': [
                {'criterionRowID': criteria[0].id, 'grade': 10, 'comments': 'Perfect!'}
            ]
        })

        assert response.status_code == 200

        # Verify review is marked complete in database
        updated_review = Review.get_by_id(review.id)
        assert updated_review.completed is True

    def test_submit_review_already_completed(self, test_client, students, reviews_assigned, rubric_with_criteria):
        """Cannot submit review that's already completed"""
        rubric, criteria = rubric_with_criteria

        # Mark review as completed
        review = reviews_assigned[0]
        review.mark_complete()

        response = test_client.post('/auth/login', json={
            'email': 'student1@test.com',
            'password': 'password123'
        })
        assert response.status_code == 200

        response = test_client.post(f'/review/submit/{review.id}', json={
            'criteria': [
                {'criterionRowID': criteria[0].id, 'grade': 10, 'comments': 'Test'}
            ]
        })

        assert response.status_code == 400
        data = response.get_json()
        assert 'already been submitted' in data['msg']

    def test_submit_review_after_deadline(self, test_client, students, course_with_assignment, rubric_with_criteria):
        """Cannot submit review after deadline"""
        rubric, criteria = rubric_with_criteria
        course, assignment = course_with_assignment

        # Set due date in the past
        assignment.due_date = datetime.now(timezone.utc) - timedelta(days=1)
        assignment.update()

        # Create review for this assignment
        review = Review(
            assignmentID=assignment.id,
            reviewerID=students[0].id,
            revieweeID=students[1].id
        )
        Review.create_review(review)

        response = test_client.post('/auth/login', json={
            'email': 'student1@test.com',
            'password': 'password123'
        })
        assert response.status_code == 200

        response = test_client.post(f'/review/submit/{review.id}', json={
            'criteria': [
                {'criterionRowID': criteria[0].id, 'grade': 10, 'comments': 'Test'}
            ]
        })


        assert response.status_code == 200
        data = response.get_json()
        assert data['msg'] == 'Review submitted successfully'
        assert data['review']['completed'] is True

    def test_submit_review_unauthorized(self, test_client, students, reviews_assigned, rubric_with_criteria):
        """Student cannot submit review they're not assigned to"""
        rubric, criteria = rubric_with_criteria

        # Login as student3 who is not the reviewer
        response = test_client.post('/auth/login', json={
            'email': 'student3@test.com',
            'password': 'password123'
        })
        assert response.status_code == 200

        review_id = reviews_assigned[0].id

        response = test_client.post(f'/review/submit/{review_id}', json={
            'criteria': [
                {'criterionRowID': criteria[0].id, 'grade': 10, 'comments': 'Test'}
            ]
        })

        assert response.status_code == 403

    def test_submit_review_no_criteria(self, test_client, students, reviews_assigned):
        """Cannot submit review without criteria"""
        response = test_client.post('/auth/login', json={
            'email': 'student1@test.com',
            'password': 'password123'
        })
        assert response.status_code == 200

        review_id = reviews_assigned[0].id

        response = test_client.post(f'/review/submit/{review_id}', json={
            'criteria': []
        })

        assert response.status_code == 400
        data = response.get_json()
        assert 'At least one criterion is required' in data['msg']


class TestCreateReview:
    """Test POST /review/create (teacher/admin only)"""

    def test_create_review_as_teacher(self, test_client, teacher, students, course_with_assignment):
        """Teacher can create review assignments"""
        _, assignment = course_with_assignment

        response = test_client.post('/auth/login', json={
            'email': 'teacher@test.com',
            'password': 'password123'
        })
        assert response.status_code == 200

        response = test_client.post('/review/create', json={
            'assignmentID': assignment.id,
            'reviewerID': students[0].id,
            'revieweeID': students[1].id
        })

        assert response.status_code == 201
        data = response.get_json()
        assert data['msg'] == 'Review created successfully'
        assert 'review' in data

    def test_create_review_as_student(self, test_client, students, course_with_assignment):
        """Student cannot create review assignments"""
        _, assignment = course_with_assignment

        response = test_client.post('/auth/login', json={
            'email': 'student1@test.com',
            'password': 'password123'
        })
        assert response.status_code == 200

        response = test_client.post('/review/create', json={
            'assignmentID': assignment.id,
            'reviewerID': students[0].id,
            'revieweeID': students[1].id
        })

        assert response.status_code == 403

    def test_create_duplicate_review(self, test_client, teacher, reviews_assigned):
        """Cannot create duplicate review"""
        review = reviews_assigned[0]

        response = test_client.post('/auth/login', json={
            'email': 'teacher@test.com',
            'password': 'password123'
        })
        assert response.status_code == 200

        response = test_client.post('/review/create', json={
            'assignmentID': review.assignmentID,
            'reviewerID': review.reviewerID,
            'revieweeID': review.revieweeID
        })

        assert response.status_code == 400
        data = response.get_json()
        assert 'already exists' in data['msg']


class TestGetReceivedFeedback:
    """Test GET /review/received/<assignment_id>"""

    @pytest.fixture
    def completed_reviews(self, db, course_with_assignment, students, rubric_with_criteria):
        """Create completed reviews where student2 received feedback from student1"""
        _, assignment = course_with_assignment
        rubric, criteria = rubric_with_criteria

        review = Review(
            assignmentID=assignment.id,
            reviewerID=students[0].id,  # student1 is reviewer
            revieweeID=students[1].id   # student2 is reviewee
        )
        Review.create_review(review)

        # Submit criteria for the review
        from api.models import Criterion
        for i, criterion_desc in enumerate(criteria[:2]):
            Criterion.create_criterion(Criterion(
                reviewID=review.id,
                criterionRowID=criterion_desc.id,
                grade=8 + i,
                comments=f"Good work on criterion {i+1}!"
            ))

        review.mark_complete()
        return review

    def test_get_received_feedback_success(self, test_client, students, completed_reviews):
        """Student can view feedback they received"""
        # Login as student2 (the reviewee)
        response = test_client.post('/auth/login', json={
            'email': 'student2@test.com',
            'password': 'password123'
        })
        assert response.status_code == 200

        assignment_id = completed_reviews.assignmentID

        response = test_client.get(f'/review/received/{assignment_id}')
        assert response.status_code == 200

        data = response.get_json()
        assert data['total_reviews'] == 1
        assert len(data['feedback']) == 1
        assert 'assignment' in data

        feedback = data['feedback'][0]
        assert len(feedback['criteria']) == 2
        assert feedback['criteria'][0]['grade'] == 8
        assert 'Good work on criterion 1!' in feedback['criteria'][0]['comments']
        assert 'question' in feedback['criteria'][0]
        assert 'scoreMax' in feedback['criteria'][0]

    def test_get_received_feedback_no_feedback(self, test_client, students, course_with_assignment):
        """Student with no completed reviews receives empty list"""
        response = test_client.post('/auth/login', json={
            'email': 'student1@test.com',
            'password': 'password123'
        })
        assert response.status_code == 200

        _, assignment = course_with_assignment

        response = test_client.get(f'/review/received/{assignment.id}')
        assert response.status_code == 200

        data = response.get_json()
        assert data['total_reviews'] == 0
        assert data['feedback'] == []

    def test_get_received_feedback_excludes_incomplete(self, test_client, students, reviews_assigned, rubric_with_criteria):
        """Incomplete reviews are not included in received feedback"""
        # student2 is a reviewee in reviews_assigned but the review is not completed
        response = test_client.post('/auth/login', json={
            'email': 'student2@test.com',
            'password': 'password123'
        })
        assert response.status_code == 200

        assignment_id = reviews_assigned[0].assignmentID

        response = test_client.get(f'/review/received/{assignment_id}')
        assert response.status_code == 200

        data = response.get_json()
        assert data['total_reviews'] == 0

    def test_get_received_feedback_unauthorized(self, test_client, course_with_assignment):
        """Unauthenticated user cannot access received feedback"""
        _, assignment = course_with_assignment

        response = test_client.get(f'/review/received/{assignment.id}')
        assert response.status_code == 401

    def test_get_received_feedback_nonexistent_assignment(self, test_client, students):
        """Returns 404 for nonexistent assignment"""
        response = test_client.post('/auth/login', json={
            'email': 'student2@test.com',
            'password': 'password123'
        })
        assert response.status_code == 200

        response = test_client.get('/review/received/99999')
        assert response.status_code == 404

    def test_get_received_feedback_does_not_expose_reviewer(self, test_client, students, completed_reviews):
        """Reviewer identity is not exposed in the feedback response"""
        response = test_client.post('/auth/login', json={
            'email': 'student2@test.com',
            'password': 'password123'
        })
        assert response.status_code == 200

        assignment_id = completed_reviews.assignmentID

        response = test_client.get(f'/review/received/{assignment_id}')
        assert response.status_code == 200

        data = response.get_json()
        feedback = data['feedback'][0]
        # Reviewer identity should not be present
        assert 'reviewer' not in feedback
        assert 'reviewer_id' not in feedback
        assert 'reviewer_name' not in feedback


