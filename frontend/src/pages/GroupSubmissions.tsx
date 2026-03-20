import { useEffect, useMemo, useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import BackArrow from "../components/BackArrow";
import Button from "../components/Button";
import TabNavigation from "../components/TabNavigation";
import Criteria from "../components/Criteria";
import HeaderTitle from "../components/HeaderTitle";
import { hasRole } from "../util/login";
import {
  CourseGroup,
  getTeacherGroupPeerEvalOverview,
  listCourseGroups,
  listSubmissions,
  getAssignmentDetails,
  getSubmissionDownloadUrl,
  type TeacherGroupPeerEvalOverviewResponse,
} from "../util/api";
import "./Groups.css";

type Submission = {
  id: number;
  student: { id: number; name?: string | null; email?: string | null };
  file_name?: string | null;
};

type AssignmentDetails = {
  id: number;
  name?: string | null;
  courseID?: number;
  course?: { id: number };
  assignment_type?: string | null;
};

export default function GroupSubmissions() {
  const { id } = useParams<{ id: string }>();

  const [assignmentName, setAssignmentName] = useState<string | null>(null);
  const [courseId, setCourseId] = useState<number | null>(null);
  const [assignmentType, setAssignmentType] = useState<string | null>(null);

  const [groups, setGroups] = useState<CourseGroup[]>([]);
  const [submissionsByStudentId, setSubmissionsByStudentId] = useState<Record<number, Submission>>({});
  const [groupPeerEvalByGroupId, setGroupPeerEvalByGroupId] = useState<Record<number, TeacherGroupPeerEvalOverviewResponse["submissions"][number]>>({});

  const [selectedGroup, setSelectedGroup] = useState<CourseGroup | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isTeacherOrAdmin = hasRole("teacher", "admin");

  const tabs = useMemo(() => {
    const showRubricTab = (assignmentType === "peer_eval_group" || assignmentType === "peer_eval_individual") && isTeacherOrAdmin;
    const showTeacherPeerReviewsTab = (assignmentType === "peer_eval_group" || assignmentType === "peer_eval_individual") && isTeacherOrAdmin;
    const tabsForTeacher = [
      ...(showRubricTab ? [{ label: "Rubric", path: `/assignment/${id}` }] : []),
      { label: "Details", path: `/assignment/${id}/details` },
      { label: "Group Submissions", path: `/assignment/${id}/group-submissions` },
      ...(showTeacherPeerReviewsTab ? [{ label: "Peer Reviews", path: `/assignment/${id}/teacher-reviews` }] : []),
    ];

    const tabsForStudent = [
      { label: "Details", path: `/assignment/${id}/details` },
      { label: "Peer Review", path: `/assignment/${id}/reviews` },
      { label: "My Feedback", path: `/assignment/${id}/feedback` },
    ];

    return isTeacherOrAdmin ? tabsForTeacher : tabsForStudent;
  }, [assignmentType, id, isTeacherOrAdmin]);

  if (!isTeacherOrAdmin) {
    return <Navigate to={`/assignment/${id}`} replace />;
  }

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);

      try {
        if (!id) return;

        const details = (await getAssignmentDetails(Number(id))) as AssignmentDetails;
        if (cancelled) return;

        setAssignmentName(details?.name ?? null);
        setAssignmentType(details?.assignment_type ?? null);

        const resolvedCourseId = Number(details?.course?.id ?? details?.courseID);
        setCourseId(Number.isFinite(resolvedCourseId) ? resolvedCourseId : null);
      } catch (e: unknown) {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg || "Failed to load assignment");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!id) return;
      if (!courseId) return;

      try {
        const groupsResp = await listCourseGroups(courseId);
        if (cancelled) return;

        setGroups(groupsResp);

        if (assignmentType === "peer_eval_group") {
          const overview = await getTeacherGroupPeerEvalOverview(Number(id));
          if (cancelled) return;

          const map: Record<number, TeacherGroupPeerEvalOverviewResponse["submissions"][number]> = {};
          for (const sub of overview.submissions ?? []) {
            const groupId = sub?.reviewer_group?.id;
            if (typeof groupId === "number") map[groupId] = sub;
          }
          setGroupPeerEvalByGroupId(map);
          setSubmissionsByStudentId({});
        } else {
          const submissionsResp = await listSubmissions(Number(id));
          if (cancelled) return;

          const submissions = (submissionsResp?.submissions ?? []) as Submission[];
          const map: Record<number, Submission> = {};
          for (const sub of submissions) {
            if (sub?.student?.id) map[sub.student.id] = sub;
          }
          setSubmissionsByStudentId(map);
          setGroupPeerEvalByGroupId({});
        }
      } catch (e: unknown) {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg || "Failed to load groups/submissions");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [courseId, id]);

  const submittedCountForGroup = (group: CourseGroup) => {
    if (assignmentType === "peer_eval_group") {
      return groupPeerEvalByGroupId[group.id] ? 1 : 0;
    }
    return (group.members ?? []).reduce((count, member) => {
      return submissionsByStudentId[member.id] ? count + 1 : count;
    }, 0);
  };

  const getGroupSubmission = (group: CourseGroup): Submission | null => {
    for (const member of group.members ?? []) {
      const sub = submissionsByStudentId[member.id];
      if (sub) return sub;
    }
    return null;
  };

  const getGroupPeerEvalSubmission = (group: CourseGroup) => {
    return groupPeerEvalByGroupId[group.id] ?? null;
  };

  return (
    <div className="Page">
      <BackArrow />
      <div className="ClassHeader">
        <div className="ClassHeaderLeft">
          <h2>
            <HeaderTitle title={assignmentName} loading={loading} fallback="Assignment" />
          </h2>
        </div>
      </div>

      <TabNavigation tabs={tabs} />

      <div className="GroupsPage">
        {error ? <div className="GroupsError">{error}</div> : null}
        {loading ? <div className="PageStatusText">Loading…</div> : null}

        <div className="GroupsPanel">
          {selectedGroup ? (
            <>
              <div className="GroupsDetailHeader">
                <Button type="secondary" onClick={() => setSelectedGroup(null)}>
                  Back
                </Button>
                <h3>{selectedGroup.name}</h3>
              </div>

              <h4>Members</h4>
              {selectedGroup.members.length === 0 ? (
                <div className="GroupsMuted">No members in this group.</div>
              ) : (
                <div className="GroupsDetailList">
                  {selectedGroup.members.map((m) => (
                    <div key={m.id} className="GroupsDetailRow">
                      {m.name}
                    </div>
                  ))}
                </div>
              )}

              <h4>Submission</h4>
              {(() => {
                if (assignmentType === "peer_eval_group") {
                  const groupSubmission = getGroupPeerEvalSubmission(selectedGroup);
                  if (!groupSubmission) {
                    return <div className="GroupsMuted">No peer evaluation submitted yet.</div>;
                  }

                  return (
                    <div className="GroupsDetailList">
                      {(groupSubmission.evaluations ?? []).length === 0 ? (
                        <div className="GroupsMuted">No peer reviews yet.</div>
                      ) : (
                        groupSubmission.evaluations?.map((ev: any, idx: number) => {
                          const sorted = [...((ev?.criteria ?? []) as any[])].sort(
                            (a: any, b: any) => Number(a.criterionRowID) - Number(b.criterionRowID)
                          );

                          const questions = sorted.map((c: any) => c.question);
                          const scoreMaxes = sorted.map((c: any) => (c.scoreMax == null ? 0 : c.scoreMax));
                          const hasScores = sorted.map((c: any) => c.hasScore);
                          const grades = sorted.map((c: any) => c.grade ?? 0);

                          return (
                            <div key={ev?.reviewee_group?.id ?? idx} className="GroupsDetailRow">
                              <div style={{ fontWeight: 600, marginBottom: 8 }}>
                                Evaluated: {ev?.reviewee_group?.name}
                              </div>
                              <Criteria
                                questions={questions}
                                scoreMaxes={scoreMaxes}
                                hasScores={hasScores}
                                canComment={false}
                                onCriterionSelect={() => { /* read-only */ }}
                                grades={grades}
                                readOnly
                              />

                              {sorted.some((c: any) => (c.comments ?? "").trim().length > 0) ? (
                                <div className="GroupsDetailList" style={{ marginTop: 8 }}>
                                  {sorted.map((c: any) => (
                                    <div key={c.criterionRowID} className="GroupsDetailRow">
                                      <div style={{ fontWeight: 600 }}>{c.question}</div>
                                      <div className="GroupsMuted">{(c.comments ?? "").trim() || "No comments"}</div>
                                    </div>
                                  ))}
                                </div>
                              ) : null}
                            </div>
                          );
                        })
                      )}
                    </div>
                  );
                }

                const groupSubmission = getGroupSubmission(selectedGroup);
                if (!groupSubmission) {
                  return <div className="GroupsMuted">No submission uploaded yet.</div>;
                }

                return (
                  <div className="GroupsDetailList">
                    <div className="GroupsDetailRow">
                      <div>
                        {groupSubmission.file_name ? groupSubmission.file_name : "(file)"} —{" "}
                        <a href={getSubmissionDownloadUrl(groupSubmission.id)} target="_blank" rel="noreferrer">
                          Download
                        </a>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </>
          ) : (
            <>
              <h3>Group Submissions</h3>
              {groups.length === 0 ? (
                <div className="GroupsMuted">No groups yet.</div>
              ) : (
                <div className="GroupsList">
                  {groups.map((group) => {
                    const submittedCount = submittedCountForGroup(group);

                    return (
                      <div key={group.id} className="GroupItem">
                        <button
                          className="GroupItemMain"
                          onClick={() => setSelectedGroup(group)}
                          type="button"
                        >
                          <div className="GroupItemName">{group.name}</div>
                          <div className="GroupItemMeta">{submittedCount > 0 ? "Submitted" : "No submission"}</div>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
