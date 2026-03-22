import Button from './Button'

export type RubricCriterionDraft = {
  id?: number
  question: string
  hasScore: boolean
  scoreMax: number
}

interface RubricCriteriaEditorProps {
  criteria: RubricCriterionDraft[]
  onChange: (next: RubricCriterionDraft[]) => void
  disabled?: boolean
  minCriteria?: number
}

export default function RubricCriteriaEditor({
  criteria,
  onChange,
  disabled = false,
  minCriteria = 1,
}: RubricCriteriaEditorProps) {
  const MAX_SCORE = 10
  const MIN_SCORE = 1

  return (
    <>
      {criteria.map((item, index) => (
        <div key={item.id ?? `new-${index}`} className="criteria-input-section">
          <input
            type="text"
            value={item.question}
            onChange={(e) => {
              const updated = [...criteria]
              updated[index] = { ...updated[index], question: e.target.value, hasScore: true }
              onChange(updated)
            }}
            placeholder="Enter question"
            disabled={disabled}
          />
          <input
            type="number"
            min="1"
            max={MAX_SCORE}
            value={item.scoreMax}
            onChange={(e) => {
              const updated = [...criteria]
              updated[index] = {
                ...updated[index],
                hasScore: true,
                scoreMax: Math.min(MAX_SCORE, Math.max(MIN_SCORE, Number(e.target.value))),
              }
              onChange(updated)
            }}
            placeholder="Enter score max"
            disabled={disabled}
          />
          <Button
            type="secondary"
            onClick={() => onChange(criteria.filter((_, i) => i !== index))}
            disabled={disabled || criteria.length <= minCriteria}
          >
            Remove Criterion
          </Button>
        </div>
      ))}

      <div className="button-group">
        <Button
          type="secondary"
          onClick={() => onChange([...criteria, { question: '', scoreMax: 5, hasScore: true }])}
          disabled={disabled}
        >
          Add New Criterion
        </Button>
      </div>
    </>
  )
}
