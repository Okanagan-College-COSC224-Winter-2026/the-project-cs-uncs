import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getReceivedFeedback } from '../util/api';
import { isTeacher } from '../util/login';
import TabNavigation from '../components/TabNavigation';
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
  due_date: string | null;
}

export default function ReceivedFeedback() {
  const { id: assignmentId } = useParams<{ id: string }>();

  const [assignment, setAssignment] = useState<AssignmentInfo | null>(null);
  const [feedback, setFeedback] = useState<ReviewFeedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchFeedback = async () => {
      if (!assignmentId) return;

      try {
        setLoading(true);
        setError(null);
        const data = await getReceivedFeedback(Number(assignmentId));
        setAssignment(data.assignment);
        setFeedback(data.feedback);
      } catch (err) {
        setError((err as Error).message || 'Failed to load feedback. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchFeedback();
  }, [assignmentId]);

  const tabs = [
    { label: 'Home', path: `/assignment/${assignmentId}` },
    { label: 'Group', path: `/assignment/${assignmentId}/group` },
  ];

  if (isTeacher()) {
    tabs.push({ label: 'Peer Reviews', path: `/assignment/${assignmentId}/teacher-reviews` });
  } else {
    tabs.push({ label: 'Peer Review', path: `/assignment/${assignmentId}/reviews` });
    tabs.push({ label: 'My Feedback', path: `/assignment/${assignmentId}/feedback` });
  }

  if (loading) {
    return (
      <div className="received-feedback-container">
        <p>Loading feedback...</p>
      </div>
    );
  }

  return (
    <div className="received-feedback-container">
      <div className="AssignmentHeader">
        <h2>Assignment {assignmentId}</h2>
      </div>

      <TabNavigation tabs={tabs} />

      <div className="received-feedback-content">
        <div className="feedback-page-header">
          <h2>My Received Feedback</h2>
          {assignment?.name && (
            <p className="assignment-name">{assignment.name}</p>
          )}
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

        {feedback.map((review, index) => (
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

                    <div className="criterion-comments">
                      <span className="comments-label">Comments:</span>
                      <span className="comments-text">
                        {criterion.comments ? criterion.comments : <em>No comments provided.</em>}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
