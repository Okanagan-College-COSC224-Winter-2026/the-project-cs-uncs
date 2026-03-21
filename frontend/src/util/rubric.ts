import type { RubricCriterionDraft } from "../components/RubricCriteriaEditor";

export const hasEmptyRubricQuestion = (criteria: Array<{ question: string }>) => {
  return criteria.length === 0 || criteria.some((c) => !c.question.trim());
};

export const hasInvalidRubricScore = (criteria: Array<{ hasScore: boolean; scoreMax: number }>) => {
  return criteria.some((c) => {
    if (!c.hasScore) return false;
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
    scoreMax: c.hasScore ? Math.min(maxCriterionPoints, Math.max(0, c.scoreMax || 0)) : 0,
  }));
};
