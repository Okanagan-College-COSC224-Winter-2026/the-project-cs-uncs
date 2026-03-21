import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  getReviewDetails,
  getReviewSubmission,
  submitReviewFeedback,
  getCriteria,
  getAssignmentDetails,
  hintAssignmentType
} from '../util/api';
import Criteria from '../components/Criteria';
import TabNavigation from '../components/TabNavigation';
import BackArrow from '../components/BackArrow';
import HeaderTitle from '../components/HeaderTitle';
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
  comments?: string;
}

interface Review {
  id: number;
  completed: boolean;
  reviewee?: {
    id: number;
    name: string;
    email: string;
  };
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
  const [assignmentType, setAssignmentType] = useState<string | null>(null);
  const [criteriaDescriptions, setCriteriaDescriptions] = useState<CriteriaDescription[]>([]);
  const [criteria, setCriteria] = useState<Criterion[]>([]);
  const [additionalComments, setAdditionalComments] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const commentCriterionId = useMemo(() => {
    return criteriaDescriptions.find((d) => !d.hasScore)?.id ?? criteriaDescriptions[0]?.id ?? null;
  }, [criteriaDescriptions]);

  useEffect(() => {
    if (!assignmentId) return;
    // This route only exists for peer-eval flows. Seed a hint so other tabs
    // (especially Details) can render the full student tab set immediately.
    hintAssignmentType(Number(assignmentId), 'peer_eval_group');
  }, [assignmentId]);

