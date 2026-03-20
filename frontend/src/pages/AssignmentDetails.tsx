import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import TabNavigation from "../components/TabNavigation";
import Button from "../components/Button";
import BackArrow from "../components/BackArrow";
import HeaderTitle from "../components/HeaderTitle";
import { isAdmin, isStudent, isTeacher } from "../util/login";
import {
  getAssignmentAttachmentUrl,
  getAssignmentDetails,
  getMySubmission,
  getSubmissionDownloadUrl,
  updateAssignmentDetails,
  uploadMySubmission,
} from "../util/api";
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
}

interface MySubmissionData {
  id: number;
  file_name?: string | null;
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

  const [submissionFile, setSubmissionFile] = useState<File | null>(null);
  const [uploadingSubmission, setUploadingSubmission] = useState(false);
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

        setSubmissionFile(null);
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
    const loadingTabs = [{ label: "Details", path: `/assignment/${id}/details` }] as { label: string; path: string }[];
    if (isTeacher() || isAdmin()) {
      loadingTabs.push({ label: "Group Submissions", path: `/assignment/${id}/group-submissions` });
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

      if (editDueDate && editDueDate < todayMinDate) {
        setError("Due date cannot be in the past.");
        return;
      }

      const formData = new FormData();
      formData.append("name", editTitle);
      formData.append("due_date", editDueDate);
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

  if (showRubricTab) {
    tabs.push({ label: "Rubric", path: `/assignment/${id}` });
  }

  tabs.push({ label: "Details", path: `/assignment/${id}/details` });

  if (isTeacher() || isAdmin()) {
    tabs.push({ label: "Group Submissions", path: `/assignment/${id}/group-submissions` });
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
    if (!submissionFile) {
      setError("Please choose a file to upload.");
      return;
    }

    try {
      setUploadingSubmission(true);
      setError(null);
      setSuccessMessage(null);

      const formData = new FormData();
      formData.append("file", submissionFile);

      await uploadMySubmission(Number(id), formData);
      setSuccessMessage("Submission uploaded.");
      setSubmissionFile(null);

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
    } catch (err) {
      console.error("Error uploading submission:", err);
      setError((err as Error).message || "Failed to upload submission.");
    } finally {
      setUploadingSubmission(false);
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

      {error ? (
        <div className="error-message">{error}</div>
      ) : (
        <div className="TabPageContent">
          <div className="assignment-details-content">
            {successMessage ? <div className="success-message">{successMessage}</div> : null}

          <div className="assignment-details-sectionHeader">
            <h3>Description</h3>
            {canEdit && !isEditing ? (
              <Button className="outline-success" onClick={() => setIsEditing(true)}>
                Edit
              </Button>
            ) : null}
          </div>
          {description ? <p className="assignment-description">{description}</p> : <p>No description provided.</p>}

          {!isPeerEval ? (
            <>
              <h3>Attachment</h3>
              {hasAttachment && id ? (
                <a href={getAssignmentAttachmentUrl(Number(id))} target="_blank" rel="noreferrer">
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
                <p>
                  Current submission: {mySubmission.file_name || "(file)"} —{" "}
                  <a href={getSubmissionDownloadUrl(mySubmission.id)} target="_blank" rel="noreferrer">
                    Download
                  </a>
                </p>
              ) : (
                <p>No submission uploaded yet.</p>
              )}

              {!submissionForbidden ? (
                <>
                  <label className="assignment-details-label">
                    Upload submission (uploading again will replace the current submission)
                    <input
                      className="assignment-details-file"
                      type="file"
                      onChange={(e) => setSubmissionFile(e.target.files?.[0] ?? null)}
                    />
                  </label>

                  <div className="assignment-details-actions">
                    <Button onClick={handleUploadSubmission} disabled={uploadingSubmission}>
                      {uploadingSubmission ? "Uploading..." : "Upload"}
                    </Button>
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

                  <label className="assignment-details-label">
                    Description
                    <textarea
                      className="assignment-details-textarea"
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      rows={6}
                    />
                  </label>

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

            <h3>Due Date</h3>
            <p>{formatDueDate(assignment?.due_date ?? null)}</p>
          </div>
        </div>
      )}
    </div>
  );
}
