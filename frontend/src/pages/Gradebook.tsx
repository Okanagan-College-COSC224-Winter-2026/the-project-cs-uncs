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

  const startEdit = (studentId: number, assignmentId: number, current: number | null) => {
    setEditingKey(cellKey(studentId, assignmentId));
    setEditValue(current == null ? "" : String(current));
    setStatusMessage("");
  };

  const cancelEdit = () => {
    setEditingKey(null);
    setEditValue("");
  };

  const saveEdit = async (studentId: number, assignmentId: number) => {
    if (!id) return;
    const key = cellKey(studentId, assignmentId);
    setSavingKey(key);
    const gradeNum = editValue.trim() === "" ? null : Number(editValue);
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
                    const isEditing = editingKey === key;
                    const isSaving = savingKey === key;
                    return (
                      <td key={a.id} className="GradebookGradeCell">
                        {isEditing ? (
                          <div className="GradebookEditCell">
                            <input
                              type="number"
                              min="0"
                              step="0.5"
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
                            >
                              {isSaving ? "…" : "✓"}
                            </button>
                            <button
                              className="GradebookCancelBtn"
                              onClick={cancelEdit}
                              disabled={isSaving}
                              type="button"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            className="GradebookGradeBtn"
                            onClick={() => startEdit(row.student.id, a.id, grade ?? null)}
                            title="Click to edit grade"
                          >
                            {grade == null ? <span className="GradebookNoGrade">—</span> : grade}
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