  useEffect(() => {
    const fetchData = async () => {
      if (!reviewId) return;

      try {
        setLoading(true);
        setError(null);

        const reviewData = await getReviewDetails(Number(reviewId));
        setReview(reviewData.review);

        // Determine assignment type to decide whether a file submission is relevant.
        const details = await getAssignmentDetails(reviewData.review.assignment.id);
        const type = details?.assignment_type ?? null;
        setAssignmentType(type);

        if (type !== 'peer_eval_individual') {
          const submissionData = await getReviewSubmission(Number(reviewId));
          setSubmission(submissionData?.submission ?? null);
        } else {
          setSubmission(null);
        }

        // If review already has criteria, load them
        if (reviewData.criteria && reviewData.criteria.length > 0) {
          setCriteria(reviewData.criteria);
        }

        // Fetch criteria descriptions from the assignment's rubric
        const rubricAssignmentId = reviewData.review.assignment.id;
        const criteriaData = await getCriteria(rubricAssignmentId);
        const descs = Array.isArray(criteriaData) ? criteriaData : [];
        setCriteriaDescriptions(descs);

        const localCommentCriterionId = descs.find((d) => !d.hasScore)?.id ?? descs[0]?.id ?? null;
        if (localCommentCriterionId && Array.isArray(reviewData.criteria) && reviewData.criteria.length > 0) {
          const preferred = reviewData.criteria.find((c: { criterionRowID: number; comments?: string | null }) => c.criterionRowID === localCommentCriterionId);
          const preferredText = (preferred?.comments ?? '').trim();
          if (preferredText) {
            setAdditionalComments(preferredText);
          } else {
            const all = reviewData.criteria
              .map((c: { comments?: string | null }) => (c.comments ?? '').trim())
              .filter((txt: string) => txt.length > 0);
            setAdditionalComments(all.join('\n\n'));
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

  const handleCriterionSelect = (rowIndex: number, column: number) => {
    const desc = criteriaDescriptions[rowIndex];
    if (!desc?.id) return;
    const criterionRowID = desc.id;

    setCriteria(prev => {
      const existing = prev.find(c => c.criterionRowID === criterionRowID);
      const nextGrade = existing?.grade === column ? 0 : column;

      if (existing) {
        return prev.map(c =>
          c.criterionRowID === criterionRowID ? { ...c, grade: nextGrade } : c
        );
      }
      return [...prev, { criterionRowID, grade: nextGrade }];
    });
  };

  const handleSubmit = async () => {
    if (!reviewId) return;

    // Validate that all scored criteria have a selected grade
    const missing = criteriaDescriptions
      .filter((d) => d.hasScore)
      .some((d) => {
        const found = criteria.find((c) => c.criterionRowID === d.id);
        return !found || !found.grade || found.grade <= 0;
      });

    if (missing) {
      setError('Please select a score for every criterion before submitting.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const trimmedAdditional = additionalComments.trim();
      const criteriaPayload = criteriaDescriptions.map((d) => {
        const found = criteria.find((c) => c.criterionRowID === d.id);
        const grade = d.hasScore ? (found?.grade ?? 0) : 0;
        const comments = commentCriterionId && d.id === commentCriterionId ? trimmedAdditional : '';
        return { criterionRowID: d.id, grade, comments };
      });

      await submitReviewFeedback(Number(reviewId), criteriaPayload);

      setSuccessMessage('Review submitted successfully!');

      // Navigate back to the peer reviews list after a short delay
      setTimeout(() => {
        navigate(`/assignment/${assignmentId}/reviews`, { replace: true });
      }, 1000);
    } catch (err) {
      console.error('Error submitting review:', err);
      setError((err as Error).message || 'Failed to submit review. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const getCriterionGrade = (criterionRowID: number) => {
    const criterion = criteria.find(c => c.criterionRowID === criterionRowID);
    return criterion ? criterion.grade : 0;
  };

  if (loading) {
    const loadingTabs = [
      { label: "Details", path: `/assignment/${assignmentId}/details` },
      { label: "Peer Review", path: `/assignment/${assignmentId}/reviews` },
      { label: "My Feedback", path: `/assignment/${assignmentId}/feedback` },
    ];

    return (
      <div className="review-submission-container Page">
        <BackArrow />

        <div className="AssignmentHeader">
          <h2>
            <HeaderTitle title={null} loading={true} fallback="Assignment" />
          </h2>
        </div>

        <TabNavigation tabs={loadingTabs} />

        <div className="TabPageContent">
          <div className="PageStatusText">Loading…</div>
        </div>
      </div>
    );
  }

  if (error && !review) {
    return (
      <div className="review-submission-container Page">
        <BackArrow />
        <div className="error-message">{error}</div>
      </div>
    );
  }

  const isCompleted = review?.completed || false;
  const canSubmit = review?.assignment.due_date
    ? new Date(review.assignment.due_date) > new Date()
    : true;

  return (
    <div className="review-submission-container Page">
      <BackArrow />
      <div className="AssignmentHeader">
        <h2>
          <HeaderTitle title={review?.assignment?.name} loading={false} fallback="Assignment" />
        </h2>
      </div>

      <TabNavigation
        tabs={[
          {
            label: "Details",
            path: `/assignment/${assignmentId}/details`,
          },
          ...((assignmentType === 'peer_eval_group' || assignmentType === 'peer_eval_individual')
            ? [
                {
                  label: "Peer Review",
                  path: `/assignment/${assignmentId}/reviews`,
                },
                {
                  label: "My Feedback",
                  path: `/assignment/${assignmentId}/feedback`,
                },
              ]
            : [])
        ]}
      />

      <div className="review-submission-content">
        <div className="review-header">
          <h2>{review?.reviewee?.name ? `Review: ${review.reviewee.name}` : 'Submit Peer Review'}</h2>
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

      {!submission && assignmentType !== 'peer_eval_individual' ? (
        <div className="no-submission-notice">
          No submission available yet for this review.
        </div>
      ) : null}

      <div className="criteria-section">
        <h3>Review Criteria</h3>
        {criteriaDescriptions.length === 0 ? (
          <p className="no-criteria">No criteria defined for this assignment yet.</p>
        ) : (
          <>
            <Criteria
              questions={criteriaDescriptions.map((d) => d.question)}
              scoreMaxes={criteriaDescriptions.map((d) => d.scoreMax)}
              hasScores={criteriaDescriptions.map((d) => d.hasScore)}
              canComment={false}
              onCriterionSelect={handleCriterionSelect}
              grades={criteriaDescriptions.map((d) => Number(getCriterionGrade(d.id)) || 0)}
              readOnly={isCompleted || !canSubmit}
            />

            <div className="criteria-list">
              <div className="criterion-item">
                <div className="criterion-comments">
                  <label htmlFor="additional-comments">Additional comments (optional)</label>
                  <textarea
                    id="additional-comments"
                    value={additionalComments}
                    onChange={(e) => setAdditionalComments(e.target.value)}
                    disabled={isCompleted || !canSubmit}
                    className={isCompleted ? 'read-only' : ''}
                    placeholder="Optional comments..."
                    rows={3}
                  />
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {!isCompleted && canSubmit && (
        <div className="submit-section">
          <button
            className="submit-button"
            onClick={handleSubmit}
            disabled={submitting || criteriaDescriptions.filter((d) => d.hasScore).some((d) => (Number(getCriterionGrade(d.id)) || 0) <= 0)}
          >
            {submitting ? 'Submitting...' : 'Submit Review'}
          </button>
        </div>
      )}
      </div>
    </div>
  );
}
