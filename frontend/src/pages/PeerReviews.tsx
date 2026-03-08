import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getAssignedReviews, getReviewStatus } from '../util/api';
import TabNavigation from '../components/TabNavigation';
import './PeerReviews.css';
import './Assignment.css';

interface Review {
  id: number;
  reviewee: {
    id: number;
    name: string;
    email: string;
  };
  completed: boolean;
  submission: {
    id: number;
    path: string;
  } | null;
  criteria_count: number;
}

interface ReviewStatus {
  total_assigned: number;
  completed: number;
  remaining: number;
  is_open: boolean;
  due_date: string | null;
}

interface AssignmentInfo {
  id: number;
  name: string;
  due_date: string | null;
  can_submit: boolean;
}

export default function PeerReviews() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [status, setStatus] = useState<ReviewStatus | null>(null);
  const [assignment, setAssignment] = useState<AssignmentInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;

      try {
        setLoading(true);
        setError(null);

        // Fetch assigned reviews
        const reviewData = await getAssignedReviews(Number(id));
        setReviews(reviewData.reviews);
        setAssignment(reviewData.assignment);

        // Fetch status
        const statusData = await getReviewStatus(Number(id));
        setStatus(statusData);
      } catch (err) {
        console.error('Error fetching peer reviews:', err);
        setError('Failed to load peer reviews. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id]);

  const handleReviewClick = (reviewId: number, completed: boolean) => {
    if (!assignment?.can_submit && !completed) {
      alert('The review period has ended. You cannot submit new reviews.');
      return;
    }
    navigate(`/assignment/${id}/review/${reviewId}`);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'No deadline';
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  if (loading) {
    return (
      <div className="peer-reviews-container">
        <p>Loading peer reviews...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="peer-reviews-container">
        <div className="error-message">{error}</div>
      </div>
    );
  }

  return (
    <div className="peer-reviews-container">
      <div className="AssignmentHeader">
        <h2>Assignment {id}</h2>
      </div>

      <TabNavigation
        tabs={[
          {
            label: "Home",
            path: `/assignment/${id}`,
          },
          {
            label: "Group",
            path: `/assignment/${id}/group`,
          },
          {
            label: "Peer Review",
            path: `/assignment/${id}/reviews`,
          }
        ]}
      />

      <div className="peer-reviews-content">
        <div className="reviews-header">
          <h2>Peer Reviews for {assignment?.name}</h2>
          {assignment?.due_date && (
            <p className="due-date">
              Due: {formatDate(assignment.due_date)}
              {!assignment.can_submit && (
                <span className="deadline-passed"> (Deadline passed)</span>
              )}
            </p>
          )}
        </div>

        {status && (
          <div className="review-status">
            <h3>Your Progress</h3>
            <div className="status-details">
              <span className="status-item">
                Total Assigned: <strong>{status.total_assigned}</strong>
              </span>
              <span className="status-item">
                Completed: <strong className="completed">{status.completed}</strong>
              </span>
              <span className="status-item">
                Remaining: <strong className="remaining">{status.remaining}</strong>
              </span>
            </div>
          </div>
        )}

        {reviews.length === 0 ? (
          <div className="no-reviews">
            <p>You have no peer reviews assigned for this assignment.</p>
          </div>
        ) : (
          <div className="reviews-list">
            <h3>Assigned Reviews</h3>
            {reviews.map((review) => (
              <div
                key={review.id}
                className={`review-card ${review.completed ? 'completed' : 'pending'}`}
                onClick={() => handleReviewClick(review.id, review.completed)}
              >
                <div className="review-info">
                  <h4>Review #{review.id}</h4>
                  <p className="reviewee-info">
                    <span className="label">Reviewee ID:</span> {review.reviewee.id}
                    {/* Note: Keeping anonymous per US3 - not showing full name */}
                  </p>
                  {review.submission ? (
                    <p className="submission-status">
                      Submission available
                    </p>
                  ) : (
                    <p className="submission-status no-submission">
                      No submission yet
                    </p>
                  )}
                </div>
                <div className="review-status-badge">
                  {review.completed ? (
                    <span className="badge completed">
                      Completed
                    </span>
                  ) : (
                    <span className="badge pending">
                      Pending
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {!assignment?.can_submit && reviews.some(r => !r.completed) && (
          <div className="deadline-warning">
            <p>⚠ The review period has ended. You can view your completed reviews but cannot submit new ones.</p>
          </div>
        )}
      </div>
    </div>
  );
}

