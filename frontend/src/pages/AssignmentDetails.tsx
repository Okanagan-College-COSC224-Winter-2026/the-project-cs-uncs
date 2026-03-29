import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import TabNavigation from "../components/TabNavigation";
import Button from "../components/Button";
import BackArrow from "../components/BackArrow";
import HeaderTitle from "../components/HeaderTitle";
import MarkdownDescription from "../components/MarkdownDescription";
import MarkdownToolbar from "../components/MarkdownToolbar";
import { isAdmin, isStudent, isTeacher } from "../util/login";
import {
  getAssignmentAttachmentUrl,
  getAssignmentDetails,
  deleteMySubmission,
  getMySubmission,
  getSubmissionAttachmentDownloadUrl,
  getSubmissionDownloadUrl,
  peekAssignmentDetails,
  updateAssignmentDetails,
  uploadMySubmission,
} from "../util/api_client/assignments";
import "./Assignment.css";
import "./AssignmentDetails.css";

interface AssignmentDetailsData {
  id: number;
  name: string;
  due_date?: string | null;
  description?: string | null;
  attachment_storage_name?: string | null;
  attachment_original_name?: string | null;
  assignment_type?: string | null;
  student_done?: boolean;
  student_latest_submission_at?: string | null;
  student_reviews_total?: number;
  student_reviews_completed?: number;
}

interface MySubmissionData {
  id: number;
  file_name?: string | null;
  attachments?: Array<{ id: number | null; file_name?: string | null }>;
}

interface MySubmissionResponse {
  submission: MySubmissionData | null;
  forbidden?: boolean;
  msg?: string;
  locked?: boolean;
  submitted_by?: { id: number; name?: string | null } | null;
}

