import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  getAssignedReviews,
  getAssignmentDetails,
  getGroupPeerEvalStatus,
  hintAssignmentType,
  submitGroupPeerEval,
  updateGroupPeerEval,
  unsubmitGroupPeerEval,
  syncIndividualPeerEvalReviews,
  type PeerEvalGroupStatusResponse,
  type PeerEvalGroupEvaluation,
} from '../util/api';
import TabNavigation from '../components/TabNavigation';
import BackArrow from '../components/BackArrow';
import Button from '../components/Button';
import Criteria from '../components/Criteria';
import HeaderTitle from '../components/HeaderTitle';
import { ReviewSubmissionPanel } from './ReviewSubmission';
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
  const [reviews, setReviews] = useState<Review[]>([]);
  const [assignment, setAssignment] = useState<AssignmentInfo | null>(null);
  const [assignmentType, setAssignmentType] = useState<string | null>(null);
  const [activeReviewId, setActiveReviewId] = useState<number | null>(null);
  const [groupStatus, setGroupStatus] = useState<PeerEvalGroupStatusResponse | null>(null);
  const [groupDraft, setGroupDraft] = useState<Record<number, Record<number, number>>>({});
  const [groupAdditionalComments, setGroupAdditionalComments] = useState<Record<number, string>>({});
  const [submittingGroup, setSubmittingGroup] = useState(false);
  const [unsubmittingGroup, setUnsubmittingGroup] = useState(false);
  const [editingGroupSubmission, setEditingGroupSubmission] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const currentUserId = useMemo(() => {
    try {
      const stored = localStorage.getItem('user');
      if (!stored) return null;
      const parsed = JSON.parse(stored);
      return typeof parsed?.id === 'number' ? parsed.id : null;
    } catch {
      return null;
    }
  }, []);

  const refreshAssignedReviews = useCallback(async () => {
    if (!id) return;
    const reviewData = await getAssignedReviews(Number(id));
    setReviews(reviewData.reviews);
    setAssignment(reviewData.assignment);
  }, [id]);

  useEffect(() => {
                  document.title = 'Reviews';

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
          setEditingGroupSubmission(false);
          setAssignment({ id: gs.assignment.id, name: gs.assignment.name, due_date: details?.due_date ?? null, can_submit: !gs.submitted });
          setReviews([]);
          setActiveReviewId(null);
        } else {
          // Individual peer eval (or legacy): ensure reviews exist for current group
          if (type === 'peer_eval_individual') {
            await syncIndividualPeerEvalReviews(Number(id));
          }

          await refreshAssignedReviews();

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
  }, [id, refreshAssignedReviews]);

  useEffect(() => {
    if (!id) return;
    if (!assignmentType) return;
    // Seed a hint so other tabs (especially Details) can render correctly
    // without waiting for a full assignment details fetch.
    hintAssignmentType(Number(id), assignmentType);
  }, [id, assignmentType]);

  const handleReviewClick = (reviewId: number) => {
    setActiveReviewId(reviewId);
  };

  const groupCriteriaMeta = useMemo(() => {
    const criteria = groupStatus?.criteria ?? [];
    return {
      questions: criteria.map((c) => c.question),
      scoreMaxes: criteria.map((c) => c.scoreMax),
      ids: criteria.map((c) => c.id),
    };
  }, [groupStatus]);

  const groupCommentCriterionId = useMemo(() => {
    const criteria = groupStatus?.criteria ?? [];
    return criteria[0]?.id ?? null;
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
    if (groupStatus.submitted && !editingGroupSubmission) return false;

    for (const target of groupStatus.targets) {
      const byTarget = groupDraft[target.id] || {};
      for (const crit of groupStatus.criteria) {
        const grade = byTarget[crit.id] ?? 0;
        if (grade <= 0) return false;
      }
    }
    return true;
  }, [groupDraft, groupStatus, editingGroupSubmission]);

  const handleSubmitGroup = async () => {
    if (!id || !groupStatus) return;
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
            grade: byTarget[c.id] ?? 0,
            comments: groupCommentCriterionId && c.id === groupCommentCriterionId ? (additional || null) : null,
          })),
        };
      });

      if (groupStatus.submitted) {
        await updateGroupPeerEval(Number(id), evaluations);
      } else {
        await submitGroupPeerEval(Number(id), evaluations);
      }

      const refreshed = await getGroupPeerEvalStatus(Number(id));
      setGroupStatus(refreshed);
      setEditingGroupSubmission(false);
      setAssignment((prev) => (prev ? { ...prev, can_submit: !refreshed.submitted } : prev));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to submit group peer evaluation.');
    } finally {
      setSubmittingGroup(false);
    }
  };

  const handleEditGroup = () => {
    if (!groupStatus?.submission) return;

    const nextDraft: Record<number, Record<number, number>> = {};
    const nextAdditional: Record<number, string> = {};

    for (const ev of groupStatus.submission.evaluations) {
      const byTarget: Record<number, number> = {};
      for (const c of ev.criteria) {
        byTarget[c.criterionRowID] = c.grade ?? 0;
      }
      nextDraft[ev.reviewee_group.id] = byTarget;

      const preferred = groupCommentCriterionId
        ? (ev.criteria.find((c) => c.criterionRowID === groupCommentCriterionId)?.comments ?? '').trim()
        : '';
      if (preferred) {
        nextAdditional[ev.reviewee_group.id] = preferred;
        continue;
      }

      const any = ev.criteria
        .map((c) => (c.comments ?? '').trim())
        .filter((txt) => txt.length > 0)
        .join('\n\n');
      if (any) nextAdditional[ev.reviewee_group.id] = any;
    }

    setGroupDraft(nextDraft);
    setGroupAdditionalComments(nextAdditional);
    setEditingGroupSubmission(true);
  };

  const handleUnsubmitGroup = async () => {
    if (!id) return;
    try {
      setUnsubmittingGroup(true);
      setError(null);

      await unsubmitGroupPeerEval(Number(id));

      const refreshed = await getGroupPeerEvalStatus(Number(id));
      setGroupStatus(refreshed);
      setEditingGroupSubmission(false);
      setGroupDraft({});
      setGroupAdditionalComments({});
      setAssignment((prev) => (prev ? { ...prev, can_submit: !refreshed.submitted } : prev));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to unsubmit group peer evaluation.');
    } finally {
      setUnsubmittingGroup(false);
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
      <div className="peer-reviews-container Page" data-build="peerreviews-no-progress">
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
      <div className="peer-reviews-container Page" data-build="peerreviews-no-progress">
        <BackArrow />
        <div className="error-message">{error}</div>
      </div>
    );
  }

  return (
    <div className="peer-reviews-container Page" data-build="peerreviews-no-progress">
      {activeReviewId !== null ? (
        <div className="peer-reviews-drillBackRow">
          <Button
            type="secondary"
            onClick={() => {
              setActiveReviewId(null);
              void refreshAssignedReviews();
            }}
          >
            ← Back
          </Button>
        </div>
      ) : (
        <BackArrow />
      )}
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
        {activeReviewId === null ? (
          <div className="reviews-header">
            <h2>Peer Reviews for {assignment?.name}</h2>
            {assignment?.due_date && (
              <p className="due-date">
                Due: {formatDate(assignment.due_date)}
              </p>
            )}
          </div>
        ) : null}

        {assignmentType === 'peer_eval_group' ? (
          <div className="reviews-list">
            {groupStatus?.submitted ? (
              <>
                {(() => {
                  const submittedById = groupStatus.submission?.submitted_by_user_id ?? null;
                  const submittedByName = groupStatus.submission?.submitted_by_name ?? null;
                  const isSubmitter = currentUserId !== null && submittedById !== null && currentUserId === submittedById;

                  if (isSubmitter) return null;

                  if (submittedByName) {
                    return (
                      <div className="no-reviews">
                        <p>Your group member {submittedByName} has already submitted the peer evaluation.</p>
                      </div>
                    );
                  }

                  return (
                    <div className="no-reviews">
                      <p>Your group has already submitted the peer evaluation.</p>
                    </div>
                  );
                })()}

                {groupStatus.submission && currentUserId !== null && groupStatus.submission.submitted_by_user_id === currentUserId ? (
                  <div className="review-action-row">
                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                      <Button onClick={handleUnsubmitGroup} disabled={unsubmittingGroup || submittingGroup}>
                        {unsubmittingGroup ? 'Unsubmitting...' : 'Unsubmit Peer Evaluation'}
                      </Button>
                      <Button type="secondary" onClick={handleEditGroup} disabled={submittingGroup || unsubmittingGroup}>
                        Edit
                      </Button>
                    </div>
                  </div>
                ) : null}

                {!editingGroupSubmission && groupStatus.submission?.evaluations?.length ? (
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
                              canComment={false}
                              onCriterionSelect={() => { /* read-only */ }}
                              grades={grades}
                              readOnly
                            />

                            {additionalComments.trim() ? (
                              <div className="criteria-list">
                                <div className="criterion-item">
                                  <div className="criterion-comments">
                                    <label>Additional comments</label>
                                    <textarea value={additionalComments} disabled rows={3} />
                                  </div>
                                </div>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </>
                ) : null}
              </>
            ) : null}

            {!groupStatus?.submitted || editingGroupSubmission ? (
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

                <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: '1rem' }}>
                  <Button onClick={handleSubmitGroup} disabled={!canSubmitGroup || submittingGroup}>
                    {submittingGroup ? 'Submitting...' : 'Submit Peer Evaluation'}
                  </Button>
                </div>
              </>
            ) : null}
          </div>
        ) : activeReviewId !== null ? (
          <ReviewSubmissionPanel
            assignmentId={id ? Number(id) : null}
            reviewId={activeReviewId}
            embedded
            onExit={() => {
              setActiveReviewId(null);
              void refreshAssignedReviews();
            }}
          />
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
                onClick={() => handleReviewClick(review.id)}
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
      </div>
    </div>
  );
}

