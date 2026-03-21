import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import "./Assignment.css";
import BackArrow from "../components/BackArrow";
import RubricDisplay from "../components/RubricDisplay";
import TabNavigation from "../components/TabNavigation";
import HeaderTitle from "../components/HeaderTitle";
import { hasRole } from "../util/login";
import Button from "../components/Button";
import type { RubricCriterionDraft } from "../components/RubricCriteriaEditor";
import RubricEditorPanel from "../components/RubricEditorPanel";
import "../components/RubricCreator.css";
import { hasEmptyRubricQuestion, normalizeRubricDraftForEdit } from "../util/rubric";

import { 
  getAssignmentDetails,
  createCriteria,
  createRubric,
  deleteCriteriaDescription,
  getRubricCriteria,
  getRubricForAssignment,
  peekAssignmentDetails,
  updateCriteriaDescription,
} from "../util/api";

export default function Assignment() {
  const { id } = useParams();
  const [assignmentName, setAssignmentName] = useState<string | null>(null);
  const [assignmentType, setAssignmentType] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const MAX_CRITERION_POINTS = 10;

  const [editMode, setEditMode] = useState(false);
  const [criteria, setCriteria] = useState<Array<{ id: number; rubricID: number; question: string; scoreMax: number; hasScore: boolean }>>([]);
  const [rubricId, setRubricId] = useState<number | null>(null);
  const [draftCriteria, setDraftCriteria] = useState<RubricCriterionDraft[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const isTeacherOrAdmin = hasRole("teacher", "admin");

  useEffect(() => {
      (async () => {
        try {
          if (id) {
            const cached = peekAssignmentDetails(Number(id))
            if (cached && typeof cached === "object") {
              const record = cached as Record<string, unknown>
              setAssignmentName(typeof record.name === "string" ? record.name : null)
              setAssignmentType(typeof record.assignment_type === "string" ? record.assignment_type : null)
            }

            const details = await getAssignmentDetails(Number(id));
            setAssignmentName(details?.name ?? null);
            setAssignmentType(details?.assignment_type ?? null);

            if (details?.assignment_type === "standard") {
              navigate(`/assignment/${id}/details`, { replace: true });
              return;
            }

            // Students shouldn't have a standalone Rubric tab/page.
            // They fill the rubric while submitting each assigned peer review.
            if (!isTeacherOrAdmin) {
              navigate(`/assignment/${id}/details`, { replace: true });
              return;
            }

            const critResp = await getRubricCriteria(Number(id));
            let derivedRubricId: number | null = null;
            if (Array.isArray(critResp)) {
              setCriteria(critResp);
              if (critResp.length > 0 && typeof critResp[0]?.rubricID === "number") {
                derivedRubricId = critResp[0].rubricID;
              }
            } else {
              setCriteria([]);
            }

            // If criteria already exist, they include rubricID, so we can skip the extra fetch.
            if (typeof derivedRubricId === "number") {
              setRubricId(derivedRubricId);
            } else {
              const rubricResp = await getRubricForAssignment(Number(id));
              const rid = rubricResp?.rubric?.id;
              setRubricId(typeof rid === "number" ? rid : null);
            }
          }
        } catch (error) {
          console.error('Error in Assignment page:', error);
          setError("Failed to load rubric.");
        } finally {
          setLoading(false);
        }
      })();
  }, [id, navigate, isTeacherOrAdmin]);

  const canEditRubric = hasRole("teacher", "admin") && (assignmentType === "peer_eval_group" || assignmentType === "peer_eval_individual");

  const startEdit = () => {
    setError(null);
    setDraftCriteria(
      (criteria.length > 0
        ? criteria
        : [{ id: undefined, question: "", hasScore: true, scoreMax: 5 }]
      ).map((c) => ({
        id: c.id,
        question: c.question,
        hasScore: true,
        scoreMax: c.scoreMax,
      }))
    );
    setEditMode(true);
  };

  const cancelEdit = () => {
    setError(null);
    setDraftCriteria(null);
    setEditMode(false);
  };

  const saveChanges = async () => {
    if (!id) return;
    if (!draftCriteria) return;

    const normalized = normalizeRubricDraftForEdit(draftCriteria, MAX_CRITERION_POINTS);

    if (hasEmptyRubricQuestion(normalized)) {
      setError("Rubric must have at least one criterion with a question.");
      return;
    }

    let effectiveRubricId = rubricId;

    try {
      setSaving(true);
      setError(null);

      if (!effectiveRubricId) {
        const created = await createRubric(Number(id), Number(id), true);
        effectiveRubricId = created.id;
        setRubricId(created.id);
      }

      const originalById = new Map(criteria.map((c) => [c.id, c] as const));
      const originalIds = new Set(criteria.map((c) => c.id));
      const nextExistingIds = new Set(normalized.filter((c) => typeof c.id === "number").map((c) => c.id as number));

      const deletions = Array.from(originalIds).filter((cid) => !nextExistingIds.has(cid));
      const creations = normalized.filter((c) => typeof c.id !== "number");
      const updates = normalized
        .filter((c) => typeof c.id === "number")
        .map((c) => {
          const prev = originalById.get(c.id as number);
          if (!prev) return null;
          const nextScoreMax = Math.min(MAX_CRITERION_POINTS, Math.max(0, c.scoreMax || 0));
          const changed =
            prev.question !== c.question ||
            prev.scoreMax !== nextScoreMax ||
            prev.hasScore !== true;
          if (!changed) return null;
          return {
            id: c.id as number,
            payload: { question: c.question, hasScore: true, scoreMax: nextScoreMax },
          };
        })
        .filter((x): x is { id: number; payload: { question: string; scoreMax: number; hasScore: boolean } } => Boolean(x));

      await Promise.all(deletions.map((cid) => deleteCriteriaDescription(cid)));
      await Promise.all(updates.map((u) => updateCriteriaDescription(u.id, u.payload)));
      await Promise.all(
        creations.map((c) => createCriteria(effectiveRubricId as number, c.question, c.scoreMax, true, true))
      );

      const critResp = await getRubricCriteria(Number(id));
      setCriteria(Array.isArray(critResp) ? critResp : []);
      setRefreshKey((k) => k + 1);
      cancelEdit();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save rubric changes.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    const cachedType = (() => {
      if (!id) return null
      const cached = peekAssignmentDetails(Number(id))
      if (!cached || typeof cached !== "object") return null
      const record = cached as Record<string, unknown>
      return typeof record.assignment_type === "string" ? record.assignment_type : null
    })()
    const cachedIsPeerEval = cachedType === "peer_eval_group" || cachedType === "peer_eval_individual"
    const cachedIsIndividualPeerEval = cachedType === "peer_eval_individual"
    const cachedSubmissionsLabel = cachedType === "standard" ? "Student Submissions" : "Group Submissions"

    const loadingTabs = [] as { label: string; path: string }[];
    if (isTeacherOrAdmin) {
      if (cachedIsPeerEval) {
        loadingTabs.push({ label: "Rubric", path: `/assignment/${id}` });
      }
      loadingTabs.push({ label: "Details", path: `/assignment/${id}/details` });
      if (!cachedIsIndividualPeerEval) {
        loadingTabs.push({ label: cachedSubmissionsLabel, path: `/assignment/${id}/submissions` });
      }
      if (cachedIsPeerEval) {
        loadingTabs.push({ label: "Peer Reviews", path: `/assignment/${id}/teacher-reviews` });
      }
    } else {
      loadingTabs.push({ label: "Details", path: `/assignment/${id}/details` });
      if (cachedIsPeerEval) {
        loadingTabs.push({ label: "Peer Review", path: `/assignment/${id}/reviews` });
        loadingTabs.push({ label: "My Feedback", path: `/assignment/${id}/feedback` });
      }
    }

    return (
      <div className="Page">
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

  const isPeerEval = assignmentType === "peer_eval_group" || assignmentType === "peer_eval_individual";
  const isIndividualPeerEval = assignmentType === "peer_eval_individual";
  const submissionsLabel = assignmentType === "standard" ? "Student Submissions" : "Group Submissions";
  const tabs = [] as { label: string; path: string }[];

  if (isTeacherOrAdmin && isPeerEval) {
    tabs.push({ label: "Rubric", path: `/assignment/${id}` });
  }

  tabs.push({ label: "Details", path: `/assignment/${id}/details` });

  if (isTeacherOrAdmin) {
    if (!isIndividualPeerEval) {
      tabs.push({ label: submissionsLabel, path: `/assignment/${id}/submissions` });
    }
    if (isPeerEval) {
      tabs.push({ label: "Peer Reviews", path: `/assignment/${id}/teacher-reviews` });
    }
  } else {
    if (isPeerEval) {
      tabs.push({ label: "Peer Review", path: `/assignment/${id}/reviews` });
      tabs.push({ label: "My Feedback", path: `/assignment/${id}/feedback` });
    }
  }

  return (
    <div className="Page">
      <BackArrow />
      <div className="AssignmentHeader">
        <h2>
          <HeaderTitle title={assignmentName} loading={false} fallback="Assignment" />
        </h2>
      </div>

      <TabNavigation tabs={tabs} />

      {error ? <div className="error-message">{error}</div> : null}

      <div className='assignmentRubricDisplay'>
        <RubricDisplay
          key={refreshKey}
          rubricId={Number(id)}
          criteriaOverride={criteria}
          grades={[]}
          readOnly
          headerActions={
            canEditRubric ?
              (editMode ? (
                <Button className="outline-success" onClick={cancelEdit} disabled={saving}>
                  Cancel
                </Button>
              ) : (
                <Button className="outline-success" onClick={startEdit} disabled={saving}>
                  Edit
                </Button>
              ))
            : null
          }
        />
      </div>

      {canEditRubric && editMode ? (
        draftCriteria ? (
          <RubricEditorPanel
            header={<h3>Edit Rubric</h3>}
            criteria={draftCriteria}
            onChange={setDraftCriteria}
            disabled={saving}
            actions={
              <>
                <Button onClick={saveChanges} disabled={saving || !draftCriteria}>
                  Save
                </Button>
                <Button type="secondary" onClick={cancelEdit} disabled={saving}>
                  Cancel
                </Button>
              </>
            }
          />
        ) : null
      ) : null}
    </div>
  );
}