export default function AssignmentDetails() {
  const { id } = useParams<{ id: string }>();
  const [assignment, setAssignment] = useState<AssignmentDetailsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [isEditing, setIsEditing] = useState(false);

  const [editTitle, setEditTitle] = useState("");
  const [editDueDate, setEditDueDate] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [newFile, setNewFile] = useState<File | null>(null);
  const [removeAttachment, setRemoveAttachment] = useState(false);
  const [saving, setSaving] = useState(false);
  const editDescriptionTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  const [submissionFiles, setSubmissionFiles] = useState<File[]>([]);
  const [uploadingSubmission, setUploadingSubmission] = useState(false);
  const [removingSubmission, setRemovingSubmission] = useState(false);
  const [mySubmission, setMySubmission] = useState<MySubmissionData | null>(null);
  const [submissionForbidden, setSubmissionForbidden] = useState(false);
  const [submissionForbiddenMessage, setSubmissionForbiddenMessage] = useState<string | null>(null);

  const canEdit = isTeacher() || isAdmin();

  const todayMinDate = (() => {
    const now = new Date();
    const yyyy = String(now.getFullYear());
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  })();

  const toDateInputValue = (dueDate: string | null | undefined) => {
    if (!dueDate) return "";
    const asString = String(dueDate);
    return asString.length >= 10 ? asString.slice(0, 10) : asString;
  };

  const formatDueDate = (dueDate: string | null | undefined) => {
    const datePart = toDateInputValue(dueDate);
    if (!datePart) return "No due date.";

    const parts = datePart.split("-").map((p) => Number(p));
    if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return datePart;

    const [y, m, d] = parts;
    return new Date(y, m - 1, d).toLocaleDateString();
  };

  const formatDelta = (seconds: number) => {
    const absSeconds = Math.abs(Math.trunc(seconds));

    // Display in minutes granularity (no seconds) to keep it readable.
    // Round to the nearest minute and floor at 1 minute.
    const totalMinutes = Math.max(1, Math.round(absSeconds / 60));
    const days = Math.floor(totalMinutes / (60 * 24));
    const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
    const minutes = totalMinutes % 60;

    const parts: string[] = [];
    if (days) parts.push(`${days} ${days === 1 ? "day" : "days"}`);
    if (hours) parts.push(`${hours} ${hours === 1 ? "hour" : "hours"}`);
    if (minutes || parts.length === 0)
      parts.push(`${minutes} ${minutes === 1 ? "minute" : "minutes"}`);
    return parts.join(", ");
  };

  const formatAssignmentType = (type: string | null) => {
    switch (type) {
      case "standard":
        return "Standard";
      case "peer_eval_group":
        return "Peer evaluation (group)";
      case "peer_eval_individual":
        return "Peer evaluation (individual)";
      default:
        return type || "Unknown";
    }
  };

  const renderStudentTimingMessage = () => {
    if (!isStudent()) return null;

    // For individual peer evals, only show the timing message after all assigned
    // reviews are completed.
    const assignmentType = assignment?.assignment_type ?? null;
    if (assignmentType === "peer_eval_individual") {
      const total = assignment?.student_reviews_total ?? null;
      const completed = assignment?.student_reviews_completed ?? null;
      if (!total || completed == null || completed < total) return null;
    }

    const dueRaw = assignment?.due_date ?? null;
    const latestRaw = assignment?.student_latest_submission_at ?? null;
    if (!dueRaw || !latestRaw) return null;

    const due = new Date(dueRaw);
    const latest = new Date(latestRaw);
    if (!Number.isFinite(due.getTime()) || !Number.isFinite(latest.getTime())) return null;

    const deltaSeconds = Math.round((latest.getTime() - due.getTime()) / 1000);
    if (deltaSeconds === 0) {
      return <p>Submitted exactly at the due date (on time).</p>;
    }

    if (deltaSeconds < 0) {
      return <p>Submitted {formatDelta(deltaSeconds)} early.</p>;
    }

    return <p>Submitted {formatDelta(deltaSeconds)} late.</p>;
  };

  useEffect(() => {
    const fetchDetails = async () => {
      if (!id) return;

      try {
        setLoading(true);
        setError(null);
        setSuccessMessage(null);
        const details = await getAssignmentDetails(Number(id));
        setAssignment(details);
        setEditTitle(details?.name ?? "");
        setEditDueDate(toDateInputValue(details?.due_date ?? null));
        setEditDescription(details?.description ?? "");
        setNewFile(null);
        setRemoveAttachment(false);
        setIsEditing(false);

        setSubmissionFiles([]);
        setMySubmission(null);
        setSubmissionForbidden(false);
        setSubmissionForbiddenMessage(null);

        const assignmentType = details?.assignment_type ?? null;

        if (isStudent() && assignmentType !== "peer_eval_group" && assignmentType !== "peer_eval_individual") {
          const resp = await getMySubmission(Number(id));
          const typed = resp as MySubmissionResponse;

          if (typed?.forbidden) {
            setSubmissionForbidden(true);
            setSubmissionForbiddenMessage(typed?.msg ?? "You are not allowed to submit for this assignment.");
            setMySubmission(null);
          } else if (typed?.locked) {
            setSubmissionForbidden(true);
            setSubmissionForbiddenMessage(typed?.msg ?? "Your group has already submitted.");
            setMySubmission(typed?.submission ?? null);
          } else {
            setMySubmission(typed?.submission ?? null);
          }
        }
      } catch (err) {
        console.error("Error loading assignment details:", err);
        setError("Failed to load assignment details.");
      } finally {
        setLoading(false);
      }
    };

    fetchDetails();
  }, [id]);

  if (loading) {
    const cachedType = (() => {
      if (!id) return null;
      const cached = peekAssignmentDetails(Number(id));
      return cached?.assignment_type ?? null;
    })();
    const cachedIsPeerEval = cachedType === "peer_eval_group" || cachedType === "peer_eval_individual";
    const cachedIsPeerEvalIndividual = cachedType === "peer_eval_individual";
    const cachedSubmissionsLabel = cachedType === "standard" ? "Student Submissions" : "Group Submissions";

    const loadingTabs = [] as { label: string; path: string }[];

    // Teacher/Admin: keep tab set stable while loading to avoid flicker.
    if (isTeacher() || isAdmin()) {
      if (cachedIsPeerEval) {
        loadingTabs.push({ label: "Rubric", path: `/assignment/${id}` });
      }
      loadingTabs.push({ label: "Details", path: `/assignment/${id}/details` });
      if (!cachedIsPeerEvalIndividual) {
        loadingTabs.push({ label: cachedSubmissionsLabel, path: `/assignment/${id}/submissions` });
      }
      if (cachedIsPeerEval) {
        loadingTabs.push({ label: "Peer Reviews", path: `/assignment/${id}/teacher-reviews` });
      }
    } else {
      // Student: keep peer-eval tabs visible if we can infer type from cache.
      loadingTabs.push({ label: "Details", path: `/assignment/${id}/details` });
      if (isStudent() && cachedIsPeerEval) {
        loadingTabs.push({ label: "Peer Review", path: `/assignment/${id}/reviews` });
        loadingTabs.push({ label: "My Feedback", path: `/assignment/${id}/feedback` });
      }
    }

    return (
      <div className="assignment-details-container Page">
        <BackArrow />
        <div className="AssignmentHeader">
          <h2>
            <HeaderTitle title={null} loading={true} fallback="Assignment" />
          </h2>
        </div>
        <TabNavigation tabs={loadingTabs} />
        <div className="TabPageContent">
          <div className="PageStatusText">Loading…</div>
        </div>
      </div>
    );
  }

  const handleSave = async () => {
    if (!id) return;

    try {
      setSaving(true);
      setError(null);
      setSuccessMessage(null);

      if (!editTitle.trim()) {
        setError("Title is required.");
        return;
      }

      const originalDueDate = toDateInputValue(assignment?.due_date ?? null);
      const dueDateChanged = editDueDate !== originalDueDate;

      if (dueDateChanged) {
        if (!editDueDate) {
          setError("Due date is required.");
          return;
        }
        if (editDueDate < todayMinDate) {
          setError("Due date cannot be in the past.");
          return;
        }
      }

      const formData = new FormData();
      formData.append("name", editTitle);
      if (dueDateChanged) {
        formData.append("due_date", editDueDate);
      }
      formData.append("description", editDescription);
      if (newFile) {
        formData.append("file", newFile);
      }
      if (removeAttachment) {
        formData.append("remove_attachment", "true");
      }

      await updateAssignmentDetails(Number(id), formData);
      setSuccessMessage("Assignment details updated.");

      const refreshed = await getAssignmentDetails(Number(id));
      setAssignment(refreshed);
      setEditTitle(refreshed?.name ?? "");
      setEditDueDate(toDateInputValue(refreshed?.due_date ?? null));
      setEditDescription(refreshed?.description ?? "");
      setNewFile(null);
      setRemoveAttachment(false);
      setIsEditing(false);
    } catch (err) {
      console.error("Error updating assignment details:", err);
      setError((err as Error).message || "Failed to update assignment details.");
    } finally {
      setSaving(false);
    }
  };

  const tabs = [] as { label: string; path: string }[];

  const assignmentType = assignment?.assignment_type ?? null;
  const isPeerEval = assignmentType === "peer_eval_group" || assignmentType === "peer_eval_individual";
  const showRubricTab = (assignmentType === "peer_eval_group" || assignmentType === "peer_eval_individual") && (isTeacher() || isAdmin());
  const isPeerEvalIndividual = assignmentType === "peer_eval_individual";
  const submissionsLabel = assignmentType === "standard" ? "Student Submissions" : "Group Submissions";

  if (showRubricTab) {
    tabs.push({ label: "Rubric", path: `/assignment/${id}` });
  }

  tabs.push({ label: "Details", path: `/assignment/${id}/details` });

  if (isTeacher() || isAdmin()) {
    if (!isPeerEvalIndividual) {
      tabs.push({ label: submissionsLabel, path: `/assignment/${id}/submissions` });
    }
  }

  if (isTeacher() || isAdmin()) {
    if (isPeerEval) {
      tabs.push({ label: "Peer Reviews", path: `/assignment/${id}/teacher-reviews` });
    }
  } else {
    if (isPeerEval) {
      tabs.push({ label: "Peer Review", path: `/assignment/${id}/reviews` });
      tabs.push({ label: "My Feedback", path: `/assignment/${id}/feedback` });
    }
  }

  const hasAttachment = !!assignment?.attachment_storage_name;
  const description = (assignment?.description ?? "").trim();

  const handleUploadSubmission = async () => {
    if (!id) return;
    if (submissionForbidden) {
      setError(submissionForbiddenMessage || "You are not allowed to submit for this assignment.");
      return;
    }
    if (!submissionFiles.length) {
      setError("Please choose at least one file to upload.");
      return;
    }

    try {
      setUploadingSubmission(true);
      setError(null);
      setSuccessMessage(null);

      const formData = new FormData();
      submissionFiles.forEach((f) => formData.append("files", f));

      await uploadMySubmission(Number(id), formData);

      // Update local assignment state right away so the due-date timing message
      // (which depends on student_latest_submission_at) shows immediately.
      const nowIso = new Date().toISOString();
      setAssignment((prev) =>
        prev
          ? {
              ...prev,
              student_latest_submission_at: nowIso,
              student_done: true,
            }
          : prev
      );
      setSuccessMessage("Submission uploaded.");
      setSubmissionFiles([]);

      const resp = await getMySubmission(Number(id));
        const typed = resp as MySubmissionResponse;

        if (typed?.forbidden) {
        setSubmissionForbidden(true);
        setSubmissionForbiddenMessage(typed?.msg ?? "You are not allowed to submit for this assignment.");
        setMySubmission(null);
        } else if (typed?.locked) {
          setSubmissionForbidden(true);
          setSubmissionForbiddenMessage(
          typed?.msg ?? "Your group has already submitted."
          );
          setMySubmission(typed?.submission ?? null);
        } else {
          setMySubmission(typed?.submission ?? null);
      }

      // Sync from backend to ensure timestamps/state match server-side values.
      const refreshed = await getAssignmentDetails(Number(id));
      setAssignment(refreshed);
    } catch (err) {
      console.error("Error uploading submission:", err);
      setError((err as Error).message || "Failed to upload submission.");
    } finally {
      setUploadingSubmission(false);
    }
  };

  const handleRemoveSubmission = async () => {
    if (!id) return;
    if (submissionForbidden) {
      setError(submissionForbiddenMessage || "You are not allowed to submit for this assignment.");
      return;
    }

    try {
      setRemovingSubmission(true);
      setError(null);
      setSuccessMessage(null);

      await deleteMySubmission(Number(id));

      // Immediately clear timing state so the early/late message disappears.
      setAssignment((prev) =>
        prev
          ? {
              ...prev,
              student_latest_submission_at: null,
              student_done: false,
            }
          : prev
      );
      setSuccessMessage("Submission removed.");
      setSubmissionFiles([]);

      const resp = await getMySubmission(Number(id));
      const typed = resp as MySubmissionResponse;

      if (typed?.forbidden) {
        setSubmissionForbidden(true);
        setSubmissionForbiddenMessage(typed?.msg ?? "You are not allowed to submit for this assignment.");
        setMySubmission(null);
      } else {
        setMySubmission(typed?.submission ?? null);
      }

      const refreshed = await getAssignmentDetails(Number(id));
      setAssignment(refreshed);
    } catch (err) {
      console.error("Error removing submission:", err);
      setError((err as Error).message || "Failed to remove submission.");
    } finally {
      setRemovingSubmission(false);
    }
  };

  return (
    <div className="assignment-details-container Page">
      <BackArrow />
      <div className="AssignmentHeader">
        <h2>
          <HeaderTitle title={assignment?.name} loading={false} fallback="Assignment" />
        </h2>
      </div>

      <TabNavigation tabs={tabs} />

      <div className="TabPageContent">
        <div className="assignment-details-content">
          {error ? <div className="error-message">{error}</div> : null}
          {successMessage ? <div className="success-message">{successMessage}</div> : null}

            <div className="assignment-details-metaRow">
              <div className="assignment-details-metaHeader">
                <span className="assignment-details-metaLabel">Assignment Type</span>
                {canEdit && !isEditing ? (
                  <Button className="outline-success" onClick={() => setIsEditing(true)}>
                    Edit
                  </Button>
                ) : null}
              </div>
              <span className="assignment-details-metaValue">{formatAssignmentType(assignmentType)}</span>
            </div>

          <div className="assignment-details-sectionHeader">
            <h3>Description</h3>
          </div>
          {description ? (
            <MarkdownDescription className="assignment-description" text={description} />
          ) : (
            <p>No description provided.</p>
          )}

          {!isPeerEval ? (
            <>
              <h3>Attachment</h3>
              {hasAttachment && id ? (
                <a href={getAssignmentAttachmentUrl(Number(id))} target="_blank" rel="noopener noreferrer">
                  Download{assignment?.attachment_original_name ? `: ${assignment.attachment_original_name}` : " attachment"}
                </a>
              ) : (
                <p>No attachment.</p>
              )}
            </>
          ) : null}

          {isStudent() && !isPeerEval ? (
            <>
              <h3>Your Submission</h3>
              {submissionForbidden ? (
                <p>{submissionForbiddenMessage || "You are not allowed to submit for this assignment."}</p>
              ) : null}
              {mySubmission ? (
                <div>
                  <div>
                    Current submission
                    {Array.isArray(mySubmission.attachments) && mySubmission.attachments.length > 0
                      ? ` (${mySubmission.attachments.length} file${mySubmission.attachments.length === 1 ? "" : "s"})`
                      : mySubmission.file_name
                        ? `: ${mySubmission.file_name}`
                        : ""}
                  </div>

                  {Array.isArray(mySubmission.attachments) && mySubmission.attachments.length > 0 ? (
                    <div style={{ marginTop: 6 }}>
                      {mySubmission.attachments.map((a, idx) => {
                        const label = (a.file_name ?? "").trim() || `File ${idx + 1}`;
                        const href = a.id != null ? getSubmissionAttachmentDownloadUrl(a.id) : getSubmissionDownloadUrl(mySubmission.id);
                        return (
                          <div key={a.id ?? idx}>
                            <a href={href} target="_blank" rel="noopener noreferrer">
                              Download: {label}
                            </a>
                          </div>
                        );
                      })}
                    </div>
                  ) : mySubmission.file_name ? (
                    <div style={{ marginTop: 6 }}>
                      <a href={getSubmissionDownloadUrl(mySubmission.id)} target="_blank" rel="noopener noreferrer">
                        Download
                      </a>
                    </div>
                  ) : null}
                </div>
              ) : (
                <p>No submission uploaded yet.</p>
              )}

              {!submissionForbidden ? (
                <>
                  <label className="assignment-details-label">
                    Upload submission
                    <input
                      className="assignment-details-file"
                      type="file"
                      multiple
                      onChange={(e) => setSubmissionFiles(Array.from(e.target.files ?? []))}
                    />
                  </label>

                  <div className="assignment-details-actions">
                    <Button onClick={handleUploadSubmission} disabled={uploadingSubmission || removingSubmission}>
                      {uploadingSubmission ? "Submitting..." : "Submit"}
                    </Button>
                    {mySubmission ? (
                      <Button
                        type="secondary"
                        onClick={handleRemoveSubmission}
                        disabled={uploadingSubmission || removingSubmission}
                      >
                        {removingSubmission ? "Removing..." : "Remove"}
                      </Button>
                    ) : null}
                  </div>
                </>
              ) : null}
            </>
          ) : null}

          {canEdit ? (
            <>
              {isEditing ? (
                <>
                  <h3>Edit</h3>
                  <label className="assignment-details-label">
                    Title
                    <input
                      className="Textbox"
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      placeholder="Assignment title"
                    />
                  </label>

                  <label className="assignment-details-label">
                    Due Date
                    <input
                      className="Textbox"
                      type="date"
                      value={editDueDate}
                      min={todayMinDate}
                      onChange={(e) => setEditDueDate(e.target.value)}
                    />
                  </label>

                  <div className="assignment-details-label">
                    <label htmlFor="assignment-description-edit">Description</label>
                    <div className="MarkdownEditorField">
                      <MarkdownToolbar
                        textareaRef={editDescriptionTextareaRef}
                        value={editDescription}
                      />
                      <textarea
                        id="assignment-description-edit"
                        ref={editDescriptionTextareaRef}
                        className="Textbox assignment-details-textarea"
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        rows={6}
                      />
                    </div>
                    <span className="assignment-markdown-help">
                      Markdown is supported.
                    </span>
                  </div>

                  {!isPeerEval ? (
                    <>
                      <label className="assignment-details-label">
                        Replace attachment
                        <input
                          className="assignment-details-file"
                          type="file"
                          onChange={(e) => setNewFile(e.target.files?.[0] ?? null)}
                        />
                      </label>

                      {hasAttachment ? (
                        <label className="assignment-details-checkbox">
                          <input
                            type="checkbox"
                            checked={removeAttachment}
                            onChange={(e) => setRemoveAttachment(e.target.checked)}
                          />
                          Remove current attachment
                        </label>
                      ) : null}
                    </>
                  ) : null}

                  <div className="assignment-details-actions">
                    <Button onClick={handleSave} disabled={saving}>
                      {saving ? "Saving..." : "Save changes"}
                    </Button>
                    <Button
                      type="secondary"
                      onClick={() => {
                        setIsEditing(false);
                        setEditTitle(assignment?.name ?? "");
                        setEditDueDate(toDateInputValue(assignment?.due_date ?? null));
                        setEditDescription(assignment?.description ?? "");
                        setNewFile(null);
                        setRemoveAttachment(false);
                        setError(null);
                        setSuccessMessage(null);
                      }}
                      disabled={saving}
                    >
                      Cancel
                    </Button>
                  </div>
                </>
              ) : null}
            </>
          ) : null}

          {!isEditing ? (
            <>
              <h3>Due Date</h3>
              <p>{formatDueDate(assignment?.due_date ?? null)}</p>
              {renderStudentTimingMessage()}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
