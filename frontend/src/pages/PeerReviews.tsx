import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  getAssignedReviews,
  getAssignmentDetails,
  getGroupPeerEvalStatus,
  hintAssignmentType,
  submitGroupPeerEval,
  syncIndividualPeerEvalReviews,
  type PeerEvalGroupStatusResponse,
  type PeerEvalGroupEvaluation,
} from '../util/api';
import TabNavigation from '../components/TabNavigation';
import BackArrow from '../components/BackArrow';
import Button from '../components/Button';
import Criteria from '../components/Criteria';
import HeaderTitle from '../components/HeaderTitle';
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
const [assignment, setAssignment] = useState<AssignmentInfo | null>(null);
  const [assignmentType, setAssignmentType] = useState<string | null>(null);
  const [groupStatus, setGroupStatus] = useState<PeerEvalGroupStatusResponse | null>(null);
  const [groupDraft, setGroupDraft] = useState<Record<number, Record<number, number>>>({});
  const [groupAdditionalComments, setGroupAdditionalComments] = useState<Record<number, string>>({});
  const [submittingGroup, setSubmittingGroup] = useState(false);
  const [showSubmittedGroupSubmission, setShowSubmittedGroupSubmission] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const deadlinePassed = useMemo(() => {
    if (!assignment?.due_date) return false;
    const dueMs = new Date(assignment.due_date).getTime();
    if (Number.isNaN(dueMs)) return false;
    return Date.now() > dueMs;
  }, [assignment?.due_date]);

  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;

      try {
        setLoading(true);
        setError(null);

        // Fetch assignment type for tab rendering and branching
        const details = await getAssignmentDetails(Number(id));
        const type = details?.assignment_type ?? null;
        setAssignmentType(type);

        if (type === 'peer_eval_group') {
          const gs = await getGroupPeerEvalStatus(Number(id));
          setGroupStatus(gs);
          setShowSubmittedGroupSubmission(false);
          setAssignment({ id: gs.assignment.id, name: gs.assignment.name, due_date: details?.due_date ?? null, can_submit: !gs.submitted });
          setReviews([]);
} else {
          // Individual peer eval (or legacy): ensure reviews exist for current group
          if (type === 'peer_eval_individual') {
            await syncIndividualPeerEvalReviews(Number(id));
          }

          const reviewData = await getAssignedReviews(Number(id));
          setReviews(reviewData.reviews);
          setAssignment(reviewData.assignment);
setGroupStatus(null);
        }
      } catch (err) {
        console.error('Error fetching peer reviews:', err);
        setError('Failed to load peer reviews. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id]);

  useEffect(() => {
    if (!id) return;
    // This route only exists for peer-eval flows. Seed a hint so other tabs
    // (especially Details) can render the full student tab set immediately.
    hintAssignmentType(Number(id), 'peer_eval_group');
  }, [id]);

  const handleReviewClick = (reviewId: number, completed: boolean) => {
    if (!assignment?.can_submit && !completed) {
      alert('The review period has ended. You cannot submit new reviews.');
      return;
    }
    navigate(`/assignment/${id}/review/${reviewId}`);
  };

  const groupCriteriaMeta = useMemo(() => {
    const criteria = groupStatus?.criteria ?? [];
    return {
      questions: criteria.map((c) => c.question),
      scoreMaxes: criteria.map((c) => c.scoreMax),
      hasScores: criteria.map((c) => c.hasScore),
      ids: criteria.map((c) => c.id),
    };
  }, [groupStatus]);

  const groupCommentCriterionId = useMemo(() => {
    const criteria = groupStatus?.criteria ?? [];
    return criteria.find((c) => !c.hasScore)?.id ?? criteria[0]?.id ?? null;
  }, [groupStatus]);

  const setGroupGrade = (targetGroupId: number, rowIndex: number, column: number) => {
    const criterionRowID = groupCriteriaMeta.ids[rowIndex];
    if (!criterionRowID) return;

    setGroupDraft((prev) => {
      const byTarget = prev[targetGroupId] ? { ...prev[targetGroupId] } : {};
      const existing = byTarget[criterionRowID] ?? 0;
      const nextGrade = existing === column ? 0 : column;
      byTarget[criterionRowID] = nextGrade;
      return { ...prev, [targetGroupId]: byTarget };
    });
  };

  const canSubmitGroup = useMemo(() => {
    if (!groupStatus) return false;
    if (groupStatus.submitted) return false;

    for (const target of groupStatus.targets) {
      const byTarget = groupDraft[target.id] || {};
      for (const crit of groupStatus.criteria) {
        if (!crit.hasScore) continue;
        const grade = byTarget[crit.id] ?? 0;
        if (grade <= 0) return false;
      }
    }
    return true;
  }, [groupDraft, groupStatus]);

  const handleSubmitGroup = async () => {
    if (!id || !groupStatus) return;
    if (deadlinePassed) {
      alert('The review period has ended. You cannot submit new evaluations.');
      return;
    }
    try {
      setSubmittingGroup(true);
      setError(null);

      const evaluations: PeerEvalGroupEvaluation[] = groupStatus.targets.map((t) => {
        const byTarget = groupDraft[t.id] || {};
        const additional = (groupAdditionalComments[t.id] ?? '').trim();
        return {
          reviewee_group_id: t.id,
          criteria: groupStatus.criteria.map((c) => ({
            criterionRowID: c.id,
            grade: c.hasScore ? (byTarget[c.id] ?? null) : null,
            comments: groupCommentCriterionId && c.id === groupCommentCriterionId ? (additional || null) : null,
          })),
        };
      });

      await submitGroupPeerEval(Number(id), evaluations);

      const refreshed = await getGroupPeerEvalStatus(Number(id));
      setGroupStatus(refreshed);
      setShowSubmittedGroupSubmission(false);
      setAssignment((prev) => (prev ? { ...prev, can_submit: !refreshed.submitted } : prev));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to submit group peer evaluation.');
    } finally {
      setSubmittingGroup(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'No deadline';
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  if (loading) {
    const loadingTabs = [
      { label: "Details", path: `/assignment/${id}/details` },
      { label: "Peer Review", path: `/assignment/${id}/reviews` },
      { label: "My Feedback", path: `/assignment/${id}/feedback` },
    ];

    return (
      <div className="peer-reviews-container Page">
        <BackArrow />
        <div className="AssignmentHeader">
          <h2>
            <HeaderTitle title={assignment?.name} loading={true} fallback="Assignment" />
          </h2>
        </div>

        <TabNavigation tabs={loadingTabs} />

        <div className="peer-reviews-content TabPageContent">
          <div className="PageStatusText">Loading…</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="peer-reviews-container Page">
        <BackArrow />
        <div className="error-message">{error}</div>
      </div>
    );
  }

  return (
    <div className="peer-reviews-container Page">
      <BackArrow />
      <div className="AssignmentHeader">
        <h2>
          <HeaderTitle title={assignment?.name} loading={loading} fallback="Assignment" />
        </h2>
      </div>

      <TabNavigation
        tabs={[
          {
            label: "Details",
            path: `/assignment/${id}/details`,
          },
          ...((assignmentType === 'peer_eval_group' || assignmentType === 'peer_eval_individual')
            ? [
                {
                  label: "Peer Review",
                  path: `/assignment/${id}/reviews`,
                },
                {
                  label: "My Feedback",
                  path: `/assignment/${id}/feedback`,
                },
              ]
            : [])
        ]}
      />

      <div className="peer-reviews-content TabPageContent">
        <div className="reviews-header">
          <h2>Peer Reviews for {assignment?.name}</h2>
          {assignment?.due_date && (
            <p className="due-date">
              Due: {formatDate(assignment.due_date)}
              {deadlinePassed && (
                <span className="deadline-passed"> (Deadline passed)</span>
              )}
            </p>
          )}
        </div>


        {assignmentType === 'peer_eval_group' ? (
          <div className="reviews-list">
            {groupStatus?.submitted ? (
              <>
                <div className="no-reviews">
                  <p>Your group has already submitted the peer evaluation.</p>
                </div>

                {groupStatus.submission?.evaluations?.length && !showSubmittedGroupSubmission ? (
                  <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1rem' }}>
                    <Button onClick={() => setShowSubmittedGroupSubmission(true)}>
                      View submission
                    </Button>
                  </div>
                ) : null}

                {groupStatus.submission?.evaluations?.length && showSubmittedGroupSubmission ? (
                  <>
                    <h3>Submitted Evaluation</h3>
                    <p>This is what your group submitted (read-only).</p>

                    {groupStatus.submission.evaluations.map((ev) => {
                      const byCriterion: Record<number, { grade: number; comments: string }> = {};
                      for (const c of ev.criteria) {
                        byCriterion[c.criterionRowID] = {
                          grade: c.grade ?? 0,
                          comments: c.comments ?? '',
                        };
                      }

                      const grades = groupCriteriaMeta.ids.map((rowId) => byCriterion[rowId]?.grade ?? 0);
                      const additionalComments = (() => {
                        const preferred = groupCommentCriterionId ? (byCriterion[groupCommentCriterionId]?.comments ?? '').trim() : '';
                        if (preferred) return preferred;
                        const all = ev.criteria
                          .map((c) => (c.comments ?? '').trim())
                          .filter((txt) => txt.length > 0);
                        return all.join('\n\n');
                      })();

                      return (
                        <div key={ev.reviewee_group.id} className="review-card completed group-peer-eval-card" style={{ cursor: 'default' }}>
                          <div className="review-info">
                            <h4>Evaluated: {ev.reviewee_group.name}</h4>
                            <Criteria
                              questions={groupCriteriaMeta.questions}
                              scoreMaxes={groupCriteriaMeta.scoreMaxes}
                              hasScores={groupCriteriaMeta.hasScores}
                              canComment={false}
                              onCriterionSelect={() => { /* read-only */ }}
                              grades={grades}
                              readOnly
                            />

                            <div className="criteria-list">
                              <div className="criterion-item">
                                <div className="criterion-comments">
                                  <label>Additional comments (optional)</label>
                                  <textarea
                                    value={additionalComments}
                                    disabled
                                    placeholder="No comments"
                                    rows={3}
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </>
                ) : null}
              </>
            ) : null}

            {!groupStatus?.submitted ? (
              <>
                <h3>Group Peer Evaluation</h3>
                <p>Complete the rubric for each group below, then submit once.</p>

                {(groupStatus?.targets ?? []).map((t) => {
                  const byTarget = groupDraft[t.id] || {};
                  const grades = groupCriteriaMeta.ids.map((rowId) => byTarget[rowId] ?? 0);

                  return (
                    <div key={t.id} className="review-card pending group-peer-eval-card" style={{ cursor: 'default' }}>
                      <div className="review-info">
                        <h4>Evaluate: {t.name}</h4>
                        <Criteria
                          questions={groupCriteriaMeta.questions}
                          scoreMaxes={groupCriteriaMeta.scoreMaxes}
                          hasScores={groupCriteriaMeta.hasScores}
                          canComment={false}
                          onCriterionSelect={(row, col) => setGroupGrade(t.id, row, col)}
                          grades={grades}
                          readOnly={submittingGroup}
                        />

                        <div className="criteria-list">
                          <div className="criterion-item">
                            <div className="criterion-comments">
                              <label>Additional comments (optional)</label>
                              <textarea
                                value={groupAdditionalComments[t.id] ?? ''}
                                onChange={(e) => setGroupAdditionalComments((prev) => ({ ...prev, [t.id]: e.target.value }))}
                                disabled={submittingGroup}
                                placeholder="Optional comments..."
                                rows={3}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}

                <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1rem' }}>
                  <Button onClick={handleSubmitGroup} disabled={!canSubmitGroup || submittingGroup || deadlinePassed}>
                    {submittingGroup ? 'Submitting...' : 'Submit Peer Evaluation'}
                  </Button>
                </div>
              </>
            ) : null}
          </div>
        ) : reviews.length === 0 ? (
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
                  <h4>{review.reviewee.name}</h4>
                  {assignmentType !== 'peer_eval_individual' ? (
                    review.submission ? (
                      <p className="submission-status">
                        Submission available
                      </p>
                    ) : (
                      <p className="submission-status no-submission">
                        No submission yet
                      </p>
                    )
                  ) : null}
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

