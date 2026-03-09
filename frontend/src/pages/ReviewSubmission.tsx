import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  getReviewDetails,
  getReviewSubmission,
  submitReviewFeedback,
  getCriteria
} from '../util/api';
import TabNavigation from '../components/TabNavigation';
import './ReviewSubmission.css';
import './Assignment.css';

interface CriteriaDescription {
  id: number;
  question: string;
  scoreMax: number;
  hasScore: boolean;
}

interface Criterion {
  id?: number;
  criterionRowID: number;
  grade: number;
  comments: string;
}

interface Review {
  id: number;
  completed: boolean;
  assignment: {
    id: number;
    name: string;
    due_date: string | null;
  };
}

interface Submission {
  id: number;
  path: string;
}

export default function ReviewSubmission() {
  const { assignmentId, reviewId } = useParams<{ assignmentId: string; reviewId: string }>();
  const navigate = useNavigate();

  const [review, setReview] = useState<Review | null>(null);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [criteriaDescriptions, setCriteriaDescriptions] = useState<CriteriaDescription[]>([]);
  const [criteria, setCriteria] = useState<Criterion[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!reviewId) return;

      try {
        setLoading(true);
        setError(null);

        // Fetch review details and submission
        const [reviewData, submissionData] = await Promise.all([
          getReviewDetails(Number(reviewId)),
          getReviewSubmission(Number(reviewId))
        ]);

        setReview(reviewData.review);
        setSubmission(submissionData.submission);

        // If review already has criteria, load them
        if (reviewData.criteria && reviewData.criteria.length > 0) {
          setCriteria(reviewData.criteria);
        }

        // Fetch criteria descriptions from the assignment's rubric
        // Get rubric ID from assignment (it's typically the same as assignment ID for now)
        const assignmentId = reviewData.review.assignment.id;

        try {
          const criteriaData = await getCriteria(assignmentId);
          if (criteriaData && criteriaData.length > 0) {
            setCriteriaDescriptions(criteriaData);
          } else {
            // Fallback: if no criteria from API, initialize from existing review criteria
            if (reviewData.criteria && reviewData.criteria.length > 0) {
              const descriptions = reviewData.criteria.map((c: { criterionRowID: number }) => ({
                id: c.criterionRowID,
                question: `Criterion ${c.criterionRowID}`,
                scoreMax: 10,
                hasScore: true
              }));
              setCriteriaDescriptions(descriptions);
            }
          }
        } catch {
          // If criteria fetch fails, try using the review's existing criteria
          if (reviewData.criteria && reviewData.criteria.length > 0) {
            const descriptions = reviewData.criteria.map((c: { criterionRowID: number }) => ({
              id: c.criterionRowID,
              question: `Criterion ${c.criterionRowID}`,
              scoreMax: 10,
              hasScore: true
            }));
            setCriteriaDescriptions(descriptions);
          }
        }
      } catch (err) {
        setError((err as Error).message || 'Failed to load review data. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [reviewId]);

  const handleGradeChange = (criterionRowID: number, value: string, maxScore: number) => {
    // Only allow numeric input
    if (value === '') {
      // Allow empty string for clearing
      setCriteria(prev => {
        const existing = prev.find(c => c.criterionRowID === criterionRowID);
        if (existing) {
          return prev.map(c =>
            c.criterionRowID === criterionRowID ? { ...c, grade: 0 } : c
          );
        }
        return [...prev, { criterionRowID, grade: 0, comments: '' }];
      });
      return;
    }

    const numValue = Number(value);

    // Validate: must be a number and within bounds
    if (isNaN(numValue) || numValue < 0 || numValue > maxScore) {
      return; // Don't update if invalid
    }

    setCriteria(prev => {
      const existing = prev.find(c => c.criterionRowID === criterionRowID);
      if (existing) {
        return prev.map(c =>
          c.criterionRowID === criterionRowID ? { ...c, grade: numValue } : c
        );
      }
      return [...prev, { criterionRowID, grade: numValue, comments: '' }];
    });
  };

  const handleCommentsChange = (criterionRowID: number, comments: string) => {
    setCriteria(prev => {
      const existing = prev.find(c => c.criterionRowID === criterionRowID);
      if (existing) {
        return prev.map(c =>
          c.criterionRowID === criterionRowID ? { ...c, comments } : c
        );
      } else {
        return [...prev, { criterionRowID, grade: 0, comments }];
      }
    });
  };

  const handleSubmit = async () => {
    if (!reviewId) return;

    // Validate that all criteria have grades
    if (criteria.length === 0) {
      setError('Please provide at least one grade before submitting.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      await submitReviewFeedback(Number(reviewId), criteria);

      setSuccessMessage('Review submitted successfully!');

      // Navigate back to the peer reviews list after a short delay
      setTimeout(() => {
        navigate(`/assignment/${assignmentId}/reviews`);
      }, 2000);
    } catch (err) {
      console.error('Error submitting review:', err);
      setError((err as Error).message || 'Failed to submit review. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const getCriterionValue = (criterionRowID: number, field: 'grade' | 'comments') => {
    const criterion = criteria.find(c => c.criterionRowID === criterionRowID);
    return criterion ? criterion[field] : (field === 'grade' ? 0 : '');
  };

  if (loading) {
    return (
      <div className="review-submission-container">
        <p>Loading review...</p>
      </div>
    );
  }

  if (error && !review) {
    return (
      <div className="review-submission-container">
        <div className="error-message">{error}</div>
        <button onClick={() => navigate(`/assignment/${assignmentId}/reviews`)}>
          Back to Reviews
        </button>
      </div>
    );
  }

  const isCompleted = review?.completed || false;
  const canSubmit = review?.assignment.due_date
    ? new Date(review.assignment.due_date) > new Date()
    : true;

  return (
    <div className="review-submission-container">
      <div className="AssignmentHeader">
        <h2>Assignment {assignmentId}</h2>
      </div>

      <TabNavigation
        tabs={[
          {
            label: "Home",
            path: `/assignment/${assignmentId}`,
          },
          {
            label: "Group",
            path: `/assignment/${assignmentId}/group`,
          },
          {
            label: "Peer Review",
            path: `/assignment/${assignmentId}/reviews`,
          }
        ]}
      />

      <div className="review-submission-content">
        <div className="review-header">
          <h2>Submit Peer Review</h2>
        </div>

        {successMessage && (
          <div className="success-message">{successMessage}</div>
        )}

        {error && (
          <div className="error-message">{error}</div>
        )}

      {!canSubmit && !isCompleted && (
        <div className="deadline-warning">
          The review period has ended. You cannot submit this review.
        </div>
      )}

      {isCompleted && (
        <div className="completed-notice">
          This review has been completed and submitted. You can view your feedback below, but cannot edit it.
        </div>
      )}

      {submission && (
        <div className="submission-section">
          <h3>Submission to Review</h3>
          <div className="submission-info">
            <p><strong>File:</strong> {submission.path}</p>
            <p className="note">Review the submission and provide feedback below.</p>
          </div>
        </div>
      )}

      {!submission && (
        <div className="no-submission-notice">
          No submission available yet for this review.
        </div>
      )}

      <div className="criteria-section">
        <h3>Review Criteria</h3>
        {criteriaDescriptions.length === 0 ? (
          <p className="no-criteria">No criteria defined for this assignment yet.</p>
        ) : (
          <div className="criteria-list">
            {criteriaDescriptions.map((desc) => (
              <div key={desc.id} className="criterion-item">
                <div className="criterion-question">
                  <label>{desc.question}</label>
                </div>

                {desc.hasScore && (
                  <div className="criterion-grade">
                    <label htmlFor={`grade-${desc.id}`}>
                      Grade (enter a number from 0 to {desc.scoreMax}):
                    </label>
                    <input
                      id={`grade-${desc.id}`}
                      type="text"
                      value={getCriterionValue(desc.id, 'grade') || ''}
                      onChange={(e) => handleGradeChange(desc.id, e.target.value, desc.scoreMax)}
                      disabled={isCompleted || !canSubmit}
                      className={isCompleted ? 'read-only' : ''}
                      placeholder={`0-${desc.scoreMax}`}
                    />
                  </div>
                )}

                <div className="criterion-comments">
                  <label htmlFor={`comments-${desc.id}`}>Comments:</label>
                  <textarea
                    id={`comments-${desc.id}`}
                    value={getCriterionValue(desc.id, 'comments')}
                    onChange={(e) => handleCommentsChange(desc.id, e.target.value)}
                    disabled={isCompleted || !canSubmit}
                    className={isCompleted ? 'read-only' : ''}
                    placeholder="Provide feedback..."
                    rows={3}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {!isCompleted && canSubmit && (
        <div className="submit-section">
          <button
            className="submit-button"
            onClick={handleSubmit}
            disabled={submitting || criteria.length === 0}
          >
            {submitting ? 'Submitting...' : 'Submit Review'}
          </button>
        </div>
      )}
      </div>
    </div>
  );
}
