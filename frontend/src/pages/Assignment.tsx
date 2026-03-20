import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import "./Assignment.css";
import BackArrow from "../components/BackArrow";
import RubricDisplay from "../components/RubricDisplay";
import TabNavigation from "../components/TabNavigation";
import { hasRole } from "../util/login";
import Button from "../components/Button";

import { 
  getAssignmentDetails,
  createCriteria,
  deleteCriteriaDescription,
  getRubricCriteria,
  getRubricForAssignment,
} from "../util/api";

export default function Assignment() {
  const { id } = useParams();
  const [assignmentName, setAssignmentName] = useState<string | null>(null);
  const [assignmentType, setAssignmentType] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const [editMode, setEditMode] = useState(false);
  const [criteria, setCriteria] = useState<Array<{ id: number; rubricID: number; question: string; scoreMax: number; hasScore: boolean }>>([]);
  const [rubricId, setRubricId] = useState<number | null>(null);
  const [newQuestion, setNewQuestion] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const isTeacherOrAdmin = hasRole("teacher", "admin");

  useEffect(() => {
      (async () => {
        try {
          if (id) {
            const details = await getAssignmentDetails(Number(id));
            setAssignmentName(details?.name ?? null);
            setAssignmentType(details?.assignment_type ?? null);

            if (details?.assignment_type === "standard") {
              navigate(`/assignment/${id}/details`, { replace: true });
              return;
            }

            const rubricResp = await getRubricForAssignment(Number(id));
            const rid = rubricResp?.rubric?.id;
            setRubricId(typeof rid === "number" ? rid : null);

            const critResp = await getRubricCriteria(Number(id));
            if (Array.isArray(critResp)) {
              setCriteria(critResp);
              if (!rid && critResp.length > 0 && typeof critResp[0]?.rubricID === "number") {
                setRubricId(critResp[0].rubricID);
              }
            } else {
              setCriteria([]);
            }
          }
        } catch (error) {
          console.error('Error in Assignment page:', error);
          setError("Failed to load rubric.");
        } finally {
          setLoading(false);
        }
      })();
  }, [id, navigate]);

  const canEditRubric = hasRole("teacher", "admin") && (assignmentType === "peer_eval_group" || assignmentType === "peer_eval_individual");

  const handleRemoveCriterion = async (criteriaId: number) => {
    try {
      setSaving(true);
      setError(null);
      await deleteCriteriaDescription(criteriaId);
      setCriteria((prev) => prev.filter((c) => c.id !== criteriaId));
      setRefreshKey((k) => k + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to remove criterion.");
    } finally {
      setSaving(false);
    }
  };

  const handleAddCriterion = async () => {
    const question = newQuestion.trim();
    if (!question) {
      setError("Criterion text is required.");
      return;
    }
    if (!rubricId) {
      setError("Rubric not found for this assignment.");
      return;
    }

    try {
      setSaving(true);
      setError(null);
      await createCriteria(rubricId, question, 5, true, true);
      setNewQuestion("");
      const critResp = await getRubricCriteria(Number(id));
      setCriteria(Array.isArray(critResp) ? critResp : []);
      setRefreshKey((k) => k + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add criterion.");
    } finally {
      setSaving(false);
    }
  };

  // Build tabs array based on user role
  const tabs = [
    {
      label: "Rubric",
      path: `/assignment/${id}`,
    },
    {
      label: "Details",
      path: `/assignment/${id}/details`,
    },
  ];

  if (isTeacherOrAdmin) {
    tabs.push({
      label: "Group Submissions",
      path: `/assignment/${id}/group-submissions`,
    });
  }

  // Add role-specific review tab
  if (isTeacherOrAdmin) {
    tabs.push({
      label: "Peer Reviews",
      path: `/assignment/${id}/teacher-reviews`,
    });
  } else {
    tabs.push({
      label: "Peer Review",
      path: `/assignment/${id}/reviews`,
    });
    tabs.push({
      label: "My Feedback",
      path: `/assignment/${id}/feedback`,
    });
  }

  return (
    <>
      <BackArrow />
      <div className="AssignmentHeader">
        <h2>{assignmentName ?? "Loading…"}</h2>
      </div>

      {loading ? null : <TabNavigation tabs={tabs} />}

      {error ? <div className="error-message">{error}</div> : null}

      <div className="assignment-details-sectionHeader assignment-rubric-sectionHeader">
        <h3>Rubric</h3>
        {canEditRubric ? (
          <Button className="outline-success" onClick={() => setEditMode((v) => !v)} disabled={saving}>
            {editMode ? "Done" : "Edit"}
          </Button>
        ) : null}
      </div>

      <div className='assignmentRubricDisplay'>
        <RubricDisplay key={refreshKey} rubricId={Number(id)} grades={[]} readOnly />
      </div>

      {canEditRubric && editMode ? (
        <div className='assignmentRubric'>
          <h3>Edit Rubric</h3>

          <div style={{ marginBottom: 12 }}>
            <label style={{ display: "block", marginBottom: 6 }}>
              Add criterion (always out of 5)
            </label>
            <input
              className="Textbox"
              type="text"
              value={newQuestion}
              onChange={(e) => setNewQuestion(e.target.value)}
              placeholder="e.g., Contributed consistently to the group"
              disabled={saving}
            />
            <div style={{ marginTop: 8 }}>
              <Button onClick={handleAddCriterion} disabled={saving}>Add</Button>
            </div>
          </div>

          <h4>Existing criteria</h4>
          {criteria.length === 0 ? (
            <p>No criteria yet.</p>
          ) : (
            <div>
              {criteria.map((c) => (
                <div key={c.id} style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 8 }}>
                  <div style={{ flex: 1 }}>{c.question}</div>
                  <Button type="secondary" onClick={() => handleRemoveCriterion(c.id)} disabled={saving}>
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </>
  );
}

