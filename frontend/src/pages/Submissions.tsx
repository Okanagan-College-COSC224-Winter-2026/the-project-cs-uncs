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
  listCourseMembers,
  listSubmissions,
  getAssignmentDetails,
  getSubmissionAttachmentDownloadUrl,
  getSubmissionDownloadUrl,
  getRubricCriteria,
  type TeacherGroupPeerEvalOverviewResponse,
  peekAssignmentDetails,
  getTeacherCriterionGrades,
  saveTeacherCriterionGrades,
  type TeacherCriterionGrade,
} from "../util/api";
import { updateGrade } from "../util/api_client/classes";
import "./Groups.css";

type CourseMember = {
  id: number;
  name?: string | null;
  email?: string | null;
  role?: string | null;
};

type Submission = {
  id: number;
  student: { id: number; name?: string | null; email?: string | null };
  file_name?: string | null;
  attachments?: Array<{ id: number; file_name?: string | null }>;
  submitted_at?: string | null;
  on_time?: boolean | null;
  grade?: number | null;
};

type AssignmentDetails = {
  id: number;
  name?: string | null;
  courseID?: number;
  course?: { id: number };
  assignment_type?: string | null;
  max_points?: number | null;
};

type GroupPeerEvalSubmission = TeacherGroupPeerEvalOverviewResponse["submissions"][number];
type GroupPeerEvalEvaluation = GroupPeerEvalSubmission["evaluations"][number];
type GroupPeerEvalCriterion = GroupPeerEvalEvaluation["criteria"][number];

