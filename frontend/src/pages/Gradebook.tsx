import { useEffect, useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import { Link } from "react-router-dom";
import BackArrow from "../components/BackArrow";
import TabNavigation from "../components/TabNavigation";
import HeaderTitle from "../components/HeaderTitle";
import StatusMessage from "../components/StatusMessage";
import { isAdmin, isTeacher } from "../util/login";
import { listClasses } from "../util/api_client/classes";
import {
  getGradebook,
  updateGrade,
  type GradebookData,
} from "../util/api_client/classes";
import "./Gradebook.css";

export default function Gradebook() {
  const { id } = useParams<{ id: string }>();
  const [className, setClassName] = useState<string | null>(null);
  const [loadingHeader, setLoadingHeader] = useState(true);
  const [gradebook, setGradebook] = useState<GradebookData | null>(null);
  const [loadingGradebook, setLoadingGradebook] = useState(true);
  const [statusMessage, setStatusMessage] = useState("");
  const [statusType, setStatusType] = useState<"error" | "success">("error");

  // Editing state: key is "<studentId>-<assignmentId>"
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>("");
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [displayMode, setDisplayMode] = useState<"points" | "percent">("points");
  const [feedbackMode, setFeedbackMode] = useState<"avg" | "total">("avg");
  const [editMode, setEditMode] = useState<"points" | "percent">("points");
  const [editOriginalGrade, setEditOriginalGrade] = useState<number | null>(null);

  const isTeacherOrAdmin = isTeacher() || isAdmin();

  useEffect(() => {
    document.title = "Gradebook";
    if (!id) return;
    let cancelled = false;

    (async () => {
      try {
        const [gb, classes] = await Promise.all([
          getGradebook(Number(id)),
          listClasses(),
        ]);
        if (cancelled) return;
        const currentClass = (classes as { id: number; name: string }[]).find(
          (c) => c.id === Number(id)
        );
        setClassName(currentClass?.name ?? null);
        setGradebook(gb);
      } catch (e) {
        if (cancelled) return;
        setStatusType("error");
        setStatusMessage(
          e instanceof Error ? e.message : "Failed to load gradebook."
        );
      } finally {
        if (!cancelled) {
          setLoadingHeader(false);
          setLoadingGradebook(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id]);

  if (!isTeacherOrAdmin) {
    return <Navigate to={`/classes/${id}/home`} replace />;
  }

  const cellKey = (studentId: number, assignmentId: number) =>
    `${studentId}-${assignmentId}`;

  const formatNumber = (value: number) => {
    const rounded = Number(value.toFixed(2));
    return Number.isInteger(rounded) ? String(rounded) : String(rounded);
  };

  const isPeerEvalAssignment = (assignmentType: string) =>
    assignmentType === "peer_eval_individual" || assignmentType === "peer_eval_group";

  const getDisplayPointsAndDenominator = (
    grade: number,
    assignmentType: string,
    maxPoints: number | null,
    feedbackCount: number | null,
    mode: "avg" | "total"
  ) => {
    if (maxPoints == null || maxPoints <= 0) {
      return { points: grade, denominator: null as number | null };
    }
    if (!isPeerEvalAssignment(assignmentType)) {
      return { points: grade, denominator: maxPoints };
    }
    const count = feedbackCount ?? 0;
    if (count <= 0) {
      return { points: grade, denominator: maxPoints };
    }
    if (mode === "avg") {
      return { points: grade / count, denominator: maxPoints };
    }
    return { points: grade, denominator: maxPoints * count };
  };

  const getDisplayGrade = (
    grade: number | null,
    assignmentType: string,
    maxPoints: number | null,
    feedbackCount: number | null,
    mode: "points" | "percent"
  ) => {
    if (grade == null) return null;
    const pointsData = getDisplayPointsAndDenominator(
      grade,
      assignmentType,
      maxPoints,
      feedbackCount,
      feedbackMode
    );
    if (mode === "percent" && pointsData.denominator != null && pointsData.denominator > 0) {
      return `${formatNumber((pointsData.points / pointsData.denominator) * 100)}%`;
    }
    if (mode === "points" && pointsData.denominator != null && pointsData.denominator > 0) {
      return `${formatNumber(pointsData.points)}/${formatNumber(pointsData.denominator)}`;
    }
    return formatNumber(pointsData.points);
  };

  const getEditValue = (
    grade: number | null,
    assignmentType: string,
    maxPoints: number | null,
    feedbackCount: number | null,
    mode: "points" | "percent"
  ) => {
    if (grade == null) return "";
    const pointsData = getDisplayPointsAndDenominator(
      grade,
      assignmentType,
      maxPoints,
      feedbackCount,
      feedbackMode
    );
    if (mode === "percent" && pointsData.denominator != null && pointsData.denominator > 0) {
      return formatNumber((pointsData.points / pointsData.denominator) * 100);
    }
    return formatNumber(pointsData.points);
  };

  const startEdit = (
    studentId: number,
    assignmentId: number,
    current: number | null,
    assignmentType: string,
    feedbackCount: number | null,
    maxPoints: number | null
  ) => {
    const initialMode = displayMode === "percent" && maxPoints != null && maxPoints > 0
      ? "percent"
      : "points";
    setEditingKey(cellKey(studentId, assignmentId));
    setEditMode(initialMode);
    setEditOriginalGrade(current);
    setEditValue(getEditValue(current, assignmentType, maxPoints, feedbackCount, initialMode));
    setStatusMessage("");
  };

  const cancelEdit = () => {
    setEditingKey(null);
    setEditOriginalGrade(null);
    setEditValue("");
  };

  const switchEditMode = (
    mode: "points" | "percent",
    assignmentType: string,
    feedbackCount: number | null,
    maxPoints: number | null
  ) => {
    setEditMode(mode);
    setEditValue(getEditValue(editOriginalGrade, assignmentType, maxPoints, feedbackCount, mode));
  };

  const saveEdit = async (studentId: number, assignmentId: number) => {
    if (!id) return;
    const key = cellKey(studentId, assignmentId);
    setSavingKey(key);
    const assignment = gradebook?.assignments.find((a) => a.id === assignmentId) ?? null;
    const row = gradebook?.rows.find((r) => r.student.id === studentId) ?? null;
    const feedbackCount = row?.feedback_counts[String(assignmentId)] ?? null;
    const maxPoints = assignment?.max_points ?? null;
    const isPeer = assignment != null && isPeerEvalAssignment(assignment.assignment_type);

    let gradeNum: number | null;
    if (editValue.trim() === "") {
      gradeNum = null;
    } else if (editMode === "percent") {
      const percentNum = Number(editValue);
      if (maxPoints == null || maxPoints <= 0) {
        setStatusType("error");
        setStatusMessage("Cannot save percentage for an assignment without total points.");
        setSavingKey(null);
        return;
      }
      if (isNaN(percentNum) || percentNum < 0) {
        setStatusType("error");
        setStatusMessage("Percentage must be a non-negative number or empty to clear.");
        setSavingKey(null);
        return;
      }
      if (isPeer && feedbackMode === "total" && (feedbackCount == null || feedbackCount <= 0)) {
        setStatusType("error");
        setStatusMessage("Cannot use total mode before any peer feedback is completed.");
        setSavingKey(null);
        return;
      }
      if (isPeer && feedbackCount != null && feedbackCount > 0) {
        if (feedbackMode === "avg") {
          gradeNum = ((percentNum / 100) * maxPoints) * feedbackCount;
        } else {
          gradeNum = (percentNum / 100) * (maxPoints * feedbackCount);
        }
      } else {
        gradeNum = (percentNum / 100) * maxPoints;
      }
    } else {
      const pointsNum = Number(editValue);
      if (isPeer && feedbackMode === "total" && (feedbackCount == null || feedbackCount <= 0)) {
        setStatusType("error");
        setStatusMessage("Cannot use total mode before any peer feedback is completed.");
        setSavingKey(null);
        return;
      }
      if (isPeer && feedbackCount != null && feedbackCount > 0 && feedbackMode === "avg") {
        gradeNum = pointsNum * feedbackCount;
      } else {
        gradeNum = pointsNum;
      }
    }

    if (editValue.trim() !== "" && (isNaN(gradeNum as number) || (gradeNum as number) < 0)) {
      setStatusType("error");
      setStatusMessage("Grade must be a non-negative number or empty to clear.");
      setSavingKey(null);
      return;
    }
    try {
      const result = await updateGrade(Number(id), studentId, assignmentId, gradeNum);
      setGradebook((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          rows: prev.rows.map((row) => {
            if (row.student.id !== studentId) return row;
            return {
              ...row,
              grades: {
                ...row.grades,
                [String(assignmentId)]: result.grade,
              },
            };
          }),
        };
      });
      setEditingKey(null);
      setEditOriginalGrade(null);
      setEditValue("");
      setStatusType("success");
      setStatusMessage("Grade saved.");
    } catch (e) {
      setStatusType("error");
      setStatusMessage(e instanceof Error ? e.message : "Failed to save grade.");
    } finally {
      setSavingKey(null);
    }
  };

  const handleKeyDown = (
    e: React.KeyboardEvent,
    studentId: number,
    assignmentId: number
  ) => {
    if (e.key === "Enter") {
      void saveEdit(studentId, assignmentId);
    } else if (e.key === "Escape") {
      cancelEdit();
    }
  };

  return (
    <div className="Page">
      <BackArrow />
      <div className="ClassHeader">
        <div className="ClassHeaderLeft">
          <h2>
            <HeaderTitle title={className} loading={loadingHeader} fallback="Class" />
          </h2>
        </div>
      </div>

      <TabNavigation
        tabs={[
          { label: "Assignments", path: `/classes/${id}/home` },
          { label: "Members", path: `/classes/${id}/members` },
          { label: "Groups", path: `/classes/${id}/groups` },
          { label: "Gradebook", path: `/classes/${id}/gradebook` },
        ]}
      />

      <StatusMessage message={statusMessage} type={statusType} />

      <div className="GradebookDisplayModeRow">
        <span className="GradebookDisplayModeLabel">Display:</span>
        <button
          type="button"
          className={`GradebookModeBtn ${displayMode === "points" ? "active" : ""}`}
          onClick={() => setDisplayMode("points")}
        >
          Points
        </button>
        <button
          type="button"
          className={`GradebookModeBtn ${displayMode === "percent" ? "active" : ""}`}
          onClick={() => setDisplayMode("percent")}
        >
          Percent
        </button>
        <span className="GradebookDisplayModeLabel">Peer view:</span>
        <button
          type="button"
          className={`GradebookModeBtn ${feedbackMode === "avg" ? "active" : ""}`}
          onClick={() => setFeedbackMode("avg")}
        >
          Avg
        </button>
        <button
          type="button"
          className={`GradebookModeBtn ${feedbackMode === "total" ? "active" : ""}`}
          onClick={() => setFeedbackMode("total")}
        >
          Total
        </button>
      </div>

      {loadingGradebook ? (
        <p>Loading gradebook…</p>
      ) : !gradebook ? null : gradebook.rows.length === 0 ? (
        <p className="GradebookEmpty">No students enrolled yet.</p>
      ) : (
        <div className="GradebookWrapper">
          <table className="GradebookTable">
            <thead>
              <tr>
                <th className="GradebookStudentHeader">Student</th>
                {gradebook.assignments.map((a) => (
                  <th key={a.id} className="GradebookAssignmentHeader">
                    <Link to={`/assignment/${a.id}/details`}>{a.name}</Link>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {gradebook.rows.map((row) => (
                <tr key={row.student.id}>
                  <td className="GradebookStudentCell">{row.student.name}</td>
                  {gradebook.assignments.map((a) => {
                    const key = cellKey(row.student.id, a.id);
                    const grade = row.grades[String(a.id)];
                    const feedbackCount = row.feedback_counts[String(a.id)] ?? null;
                    const hasMaxPoints = a.max_points != null && a.max_points > 0;
                    const isEditing = editingKey === key;
                    const isSaving = savingKey === key;
                    return (
                      <td key={a.id} className="GradebookGradeCell">
                        {isEditing ? (
                          <div className="GradebookEditCell">
                            <div className="GradebookEditModeRow">
                              <button
                                type="button"
                                className={`GradebookModeBtn ${editMode === "points" ? "active" : ""}`}
                                onClick={() =>
                                  switchEditMode(
                                    "points",
                                    a.assignment_type,
                                    feedbackCount,
                                    a.max_points
                                  )
                                }
                                disabled={isSaving}
                              >
                                Pts
                              </button>
                              <button
                                type="button"
                                className={`GradebookModeBtn ${editMode === "percent" ? "active" : ""}`}
                                onClick={() =>
                                  switchEditMode(
                                    "percent",
                                    a.assignment_type,
                                    feedbackCount,
                                    a.max_points
                                  )
                                }
                                disabled={isSaving || !hasMaxPoints}
                                title={hasMaxPoints ? "Edit as percent" : "No total points available"}
                              >
                                %
                              </button>
                            </div>
                            <input
                              type="number"
                              min="0"
                              step={editMode === "percent" ? "0.1" : "0.5"}
                              className="GradebookInput"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onKeyDown={(e) => handleKeyDown(e, row.student.id, a.id)}
                              disabled={isSaving}
                              autoFocus
                            />
                            <button
                              className="GradebookSaveBtn"
                              onClick={() => void saveEdit(row.student.id, a.id)}
                              disabled={isSaving}
                              type="button"
                              aria-label="Save grade"
                              title="Save grade"
                            >
                              {isSaving ? (
                                "…"
                              ) : (
                                <span className="GradebookIcon GradebookSaveIcon" aria-hidden="true" />
                              )}
                            </button>
                            <button
                              className="GradebookCancelBtn"
                              onClick={cancelEdit}
                              disabled={isSaving}
                              type="button"
                              aria-label="Cancel edit"
                              title="Cancel edit"
                            >
                              <span className="GradebookIcon GradebookCancelIcon" aria-hidden="true" />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            className="GradebookGradeBtn"
                            onClick={() =>
                              startEdit(
                                row.student.id,
                                a.id,
                                grade ?? null,
                                a.assignment_type,
                                feedbackCount,
                                a.max_points
                              )
                            }
                            title="Click to edit grade"
                          >
                            {grade == null ? (
                              <span className="GradebookNoGrade">—</span>
                            ) : (
                              getDisplayGrade(
                                grade,
                                a.assignment_type,
                                a.max_points,
                                feedbackCount,
                                displayMode
                              )
                            )}
                          </button>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
