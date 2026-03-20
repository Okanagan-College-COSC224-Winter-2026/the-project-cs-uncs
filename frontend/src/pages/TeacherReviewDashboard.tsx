import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getAllReviewsForAssignment } from '../util/api';
import TabNavigation from '../components/TabNavigation';
import BackArrow from '../components/BackArrow';
import './TeacherReviewDashboard.css';
import './Assignment.css';

interface Criterion {
  id: number;
  criterionRowID: number;
  grade: number;
  comments: string;
  scoreMax: number;
}

interface ReviewDetail {
  id: number;
  reviewer: {
    id: number;
    name: string;
    email: string;
  };
  reviewee: {
    id: number;
    name: string;
    email: string;
  };
  completed: boolean;
  criteria_count: number;
  criteria: Criterion[];
}

interface Statistics {
  total_reviews: number;
  completed_reviews: number;
  incomplete_reviews: number;
  completion_rate: number;
  total_criteria_submitted: number;
}

interface Assignment {
  id: number;
  name: string;
  course_id: number;
  course_name: string;
  due_date: string | null;
  is_open: boolean;
}

interface DashboardData {
  assignment: Assignment;
  statistics: Statistics;
  reviews: ReviewDetail[];
}

export default function TeacherReviewDashboard() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedReviewId, setExpandedReviewId] = useState<number | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;

      try {
        setLoading(true);
        setError(null);

        const result = await getAllReviewsForAssignment(Number(id));
        setData(result);
      } catch (err) {
        console.error('Error fetching review data:', err);
        setError((err as Error).message || 'Failed to load review data. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id]);

  const toggleReviewDetails = (reviewId: number) => {
    setExpandedReviewId(expandedReviewId === reviewId ? null : reviewId);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'No deadline';
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  if (loading) {
    return (
      <div className="teacher-dashboard-container">
        <BackArrow />
        <p>Loading review data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="teacher-dashboard-container">
        <BackArrow />
        <div className="error-message">{error}</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="teacher-dashboard-container">
        <BackArrow />
        <p>No data available</p>
      </div>
    );
  }

  const { assignment, statistics, reviews } = data;

  return (
    <div className="teacher-dashboard-container">
      <BackArrow />
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
            label: "Details",
            path: `/assignment/${id}/details`,
          },
          {
            label: "Group Submissions",
            path: `/assignment/${id}/group-submissions`,
          },
          {
            label: "Peer Reviews",
            path: `/assignment/${id}/teacher-reviews`,
          }
        ]}
      />

      <div className="teacher-dashboard-content">
        <div className="dashboard-header">
          <div className="header-content">
            <h2>Peer Review Dashboard</h2>
            <h3>{assignment.name}</h3>
            <p className="course-info">Course: {assignment.course_name}</p>
            {assignment.due_date && (
              <p className="dashboard-due-date">
                Due: {formatDate(assignment.due_date)}
                {!assignment.is_open && (
                  <span className="dashboard-deadline-passed"> (Closed)</span>
                )}
              </p>
            )}
          </div>
        </div>

      <div className="statistics-section">
        <h3>Overview</h3>
        <div className="stats-grid">
          <div className="stat-card">
            <span className="stat-label">Total Reviews</span>
            <span className="stat-value">{statistics.total_reviews}</span>
          </div>
          <div className="stat-card completed">
            <span className="stat-label">Completed</span>
            <span className="stat-value">{statistics.completed_reviews}</span>
          </div>
          <div className="stat-card incomplete">
            <span className="stat-label">Incomplete</span>
            <span className="stat-value">{statistics.incomplete_reviews}</span>
          </div>
          <div className="stat-card rate">
            <span className="stat-label">Completion Rate</span>
            <span className="stat-value">{statistics.completion_rate}%</span>
          </div>
        </div>
      </div>

      <div className="reviews-section">
        <h3>All Reviews ({reviews.length})</h3>
        {reviews.length === 0 ? (
          <div className="dashboard-no-reviews">
            <p>No peer reviews have been assigned for this assignment yet.</p>
          </div>
        ) : (
          <div className="dashboard-reviews-list">
            {reviews.map((review) => (
              <div
                key={review.id}
                className={`dashboard-review-item ${review.completed ? 'completed' : 'incomplete'}`}
              >
                <div
                  className="review-summary"
                  onClick={() => toggleReviewDetails(review.id)}
                >
                  <div className="review-participants">
                    <div className="participant reviewer">
                      <span className="label">Reviewer:</span>
                      <span className="name">{review.reviewer.name}</span>
                      <span className="email">({review.reviewer.email})</span>
                    </div>
                    <div className="arrow">→</div>
                    <div className="participant reviewee">
                      <span className="label">Reviewee:</span>
                      <span className="name">{review.reviewee.name}</span>
                      <span className="email">({review.reviewee.email})</span>
                    </div>
                  </div>
                  <div className="dashboard-review-status">
                    <span className={`dashboard-badge ${review.completed ? 'completed' : 'pending'}`}>
                      {review.completed ? 'Completed' : 'Pending'}
                    </span>
                    <span className="criteria-count">
                      {review.criteria_count} criteria
                    </span>
                    <span className="expand-icon">
                      {expandedReviewId === review.id ? '▲' : '▼'}
                    </span>
                  </div>
                </div>

                {expandedReviewId === review.id && (
                  <div className="review-details">
                    {review.criteria.length === 0 ? (
                      <p className="dashboard-no-criteria">No criteria submitted yet.</p>
                    ) : (
                      <div className="dashboard-criteria-list">
                        <h4>Submitted Feedback:</h4>
                        {review.criteria.map((criterion) => (
                          <div key={criterion.id} className="criterion-detail">
                            <div className="criterion-header">
                              <span className="criterion-label">
                                Criterion #{criterion.criterionRowID}
                              </span>
                              <span className="grade-badge">
                                Grade: {criterion.grade}{criterion.scoreMax ? `/${criterion.scoreMax}` : ''}
                              </span>
                            </div>
                            {criterion.comments && (
                              <div className="dashboard-criterion-comments">
                                <strong>Comments:</strong>
                                <p>{criterion.comments}</p>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
