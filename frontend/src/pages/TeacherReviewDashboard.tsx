import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  getAllReviewsForAssignment,
  getAssignmentDetails,
  getRubricCriteria,
  getTeacherGroupPeerEvalOverview,
  getTeacherGroupPeerEvalSummary,
  listCourseGroups,
  peekAssignmentDetails,
  type CourseGroup,
  type TeacherGroupPeerEvalOverviewResponse,
  type TeacherGroupPeerEvalSummaryResponse,
} from '../util/api';
import TabNavigation from '../components/TabNavigation';
import BackArrow from '../components/BackArrow';
import HeaderTitle from '../components/HeaderTitle';
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
  const [assignmentType, setAssignmentType] = useState<string | null>(() => {
    if (!id) return null
    const cached = peekAssignmentDetails(Number(id))
    return (cached as any)?.assignment_type ?? null
  });
  const [groupOverview, setGroupOverview] = useState<TeacherGroupPeerEvalOverviewResponse | null>(null);
  const [groupSummary, setGroupSummary] = useState<TeacherGroupPeerEvalSummaryResponse | null>(null);
  const [courseGroups, setCourseGroups] = useState<CourseGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);

  const getAdditionalComments = (criteria: Array<{ comments?: unknown }> | null | undefined) => {
    const comments = (criteria ?? [])
      .map((c) => String((c as any)?.comments ?? '').trim())
      .filter((txt) => txt.length > 0)
    return Array.from(new Set(comments)).join('\n\n')
  }
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);
  const [criteriaByRowId, setCriteriaByRowId] = useState<Record<number, { question: string; hasScore: boolean; scoreMax: number }>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedReviewId, setExpandedReviewId] = useState<number | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;

      try {
        setLoading(true);
        setError(null);

        const cached = peekAssignmentDetails(Number(id))
        const cachedType = (cached as any)?.assignment_type ?? null
        if (cachedType) {
          setAssignmentType(cachedType)
        }

        const details = await getAssignmentDetails(Number(id));
        const type = details?.assignment_type ?? null;
        setAssignmentType(type);

        const result = await getAllReviewsForAssignment(Number(id));
        setData(result);

        // For individual peer eval, the teacher view is group-centric.
        if (type === 'peer_eval_individual') {
          const courseId = Number(details?.course?.id ?? details?.courseID)
          const rubricCriteria = await getRubricCriteria(Number(id))

          const map: Record<number, { question: string; hasScore: boolean; scoreMax: number }> = {}
          if (Array.isArray(rubricCriteria)) {
            for (const c of rubricCriteria) {
              const rowId = Number((c as any)?.id)
              if (!Number.isFinite(rowId)) continue
              map[rowId] = {
                question: String((c as any)?.question ?? '').trim() || `Criterion ${rowId}`,
                hasScore: Boolean((c as any)?.hasScore ?? true),
                scoreMax: Number((c as any)?.scoreMax ?? 0),
              }
            }
          }
          setCriteriaByRowId(map)

          if (Number.isFinite(courseId)) {
            const groups = await listCourseGroups(courseId)
            setCourseGroups(Array.isArray(groups) ? groups : [])
          } else {
            setCourseGroups([])
          }
        } else {
          setCourseGroups([])
          setSelectedGroupId(null)
          setSelectedStudentId(null)
          setCriteriaByRowId({})
        }

        if (type === 'peer_eval_group') {
          const overview = await getTeacherGroupPeerEvalOverview(Number(id));
          setGroupOverview(overview);
          const summary = await getTeacherGroupPeerEvalSummary(Number(id));
          setGroupSummary(summary);
        } else {
          setGroupOverview(null);
          setGroupSummary(null);
        }
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
    const cached = id ? peekAssignmentDetails(Number(id)) : null
    const cachedType = (cached as any)?.assignment_type ?? null
    const cachedIsPeerEval = cachedType === 'peer_eval_group' || cachedType === 'peer_eval_individual'
    const cachedName = (cached as any)?.name ?? null
    const cachedIsIndividual = cachedType === 'peer_eval_individual'
    const cachedSubmissionsLabel = cachedType === 'standard' ? 'Student Submissions' : 'Group Submissions'

    return (
      <div className="teacher-dashboard-container Page">
        <BackArrow />

        <div className="AssignmentHeader">
          <h2>
            <HeaderTitle title={cachedName} loading={true} fallback="Assignment" />
          </h2>
        </div>

        <TabNavigation
          tabs={[
            ...(cachedIsPeerEval
              ? [
                  {
                    label: 'Rubric',
                    path: `/assignment/${id}`,
                  },
                ]
              : []),
            {
              label: "Details",
              path: `/assignment/${id}/details`,
            },
            ...(cachedIsIndividual
              ? []
              : [
                  {
                    label: cachedSubmissionsLabel,
                    path: `/assignment/${id}/submissions`,
                  },
                ]),
            ...(cachedIsPeerEval
              ? [
                  {
                    label: 'Peer Reviews',
                    path: `/assignment/${id}/teacher-reviews`,
                  },
                ]
              : []),
          ]}
        />

        <div className="TabPageContent">
          <div className="PageStatusText">Loading…</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="teacher-dashboard-container Page">
        <BackArrow />
        <div className="error-message">{error}</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="teacher-dashboard-container Page">
        <BackArrow />
        <p>No data available</p>
      </div>
    );
  }

  const { assignment, statistics, reviews } = data;
  const isPeerEval = assignmentType === 'peer_eval_group' || assignmentType === 'peer_eval_individual'
  const isIndividualPeerEval = assignmentType === 'peer_eval_individual'

  const selectedGroup = selectedGroupId ? courseGroups.find((g) => g.id === selectedGroupId) ?? null : null
  const selectedStudent = selectedGroup && selectedStudentId
    ? selectedGroup.members.find((m) => m.id === selectedStudentId) ?? null
    : null

  const scoreForReview = (review: ReviewDetail) => {
    let total = 0
    for (const c of review.criteria ?? []) {
      const rowId = Number((c as any)?.criterionRowID)
      const meta = Number.isFinite(rowId) ? criteriaByRowId[rowId] : undefined
      const include = meta ? meta.hasScore : true
      if (!include) continue
      const grade = Number((c as any)?.grade ?? 0)
      total += Number.isFinite(grade) ? grade : 0
    }
    return total
  }

  const renderGroupPeerEval = () => {
    if (!groupSummary) {
      return (
        <div className="reviews-section">
          <h3>Group Scores</h3>
          <div className="dashboard-no-reviews">
            <p>No group score data available yet.</p>
          </div>
        </div>
      )
    }

    if (selectedGroupId) {
      const selectedGroupName =
        groupSummary.groups.find((g) => g.group.id === selectedGroupId)?.group.name ??
        groupOverview?.submissions
          ?.flatMap((s) => s.evaluations ?? [])
          .find((ev) => ev.reviewee_group?.id === selectedGroupId)?.reviewee_group?.name ??
        `Group ${selectedGroupId}`

      const relevant =
        groupOverview?.submissions
          ?.flatMap((submission) =>
            (submission.evaluations ?? [])
              .filter((ev) => ev.reviewee_group?.id === selectedGroupId)
              .map((ev) => ({ submission, evaluation: ev }))
          ) ?? []

      return (
        <div className="reviews-section">
          <div className="teacher-breadcrumbRow">
            <button
              type="button"
              className="teacher-breadcrumbLink"
              onClick={() => setSelectedGroupId(null)}
            >
              ← Back to Group Scores
            </button>
          </div>

          <h3>{selectedGroupName}</h3>
          {!groupOverview ? (
            <div className="dashboard-no-reviews">
              <p>No submitted rubrics available yet.</p>
            </div>
          ) : relevant.length === 0 ? (
            <div className="dashboard-no-reviews">
              <p>No submitted rubrics found for this group yet.</p>
            </div>
          ) : (
            <div className="dashboard-reviews-list">
              {relevant.map(({ submission, evaluation }) => {
                const total = (evaluation.criteria ?? []).reduce((sum, c) => {
                  if (!c.hasScore) return sum
                  const grade = Number(c.grade ?? 0)
                  return sum + (Number.isFinite(grade) ? grade : 0)
                }, 0)

                return (
                  <div
                    key={`${submission.id}-${evaluation.reviewee_group.id}`}
                    className="dashboard-review-item completed"
                    style={{ cursor: 'default' }}
                  >
                    <div className="review-summary" style={{ cursor: 'default' }}>
                      <div className="review-participants" style={{ width: '100%' }}>
                        <div className="participant reviewer" style={{ width: '100%' }}>
                          <span className="label">From:</span>
                          <span className="name">{submission.reviewer_group?.name ?? 'Group'}</span>
                          {submission.submitted_by?.name ? (
                            <span className="email">(submitted by {submission.submitted_by.name})</span>
                          ) : null}
                        </div>
                      </div>
                      <div className="dashboard-review-status">
                        <span className="criteria-count">Total: {total}</span>
                      </div>
                    </div>

                    <div className="review-details" style={{ display: 'block' }}>
                      <div className="dashboard-criteria-list">
                        {(evaluation.criteria ?? []).filter((c) => c.hasScore).map((c) => {
                          const grade = Number(c.grade ?? 0)
                          const max = c.scoreMax == null ? null : Number(c.scoreMax)
                          const question = String(c.question ?? '').trim() || `Criterion ${c.criterionRowID}`

                          return (
                            <div key={String(c.criterionRowID)} className="criterion-detail">
                              <div className="criterion-header">
                                <span className="criterion-label">{question}</span>
                                <span className="grade-badge">
                                  Grade: {Number.isFinite(grade) ? grade : 0}{max ? `/${max}` : ''}
                                </span>
                              </div>
                            </div>
                          )
                        })}

                        {(() => {
                          const combined = getAdditionalComments(evaluation.criteria as any)
                          if (!combined) return null
                          return (
                            <div className="dashboard-criterion-comments">
                              <strong>Additional comments:</strong>
                              <p style={{ whiteSpace: 'pre-wrap' }}>{combined}</p>
                            </div>
                          )
                        })()}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )
    }

    return (
      <div className="reviews-section">
        <h3>Group Scores</h3>

        {groupSummary.groups.length === 0 ? (
          <div className="dashboard-no-reviews">
            <p>No included groups for this assignment.</p>
          </div>
        ) : (
          <div className="dashboard-reviews-list">
            <div className="dashboard-review-item completed" style={{ cursor: 'default' }}>
              <div className="review-summary" style={{ cursor: 'default' }}>
                <div className="review-participants" style={{ width: '100%' }}>
                  <div className="participant reviewer" style={{ width: '100%' }}>
                    <span className="label">Max per review:</span>
                    <span className="name">{groupSummary.max_per_review}</span>
                  </div>
                </div>
              </div>

              <div className="review-details" style={{ display: 'block' }}>
                <div className="dashboard-criteria-list">
                  {groupSummary.groups.map((g) => (
                    <button
                      key={g.group.id}
                      type="button"
                      className="teacher-groupScoreRow"
                      onClick={() => setSelectedGroupId(g.group.id)}
                    >
                      <div className="criterion-header">
                        <span className="criterion-label">{g.group.name}</span>
                        <span className="grade-badge">
                          Total received: {g.total_received}
                          {g.max_possible ? `/${g.max_possible}` : ''}
                          {` (${g.reviews_received} review${g.reviews_received === 1 ? '' : 's'})`}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  const renderIndividualPeerEval = () => {
    if (!selectedGroup) {
      return (
        <div className="reviews-section">
          <h3>Groups</h3>
          {courseGroups.length === 0 ? (
            <div className="dashboard-no-reviews">
              <p>No groups found for this class.</p>
            </div>
          ) : (
            <div className="teacher-groups-grid">
              {courseGroups.map((g) => (
                <button
                  key={g.id}
                  className="teacher-group-card"
                  type="button"
                  onClick={() => {
                    setSelectedGroupId(g.id)
                    setSelectedStudentId(null)
                  }}
                >
                  <div className="teacher-group-cardTitle">{g.name}</div>
                  <div className="teacher-group-cardMeta">{g.members.length} member{g.members.length === 1 ? '' : 's'}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      )
    }

    if (!selectedStudent) {
      const memberIds = new Set(selectedGroup.members.map((m) => m.id))
      const totals: Record<number, number> = {}
      for (const m of selectedGroup.members) totals[m.id] = 0

      for (const r of reviews) {
        if (!r.completed) continue
        if (!memberIds.has(r.reviewer.id)) continue
        if (!memberIds.has(r.reviewee.id)) continue
        totals[r.reviewee.id] = (totals[r.reviewee.id] ?? 0) + scoreForReview(r)
      }

      return (
        <div className="reviews-section">
          <div className="teacher-breadcrumbRow">
            <button
              type="button"
              className="teacher-breadcrumbLink"
              onClick={() => {
                setSelectedGroupId(null)
                setSelectedStudentId(null)
              }}
            >
              ← Back to Groups
            </button>
          </div>

          <h3>{selectedGroup.name}</h3>
          <div className="teacher-memberTotals">
            {selectedGroup.members.map((m) => (
              <button
                key={m.id}
                type="button"
                className="teacher-memberRow"
                onClick={() => setSelectedStudentId(m.id)}
              >
                <span className="teacher-memberName">{m.name}</span>
                <span className="teacher-memberScore">{totals[m.id] ?? 0}</span>
              </button>
            ))}
          </div>
        </div>
      )
    }

    const memberIds = new Set(selectedGroup.members.map((m) => m.id))
    const received = reviews
      .filter((r) => r.completed && r.reviewee.id === selectedStudent.id && memberIds.has(r.reviewer.id))
      .map((r) => ({
        review: r,
        total: scoreForReview(r),
      }))

    return (
      <div className="reviews-section">
        <div className="teacher-breadcrumbRow">
          <button
            type="button"
            className="teacher-breadcrumbLink"
            onClick={() => setSelectedStudentId(null)}
          >
            ← Back to {selectedGroup.name}
          </button>
        </div>

        <h3>{selectedStudent.name}</h3>
        {received.length === 0 ? (
          <div className="dashboard-no-reviews">
            <p>No completed peer reviews received yet.</p>
          </div>
        ) : (
          <div className="dashboard-reviews-list">
            {received.map(({ review, total }) => (
              <div key={review.id} className="dashboard-review-item completed" style={{ cursor: 'default' }}>
                <div className="review-summary" style={{ cursor: 'default' }}>
                  <div className="review-participants" style={{ width: '100%' }}>
                    <div className="participant reviewer" style={{ width: '100%' }}>
                      <span className="label">From:</span>
                      <span className="name">{review.reviewer.name}</span>
                      <span className="email">({review.reviewer.email})</span>
                    </div>
                  </div>
                  <div className="dashboard-review-status">
                    <span className="criteria-count">Total: {total}</span>
                  </div>
                </div>

                <div className="review-details" style={{ display: 'block' }}>
                  <div className="dashboard-criteria-list">
                    {review.criteria.filter((c) => {
                      const rowId = Number((c as any)?.criterionRowID)
                      const meta = Number.isFinite(rowId) ? criteriaByRowId[rowId] : undefined
                      const hasScore = meta?.hasScore ?? true
                      return hasScore
                    }).map((c) => {
                      const rowId = Number((c as any)?.criterionRowID)
                      const meta = Number.isFinite(rowId) ? criteriaByRowId[rowId] : undefined
                      const question = meta?.question ?? `Criterion ${rowId}`
                      const max = meta?.scoreMax
                      const grade = Number((c as any)?.grade ?? 0)

                      return (
                        <div key={String((c as any)?.id ?? rowId)} className="criterion-detail">
                          <div className="criterion-header">
                            <span className="criterion-label">{question}</span>
                            <span className="grade-badge">
                              Grade: {Number.isFinite(grade) ? grade : 0}{max ? `/${max}` : ''}
                            </span>
                          </div>
                        </div>
                      )
                    })}

                    {(() => {
                      const combined = getAdditionalComments(review.criteria as any)
                      if (!combined) return null
                      return (
                        <div className="dashboard-criterion-comments">
                          <strong>Additional comments:</strong>
                          <p style={{ whiteSpace: 'pre-wrap' }}>{combined}</p>
                        </div>
                      )
                    })()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="teacher-dashboard-container Page">
      <BackArrow />
      <div className="AssignmentHeader">
        <h2>
          <HeaderTitle title={assignment?.name} loading={false} fallback="Assignment" />
        </h2>
      </div>

      <TabNavigation
        tabs={[
          ...(isPeerEval
            ? [
                {
                  label: 'Rubric',
                  path: `/assignment/${id}`,
                },
              ]
            : []),
          {
            label: "Details",
            path: `/assignment/${id}/details`,
          },
          ...(isIndividualPeerEval
            ? []
            : [
                {
                  label: assignmentType === 'standard' ? 'Student Submissions' : 'Group Submissions',
                  path: `/assignment/${id}/submissions`,
                },
              ]),
          ...(isPeerEval
            ? [
                {
                  label: "Peer Reviews",
                  path: `/assignment/${id}/teacher-reviews`,
                },
              ]
            : []),
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

  	  {assignmentType !== 'peer_eval_group' && assignmentType !== 'peer_eval_individual' ? (
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
      ) : null}

      {assignmentType === 'peer_eval_group' ? (
        renderGroupPeerEval()
      ) : null}

      {assignmentType === 'peer_eval_individual' ? (
        renderIndividualPeerEval()
      ) : null}

      {assignmentType !== 'peer_eval_group' && assignmentType !== 'peer_eval_individual' ? (
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
                          {review.criteria.filter((criterion) => (criterion as any).hasScore !== false).map((criterion) => (
                            <div key={criterion.id} className="criterion-detail">
                              <div className="criterion-header">
                                <span className="criterion-label">
                                  Criterion #{criterion.criterionRowID}
                                </span>
                                <span className="grade-badge">
                                  Grade: {criterion.grade}{criterion.scoreMax ? `/${criterion.scoreMax}` : ''}
                                </span>
                              </div>
                            </div>
                          ))}

                          {(() => {
                            const combined = getAdditionalComments(review.criteria as any)
                            if (!combined) return null
                            return (
                              <div className="dashboard-criterion-comments">
                                <strong>Additional comments:</strong>
                                <p style={{ whiteSpace: 'pre-wrap' }}>{combined}</p>
                              </div>
                            )
                          })()}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}
      </div>
    </div>
  );
}
