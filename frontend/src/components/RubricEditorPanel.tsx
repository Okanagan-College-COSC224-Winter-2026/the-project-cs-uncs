import type React from "react";
import RubricCriteriaEditor, { type RubricCriterionDraft } from "./RubricCriteriaEditor";

type Props = {
  header: React.ReactNode;
  criteria: RubricCriterionDraft[];
  onChange: (next: RubricCriterionDraft[]) => void;
  disabled?: boolean;
  actions?: React.ReactNode;
};

export default function RubricEditorPanel({ header, criteria, onChange, disabled, actions }: Props) {
  return (
    <div className="RubricCreator">
      {header}
      <RubricCriteriaEditor criteria={criteria} onChange={onChange} disabled={disabled} />
      {actions ? <div className="button-group">{actions}</div> : null}
    </div>
  );
}
