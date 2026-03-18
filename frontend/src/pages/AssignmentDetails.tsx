import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import TabNavigation from "../components/TabNavigation";
import Button from "../components/Button";
import { isAdmin, isTeacher } from "../util/login";
import { getAssignmentAttachmentUrl, getAssignmentDetails, updateAssignmentDetails } from "../util/api";
import "./Assignment.css";
import "./AssignmentDetails.css";

interface AssignmentDetailsData {
  id: number;
  name: string;
  description?: string | null;
  attachment_storage_name?: string | null;
  attachment_original_name?: string | null;
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
