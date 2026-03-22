import type { RubricCriterionDraft } from "../components/RubricCriteriaEditor";

export const hasEmptyRubricQuestion = (criteria: Array<{ question: string }>) => {
  return criteria.length === 0 || criteria.some((c) => !c.question.trim());
};

export const hasInvalidRubricScore = (criteria: Array<{ scoreMax: number }>) => {
  return criteria.some((c) => {
    if (!Number.isFinite(c.scoreMax)) return true;
    if (!Number.isInteger(c.scoreMax)) return true;
    return c.scoreMax < 1 || c.scoreMax > 10;
  });
};

// Used only where the existing behavior already clamps values (e.g. edit rubric page).
export const normalizeRubricDraftForEdit = (criteria: RubricCriterionDraft[], maxCriterionPoints: number) => {
  return criteria.map((c) => ({
    ...c,
    question: c.question.trim(),
    scoreMax: Math.min(maxCriterionPoints, Math.max(1, c.scoreMax || 0)),
  }));
};
