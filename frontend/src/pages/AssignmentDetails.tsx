import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import TabNavigation from "../components/TabNavigation";
import Button from "../components/Button";
import { isAdmin, isStudent, isTeacher } from "../util/login";
import {
  getAssignmentAttachmentUrl,
  getAssignmentDetails,
  getMySubmission,
  getSubmissionDownloadUrl,
  listSubmissions,
  updateAssignmentDetails,
  uploadMySubmission,
} from "../util/api";
import "./Assignment.css";
import "./AssignmentDetails.css";

interface AssignmentDetailsData {
  id: number;
  name: string;
  description?: string | null;
  attachment_storage_name?: string | null;
  attachment_original_name?: string | null;
}

interface MySubmissionData {
  id: number;
  file_name?: string | null;
}

interface SubmissionListItem {
  id: number;
  file_name?: string | null;
  student?: {
    id: number;
    name?: string | null;
    email?: string | null;
  };
}

export default function AssignmentDetails() {
  const { id } = useParams<{ id: string }>();
  const [assignment, setAssignment] = useState<AssignmentDetailsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [isEditing, setIsEditing] = useState(false);

  const [editDescription, setEditDescription] = useState("");
  const [newFile, setNewFile] = useState<File | null>(null);
  const [removeAttachment, setRemoveAttachment] = useState(false);
  const [saving, setSaving] = useState(false);

  const [submissionFile, setSubmissionFile] = useState<File | null>(null);
  const [uploadingSubmission, setUploadingSubmission] = useState(false);
  const [mySubmission, setMySubmission] = useState<MySubmissionData | null>(null);
  const [submissionList, setSubmissionList] = useState<SubmissionListItem[]>([]);
  const [submissionForbidden, setSubmissionForbidden] = useState(false);
  const [submissionForbiddenMessage, setSubmissionForbiddenMessage] = useState<string | null>(null);

  const canEdit = isTeacher() || isAdmin();

  useEffect(() => {
    const fetchDetails = async () => {
      if (!id) return;

      try {
        setLoading(true);
        setError(null);
        setSuccessMessage(null);
        const details = await getAssignmentDetails(Number(id));
        setAssignment(details);
        setEditDescription(details?.description ?? "");
        setNewFile(null);
        setRemoveAttachment(false);
        setIsEditing(false);

        setSubmissionFile(null);
        setMySubmission(null);
        setSubmissionList([]);
        setSubmissionForbidden(false);
        setSubmissionForbiddenMessage(null);

        if (isStudent()) {
          const resp = await getMySubmission(Number(id));
          if (resp?.forbidden) {
            setSubmissionForbidden(true);
            setSubmissionForbiddenMessage(resp?.msg ?? "You are not allowed to submit for this assignment.");
            setMySubmission(null);
          } else {
            setMySubmission(resp?.submission ?? null);
          }
        } else if (isTeacher() || isAdmin()) {
          const resp = await listSubmissions(Number(id));
          if (resp?.forbidden) {
            setSubmissionForbidden(true);
            setSubmissionForbiddenMessage(resp?.msg ?? "You are not allowed to view submissions for this assignment.");
            setSubmissionList([]);
          } else {
            setSubmissionList(resp?.submissions ?? []);
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

  const handleSave = async () => {
    if (!id) return;

    try {
      setSaving(true);
      setError(null);
      setSuccessMessage(null);

      const formData = new FormData();
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

  const tabs = [
    { label: "Home", path: `/assignment/${id}` },
    { label: "Details", path: `/assignment/${id}/details` },
    { label: "Group", path: `/assignment/${id}/group` },
  ];

  if (isTeacher()) {
    tabs.push({ label: "Peer Reviews", path: `/assignment/${id}/teacher-reviews` });
  } else {
    tabs.push({ label: "Peer Review", path: `/assignment/${id}/reviews` });
    tabs.push({ label: "My Feedback", path: `/assignment/${id}/feedback` });
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
      if (resp?.forbidden) {
        setSubmissionForbidden(true);
        setSubmissionForbiddenMessage(resp?.msg ?? "You are not allowed to submit for this assignment.");
        setMySubmission(null);
      } else {
        setMySubmission(resp?.submission ?? null);
      }
    } catch (err) {
      console.error("Error uploading submission:", err);
      setError((err as Error).message || "Failed to upload submission.");
    } finally {
      setUploadingSubmission(false);
    }
  };

  return (
    <div className="assignment-details-container">
      <div className="AssignmentHeader">
        <h2>{assignment?.name ?? `Assignment ${id}`}</h2>
      </div>

      <TabNavigation tabs={tabs} />

      {loading ? (
        <p>Loading assignment details...</p>
      ) : error ? (
        <div className="error-message">{error}</div>
      ) : (
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

          <h3>Attachment</h3>
          {hasAttachment && id ? (
            <a href={getAssignmentAttachmentUrl(Number(id))} target="_blank" rel="noreferrer">
              Download{assignment?.attachment_original_name ? `: ${assignment.attachment_original_name}` : " attachment"}
            </a>
          ) : (
            <p>No attachment.</p>
          )}

          {isStudent() ? (
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
                    Upload submission (uploading again will replace your previous submission)
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

          {isTeacher() || isAdmin() ? (
            <>
              <h3>Student Submissions</h3>
              {submissionList.length ? (
                <ul>
                  {submissionList.map((sub) => (
                    <li key={sub.id}>
                      {(sub.student?.name || sub.student?.email || `Student ${sub.student?.id ?? ""}`).trim()} —{" "}
                      {sub.file_name || "(file)"} —{" "}
                      <a href={getSubmissionDownloadUrl(sub.id)} target="_blank" rel="noreferrer">
                        Download
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>No submissions yet.</p>
              )}
            </>
          ) : null}

          {canEdit ? (
            <>
              {isEditing ? (
                <>
                  <h3>Edit</h3>
                  <label className="assignment-details-label">
                    Description
                    <textarea
                      className="assignment-details-textarea"
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      rows={6}
                    />
                  </label>

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

                  <div className="assignment-details-actions">
                    <Button onClick={handleSave} disabled={saving}>
                      {saving ? "Saving..." : "Save changes"}
                    </Button>
                    <Button
                      type="secondary"
                      onClick={() => {
                        setIsEditing(false);
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
        </div>
      )}
    </div>
  );
}
