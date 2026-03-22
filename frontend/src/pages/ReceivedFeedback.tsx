import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getAssignmentDetails, getReceivedFeedback, getReceivedGroupPeerEvalFeedback, hintAssignmentType } from '../util/api';
import { hasRole } from '../util/login';
import TabNavigation from '../components/TabNavigation';
import BackArrow from '../components/BackArrow';
import HeaderTitle from '../components/HeaderTitle';
import './ReceivedFeedback.css';

interface CriterionFeedback {
  criterionRowID: number;
  question: string;
  scoreMax: number | null;
  hasScore: boolean;
  grade: number | null;
  comments: string | null;
}

interface ReviewFeedback {
  review_id: number;
  criteria: CriterionFeedback[];
}

interface AssignmentInfo {
  id: number;
  name: string;
  due_date?: string | null;
}

export default function ReceivedFeedback() {
  const { id: assignmentId } = useParams<{ id: string }>();

  const [assignment, setAssignment] = useState<AssignmentInfo | null>(null);
  const [assignmentType, setAssignmentType] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<ReviewFeedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!assignmentId) return;
    // This route only exists for peer-eval flows. Seed a hint so other tabs
    // (especially Details) can render the full student tab set immediately.
    hintAssignmentType(Number(assignmentId), 'peer_eval_group');
  }, [assignmentId]);

  useEffect(() => {
    const fetchFeedback = async () => {
      if (!assignmentId) return;

      try {
        setLoading(true);
        setError(null);
        const details = await getAssignmentDetails(Number(assignmentId));
        const type = details?.assignment_type ?? null;
        setAssignmentType(type);

        if (type === 'peer_eval_group') {
          const data = await getReceivedGroupPeerEvalFeedback(Number(assignmentId));
          setAssignment(data.assignment);
          setFeedback(
            (data.feedback ?? []).map((f) => ({
              review_id: f.target_id,
              criteria: f.criteria,
            }))
          );
        } else {
          const data = await getReceivedFeedback(Number(assignmentId));
          setAssignment(data.assignment);
          setFeedback(data.feedback);
        }
      } catch (err) {
        setError((err as Error).message || 'Failed to load feedback. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchFeedback();
  }, [assignmentId]);

  const isTeacherOrAdmin = hasRole('teacher', 'admin');

  const tabs: { label: string; path: string }[] = [];
  const showRubricTab = isTeacherOrAdmin && (assignmentType === 'peer_eval_group' || assignmentType === 'peer_eval_individual');
  const submissionsLabel = assignmentType === 'standard' ? 'Student Submissions' : 'Group Submissions';
  const showSubmissionsTab = assignmentType !== 'peer_eval_individual';
  if (showRubricTab) {
    tabs.push({ label: 'Rubric', path: `/assignment/${assignmentId}` });
  }
  tabs.push({ label: 'Details', path: `/assignment/${assignmentId}/details` });

  if (isTeacherOrAdmin) {
    if (showSubmissionsTab) {
      tabs.push({ label: submissionsLabel, path: `/assignment/${assignmentId}/submissions` });
    }
    if (assignmentType === 'peer_eval_group' || assignmentType === 'peer_eval_individual') {
      tabs.push({ label: 'Peer Reviews', path: `/assignment/${assignmentId}/teacher-reviews` });
    }
  } else {
    if (assignmentType === 'peer_eval_group' || assignmentType === 'peer_eval_individual') {
      tabs.push({ label: 'Peer Review', path: `/assignment/${assignmentId}/reviews` });
      tabs.push({ label: 'My Feedback', path: `/assignment/${assignmentId}/feedback` });
    }
  }

  if (loading) {
    const loadingTabs = [
      { label: 'Details', path: `/assignment/${assignmentId}/details` },
      { label: 'Peer Review', path: `/assignment/${assignmentId}/reviews` },
      { label: 'My Feedback', path: `/assignment/${assignmentId}/feedback` },
    ];

    return (
      <div className="received-feedback-container Page">
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

  return (
    <div className="received-feedback-container Page">
      <BackArrow />
      <div className="AssignmentHeader">
        <h2>
          <HeaderTitle title={assignment?.name} loading={loading} fallback="Assignment" />
        </h2>
      </div>

      <TabNavigation tabs={tabs} />

      <div className="received-feedback-content TabPageContent">
        <div className="feedback-page-header">
          <h2>My Received Feedback</h2>
        </div>

        {error && (
          <div className="error-message">{error}</div>
        )}

        {!error && feedback.length === 0 && (
          <div className="no-feedback">
            <p>No feedback has been received yet for this assignment.</p>
            <p>Feedback will appear here once your peers have completed their reviews.</p>
          </div>
        )}

        {feedback.map((review, index) => {
          const additionalComments = (() => {
            const comments = (review.criteria ?? [])
              .map((c) => (c.comments ?? '').trim())
              .filter((txt) => txt.length > 0);
            return Array.from(new Set(comments)).join('\n\n');
          })();

          return (
            <div key={review.review_id} className="feedback-card">
              <div className="feedback-card-header">
                <h3>Review {index + 1}</h3>
              </div>

              {review.criteria.length === 0 ? (
                <p className="no-criteria">No criteria submitted for this review.</p>
              ) : (
                <div className="criteria-list">
                  {review.criteria.map((criterion) => (
                    <div key={criterion.criterionRowID} className="criterion-feedback">
                      <div className="criterion-question">
                        <strong>{criterion.question}</strong>
                      </div>

                      {criterion.hasScore && criterion.scoreMax !== null && (
                        <div className="criterion-score">
                          <span className="score-label">Score:</span>
                          <span className="score-value">
                            {criterion.grade !== null ? criterion.grade : '—'}
                            <span className="score-max"> / {criterion.scoreMax}</span>
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {additionalComments.trim() ? (
                <div className="review-additional-comments">
                  <label>Additional comments (optional)</label>
                  <textarea value={additionalComments} disabled={true} rows={3} />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
