import type { RubricCriterionDraft } from "../components/RubricCriteriaEditor";

export const hasEmptyRubricQuestion = (criteria: Array<{ question: string }>) => {
  return criteria.filter((c) => c.question.trim()).length === 0;
};

export const hasInvalidRubricScore = (criteria: Array<{ question: string; scoreMax: number }>) => {
  const filled = criteria.filter((c) => c.question.trim());
  return filled.some((c) => {
    if (!Number.isFinite(c.scoreMax)) return true;
    if (!Number.isInteger(c.scoreMax)) return true;
    return c.scoreMax < 1 || c.scoreMax > 10;
  });
};

// Used only where the existing behavior already clamps values (e.g. edit rubric page).
export const normalizeRubricDraftForEdit = (criteria: RubricCriterionDraft[], maxCriterionPoints: number) => {
  return criteria
    .map((c) => ({
      ...c,
      question: c.question.trim(),
      scoreMax: Math.min(maxCriterionPoints, Math.max(1, c.scoreMax || 0)),
    }))
    // If a row is left blank, ignore it.
    // For existing criteria (with an id), this means "clearing" becomes a delete on save.
    .filter((c) => Boolean(c.question));
};