export default function Submissions() {
    useEffect(()=>{
                    document.title = 'Submissions';
})
  const { id } = useParams<{ id: string }>();

  const [assignmentName, setAssignmentName] = useState<string | null>(null);
  const [courseId, setCourseId] = useState<number | null>(null);
  const [assignmentType, setAssignmentType] = useState<string | null>(null);
  const [assignmentMaxPoints, setAssignmentMaxPoints] = useState<number | null>(null);

  const [groups, setGroups] = useState<CourseGroup[]>([]);
  const [students, setStudents] = useState<CourseMember[]>([]);
  const [submissionsByStudentId, setSubmissionsByStudentId] = useState<Record<number, Submission>>({});
  const [groupPeerEvalByGroupId, setGroupPeerEvalByGroupId] = useState<Record<number, TeacherGroupPeerEvalOverviewResponse["submissions"][number]>>({});

  const [selectedGroup, setSelectedGroup] = useState<CourseGroup | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingRoster, setLoadingRoster] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Grade editing state (for standard assignments)
  const [editingGradeStudentId, setEditingGradeStudentId] = useState<number | null>(null);
  const [editGradeValue, setEditGradeValue] = useState<string>("");
  const [savingGradeStudentId, setSavingGradeStudentId] = useState<number | null>(null);
  const [gradeError, setGradeError] = useState<string | null>(null);

  // Rubric criteria for standard assignments (teacher criterion grading)
  const [rubricCriteria, setRubricCriteria] = useState<TeacherCriterionGrade[]>([]);
  // Criterion grading state: studentId → {grades, editing, saving, error}
  const [criterionGradesByStudent, setCriterionGradesByStudent] = useState<
    Record<number, TeacherCriterionGrade[]>
  >({});
  const [editingCriterionStudentId, setEditingCriterionStudentId] = useState<number | null>(null);
  const [editCriterionValues, setEditCriterionValues] = useState<Record<number, string>>({});
  const [savingCriterionStudentId, setSavingCriterionStudentId] = useState<number | null>(null);
  const [criterionError, setCriterionError] = useState<string | null>(null);

  const isTeacherOrAdmin = hasRole("teacher", "admin");

  const tabs = useMemo(() => {
    const showRubricTab = (assignmentType === "peer_eval_group" || assignmentType === "peer_eval_individual") && isTeacherOrAdmin;
    const showTeacherPeerReviewsTab = (assignmentType === "peer_eval_group" || assignmentType === "peer_eval_individual") && isTeacherOrAdmin;
    const showGroupSubmissionsTab = assignmentType !== "peer_eval_individual";
    const submissionsLabel = assignmentType === "standard" ? "Student Submissions" : "Group Submissions";
    const tabsForTeacher = [
      ...(showRubricTab ? [{ label: "Rubric", path: `/assignment/${id}` }] : []),
      { label: "Details", path: `/assignment/${id}/details` },
      ...(showGroupSubmissionsTab ? [{ label: submissionsLabel, path: `/assignment/${id}/submissions` }] : []),
      ...(showTeacherPeerReviewsTab ? [{ label: "Peer Reviews", path: `/assignment/${id}/teacher-reviews` }] : []),
    ];

    const tabsForStudent = [
      { label: "Details", path: `/assignment/${id}/details` },
      { label: "Peer Review", path: `/assignment/${id}/reviews` },
      { label: "My Feedback", path: `/assignment/${id}/feedback` },
    ];

    return isTeacherOrAdmin ? tabsForTeacher : tabsForStudent;
  }, [assignmentType, id, isTeacherOrAdmin]);

  useEffect(() => {
    if (!isTeacherOrAdmin) return
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);

      try {
        if (!id) return;

        // Seed from cache so the tab bar doesn't jump while the network request is in flight.
        const cached = peekAssignmentDetails(Number(id));
        if (cached) {
          if (typeof cached === "object") {
            const record = cached as Record<string, unknown>;
            setAssignmentName(typeof record.name === "string" ? record.name : null);
            setAssignmentType(typeof record.assignment_type === "string" ? record.assignment_type : null);
          }
        }

        const details = (await getAssignmentDetails(Number(id))) as AssignmentDetails;
        if (cancelled) return;

        setAssignmentName(details?.name ?? null);
        setAssignmentType(details?.assignment_type ?? null);
        setAssignmentMaxPoints(details?.max_points ?? null);

        const resolvedCourseId = Number(details?.course?.id ?? details?.courseID);
        setCourseId(Number.isFinite(resolvedCourseId) ? resolvedCourseId : null);

        // Fetch rubric criteria for standard assignments so teacher can grade per-criterion.
        if (details?.assignment_type === "standard") {
          try {
            const criteria = await getRubricCriteria(Number(id));
            if (!cancelled && Array.isArray(criteria)) {
              // getRubricCriteria returns {id, question, scoreMax}; normalize to TeacherCriterionGrade shape.
              setRubricCriteria(
                criteria.map((c: Record<string, unknown>) => ({
                  criterionRowID: c.id as number,
                  question: c.question as string,
                  scoreMax: c.scoreMax as number,
                  grade: null,
                  comments: null,
                }))
              );
            }
          } catch {
            // Rubric criteria are optional; ignore fetch errors silently.
          }
        } else {
          setRubricCriteria([]);
        }

        setSelectedGroup(null);
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
  }, [id, isTeacherOrAdmin]);

  useEffect(() => {
    if (!isTeacherOrAdmin) return
    let cancelled = false;

    (async () => {
      if (!id) return;
      if (!courseId) return;
      if (!assignmentType) return;

      try {
        setLoadingRoster(true);

        if (assignmentType === "standard") {
          const [studentsResp, submissionsResp] = await Promise.all([
            listCourseMembers(String(courseId)),
            listSubmissions(Number(id)),
          ]);
          if (cancelled) return;

          const roster = (Array.isArray(studentsResp) ? studentsResp : []) as CourseMember[];
          roster.sort((a, b) => String(a?.name ?? "").localeCompare(String(b?.name ?? "")));
          setStudents(roster);

          const submissions = (submissionsResp?.submissions ?? []) as Submission[];
          const map: Record<number, Submission> = {};
          for (const sub of submissions) {
            if (sub?.student?.id) map[sub.student.id] = sub;
          }
          setSubmissionsByStudentId(map);

          setGroups([]);
          setGroupPeerEvalByGroupId({});
          return;
        }

        const groupsResp = await listCourseGroups(courseId);
        if (cancelled) return;

        setGroups(groupsResp);
        setStudents([]);

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
      } finally {
        if (!cancelled) setLoadingRoster(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [assignmentType, courseId, id, isTeacherOrAdmin]);

  if (!isTeacherOrAdmin) {
    return <Navigate to={`/assignment/${id}`} replace />;
  }

  if (assignmentType === "peer_eval_individual") {
    return <Navigate to={`/assignment/${id}/teacher-reviews`} replace />;
  }

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

  const startGradeEdit = (studentId: number, currentGrade: number | null | undefined) => {
    setEditingGradeStudentId(studentId);
    setEditGradeValue(currentGrade != null ? String(currentGrade) : "");
    setGradeError(null);
  };

  const cancelGradeEdit = () => {
    setEditingGradeStudentId(null);
    setEditGradeValue("");
    setGradeError(null);
  };

  const saveGrade = async (studentId: number) => {
    if (!id || !courseId) return;
    const gradeNum = editGradeValue.trim() === "" ? null : Number(editGradeValue);
    if (gradeNum !== null && (isNaN(gradeNum) || gradeNum < 0)) {
      setGradeError("Grade must be a non-negative number or empty to clear.");
      return;
    }
    setSavingGradeStudentId(studentId);
    setGradeError(null);
    try {
      const result = await updateGrade(courseId, studentId, Number(id), gradeNum);
      setSubmissionsByStudentId((prev) => {
        const sub = prev[studentId];
        if (!sub) return prev;
        return { ...prev, [studentId]: { ...sub, grade: result.grade } };
      });
      setEditingGradeStudentId(null);
      setEditGradeValue("");
    } catch (e) {
      setGradeError(e instanceof Error ? e.message : "Failed to save grade.");
    } finally {
      setSavingGradeStudentId(null);
    }
  };

  const startCriterionEdit = async (studentId: number) => {
    setCriterionError(null);
    setEditingCriterionStudentId(studentId);

    // Load existing teacher grades if not already cached.
    if (!criterionGradesByStudent[studentId]) {
      try {
        const result = await getTeacherCriterionGrades(Number(id), studentId);
        // Merge saved grades into rubric criteria (both use criterionRowID).
        const merged = rubricCriteria.map((c) => {
          const saved = result.criteria.find((r) => r.criterionRowID === c.criterionRowID);
          return { ...c, grade: saved?.grade ?? null, comments: saved?.comments ?? null };
        });
        const displayCriteria = merged.length ? merged : result.criteria;
        setCriterionGradesByStudent((prev) => ({ ...prev, [studentId]: displayCriteria }));
        const initValues: Record<number, string> = {};
        for (const c of displayCriteria) {
          initValues[c.criterionRowID] = c.grade != null ? String(c.grade) : "";
        }
        setEditCriterionValues(initValues);
      } catch {
        // Fall back to empty values using rubric criteria.
        const initValues: Record<number, string> = {};
        for (const c of rubricCriteria) {
          initValues[c.criterionRowID] = "";
        }
        setEditCriterionValues(initValues);
      }
    } else {
      const initValues: Record<number, string> = {};
      for (const c of criterionGradesByStudent[studentId]) {
        initValues[c.criterionRowID] = c.grade != null ? String(c.grade) : "";
      }
      setEditCriterionValues(initValues);
    }
  };

  const cancelCriterionEdit = () => {
    setEditingCriterionStudentId(null);
    setEditCriterionValues({});
    setCriterionError(null);
  };

  const saveCriterionGrades = async (studentId: number) => {
    if (!id) return;
    const criteria = criterionGradesByStudent[studentId] ?? rubricCriteria;
    const grades = criteria.map((c) => {
      const raw = editCriterionValues[c.criterionRowID];
      const grade = raw == null || raw.trim() === "" ? null : Number(raw);
      return { criterionRowID: c.criterionRowID, grade: Number.isFinite(grade) ? grade : null };
    });

    // Validate each grade against its scoreMax.
    for (const c of criteria) {
      const g = grades.find((x) => x.criterionRowID === c.criterionRowID);
      if (g?.grade != null && (g.grade < 0 || g.grade > c.scoreMax)) {
        setCriterionError(`Grade for "${c.question}" must be between 0 and ${c.scoreMax}.`);
        return;
      }
    }

    setSavingCriterionStudentId(studentId);
    setCriterionError(null);
    try {
      const result = await saveTeacherCriterionGrades(Number(id), studentId, grades);
      // Update submission grade display.
      setSubmissionsByStudentId((prev) => {
        const sub = prev[studentId];
        if (!sub) return prev;
        return { ...prev, [studentId]: { ...sub, grade: result.grade } };
      });
      // Cache the saved grades.
      const updated = criteria.map((c) => {
        const g = grades.find((x) => x.criterionRowID === c.criterionRowID);
        return { ...c, grade: g?.grade ?? null };
      });
      setCriterionGradesByStudent((prev) => ({ ...prev, [studentId]: updated }));
      setEditingCriterionStudentId(null);
      setEditCriterionValues({});
    } catch (e) {
      setCriterionError(e instanceof Error ? e.message : "Failed to save criterion grades.");
    } finally {
      setSavingCriterionStudentId(null);
    }
  };

  return (
    <div className="Page">
      {selectedGroup ? (
        <div className="GroupsDrillBackRow">
          <Button type="secondary" onClick={() => setSelectedGroup(null)}>
            ← Back
          </Button>
        </div>
      ) : (
        <BackArrow />
      )}
      <div className="AssignmentHeader">
        <h2>
          <HeaderTitle title={assignmentName} loading={loading} fallback="Assignment" />
        </h2>
      </div>

      <TabNavigation tabs={tabs} />

      <div className="TabPageContent">
        <div className="GroupsPage">
          {error ? <div className="GroupsError">{error}</div> : null}
          {loading ? <div className="PageStatusText">Loading…</div> : null}
          {!loading && loadingRoster ? <div className="PageStatusText">Loading…</div> : null}

          {assignmentType === "standard" ? (
            <div className="GroupsPanel">
              <>
                <h3>Student Submissions</h3>
                {(gradeError || criterionError) ? (
                  <div className="GroupsError" style={{ marginBottom: 8 }}>{gradeError || criterionError}</div>
                ) : null}
                {students.length === 0 ? (
                  <div className="GroupsMuted">No students found.</div>
                ) : (
                  <div className="GroupsDetailList">
                    {students.map((s) => {
                      const sub = submissionsByStudentId[s.id];
                      const displayName = (s.name ?? "").trim() || s.email || `Student #${s.id}`;
                      const isEditingGrade = editingGradeStudentId === s.id;
                      const isSavingGrade = savingGradeStudentId === s.id;
                      const isEditingCriterion = editingCriterionStudentId === s.id;
                      const isSavingCriterion = savingCriterionStudentId === s.id;
                      const hasCriteria = rubricCriteria.length > 0;

                      return (
                        <div key={s.id} className="GroupsDetailRow">
                          <div style={{ display: "flex", gap: 12, alignItems: "baseline" }}>
                            <div style={{ fontWeight: 600 }}>{displayName}</div>
                            {s.email ? <div className="GroupsMuted">{s.email}</div> : null}
                          </div>

                          <div className="GroupsMuted" style={{ marginTop: 6 }}>
                            {sub ? (
                              <>
                                <div>
                                  Submitted
                                  {typeof sub.on_time === "boolean" ? (sub.on_time ? " (On time)" : " (Late)") : ""}
                                  {Array.isArray(sub.attachments) && sub.attachments.length > 0
                                    ? ` (${sub.attachments.length} file${sub.attachments.length === 1 ? "" : "s"})`
                                    : sub.file_name
                                      ? `: ${sub.file_name}`
                                      : ""}
                                </div>

                                {Array.isArray(sub.attachments) && sub.attachments.length > 0 ? (
                                  <div style={{ marginTop: 6 }}>
                                    {sub.attachments.map((a, idx) => {
                                      const label = (a.file_name ?? "").trim() || `File ${idx + 1}`;
                                      return (
                                        <div key={a.id}>
                                          <a
                                            href={getSubmissionAttachmentDownloadUrl(a.id)}
                                            target="_blank"
                                            rel="noreferrer"
                                          >
                                            Download: {label}
                                          </a>
                                        </div>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <div style={{ marginTop: 6 }}>
                                    <a href={getSubmissionDownloadUrl(sub.id)} target="_blank" rel="noreferrer">
                                      Download
                                    </a>
                                  </div>
                                )}
                              </>
                            ) : (
                              "No submission"
                            )}
                          </div>

                          {/* Criterion-based grading (when assignment has a rubric) */}
                          {hasCriteria ? (
                            <div style={{ marginTop: 8 }}>
                              {isEditingCriterion ? (
                                <div>
                                  {criterionError ? (
                                    <div className="GroupsError" style={{ marginBottom: 6 }}>{criterionError}</div>
                                  ) : null}
                                  <table style={{ borderCollapse: "collapse", width: "100%", marginBottom: 8 }}>
                                    <tbody>
                                      {rubricCriteria.map((c) => (
                                        <tr key={c.criterionRowID}>
                                          <td style={{ paddingRight: 12, paddingBottom: 6 }}>{c.question}</td>
                                          <td style={{ whiteSpace: "nowrap" }}>
                                            <input
                                              type="number"
                                              min="0"
                                              max={c.scoreMax}
                                              step="1"
                                              value={editCriterionValues[c.criterionRowID] ?? ""}
                                              onChange={(e) =>
                                                setEditCriterionValues((prev) => ({
                                                  ...prev,
                                                  [c.criterionRowID]: e.target.value,
                                                }))
                                              }
                                              disabled={isSavingCriterion}
                                              style={{ width: 60 }}
                                            />
                                            <span className="GroupsMuted"> / {c.scoreMax}</span>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                  <div style={{ display: "flex", gap: 6 }}>
                                    <Button
                                      type="regular"
                                      onClick={() => void saveCriterionGrades(s.id)}
                                      disabled={isSavingCriterion}
                                    >
                                      {isSavingCriterion ? "Saving…" : "Save"}
                                    </Button>
                                    <Button type="secondary" onClick={cancelCriterionEdit} disabled={isSavingCriterion}>
                                      Cancel
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <div>
                                  <div style={{ marginBottom: 4 }}>
                                    Grade:{" "}
                                    {sub?.grade != null ? (
                                      <strong>
                                        {sub.grade}
                                        {assignmentMaxPoints != null ? ` / ${assignmentMaxPoints}` : ""}
                                      </strong>
                                    ) : (
                                      <span className="GroupsMuted">—</span>
                                    )}
                                  </div>
                                  {criterionGradesByStudent[s.id] ? (
                                    <table style={{ borderCollapse: "collapse", fontSize: "0.9em", marginBottom: 6 }}>
                                      <tbody>
                                        {criterionGradesByStudent[s.id].map((c) => (
                                          <tr key={c.criterionRowID}>
                                            <td style={{ paddingRight: 8, paddingBottom: 2 }} className="GroupsMuted">{c.question}</td>
                                            <td style={{ whiteSpace: "nowrap" }}>
                                              {c.grade != null ? (
                                                <strong>{c.grade} / {c.scoreMax}</strong>
                                              ) : (
                                                <span className="GroupsMuted">—</span>
                                              )}
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  ) : null}
                                  <Button
                                    type="secondary"
                                    onClick={() => void startCriterionEdit(s.id)}
                                  >
                                    {sub?.grade != null ? "Edit criteria grades" : "Grade by criteria"}
                                  </Button>
                                </div>
                              )}
                            </div>
                          ) : (
                            /* Simple single-number grading when no rubric criteria */
                            <div style={{ marginTop: 8 }}>
                              {isEditingGrade ? (
                                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.5"
                                    placeholder="Grade"
                                    value={editGradeValue}
                                    onChange={(e) => setEditGradeValue(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") void saveGrade(s.id);
                                      if (e.key === "Escape") cancelGradeEdit();
                                    }}
                                    disabled={isSavingGrade}
                                    style={{ width: 90 }}
                                    autoFocus
                                  />
                                  <Button
                                    type="regular"
                                    onClick={() => void saveGrade(s.id)}
                                    disabled={isSavingGrade}
                                  >
                                    {isSavingGrade ? "Saving…" : "Save"}
                                  </Button>
                                  <Button type="secondary" onClick={cancelGradeEdit} disabled={isSavingGrade}>
                                    Cancel
                                  </Button>
                                </div>
                              ) : (
                                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                  <span>
                                    Grade:{" "}
                                    {sub?.grade != null ? (
                                      <strong>
                                        {sub.grade}
                                        {assignmentMaxPoints != null ? ` / ${assignmentMaxPoints}` : ""}
                                      </strong>
                                    ) : (
                                      <span className="GroupsMuted">—</span>
                                    )}
                                  </span>
                                  <Button
                                    type="secondary"
                                    onClick={() => startGradeEdit(s.id, sub?.grade)}
                                  >
                                    {sub?.grade != null ? "Edit grade" : "Add grade"}
                                  </Button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            </div>
          ) : selectedGroup ? (
            <>
              <div className="GroupsPanel">
                <h3 style={{ margin: 0 }}>{selectedGroup.name}</h3>

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
                          groupSubmission.evaluations?.map((ev: GroupPeerEvalEvaluation, idx: number) => {
                            const sorted: GroupPeerEvalCriterion[] = [...(ev?.criteria ?? [])].sort(
                              (a, b) => Number(a.criterionRowID) - Number(b.criterionRowID)
                            );

                            const questions = sorted.map((c) => c.question);
                            const scoreMaxes = sorted.map((c) => (c.scoreMax == null ? 0 : c.scoreMax));
                            const grades = sorted.map((c) => c.grade ?? 0);

                            return (
                              <div key={ev?.reviewee_group?.id ?? idx} className="GroupsDetailRow">
                                <div style={{ fontWeight: 600, marginBottom: 8 }}>
                                  Evaluated: {ev?.reviewee_group?.name}
                                </div>
                                <Criteria
                                  questions={questions}
                                  scoreMaxes={scoreMaxes}
                                  canComment={false}
                                  onCriterionSelect={() => { /* read-only */ }}
                                  grades={grades}
                                  readOnly
                                />

                                {sorted.some((c) => (c.comments ?? "").trim().length > 0) ? (
                                  <div className="GroupsDetailList" style={{ marginTop: 8 }}>
                                    {sorted.map((c) => (
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
              </div>
            </>
          ) : (
            <div className="GroupsPanel">
              <>
                <h3>Group Submissions</h3>
                {groups.length === 0 ? (
                  <div className="GroupsMuted">No groups yet.</div>
                ) : (
                  <div className="GroupsList">
                    {groups.map((group) => {
                      const submittedCount = submittedCountForGroup(group);
                      const groupSub = assignmentType === "peer_eval_group" ? getGroupPeerEvalSubmission(group) : null;
                      const onTimeLabel =
                        assignmentType === "peer_eval_group" && typeof groupSub?.on_time === "boolean"
                          ? (groupSub.on_time ? " (On time)" : " (Late)")
                          : "";

                      return (
                        <div key={group.id} className="GroupItem">
                          <button className="GroupItemMain" onClick={() => setSelectedGroup(group)} type="button">
                            <div className="GroupItemName">{group.name}</div>
                            <div className="GroupItemMeta">
                              {submittedCount > 0 ? `Submitted${onTimeLabel}` : "No submission"}
                            </div>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
