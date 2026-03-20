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
  return (
    <>
      {criteria.map((item, index) => (
        <div key={item.id ?? `new-${index}`} className="criteria-input-section">
          <input
            type="text"
            value={item.question}
            onChange={(e) => {
              const updated = [...criteria]
              updated[index] = { ...updated[index], question: e.target.value }
              onChange(updated)
            }}
            placeholder="Enter question"
            disabled={disabled}
          />
          <label>
            Has score:
            <input
              type="checkbox"
              checked={item.hasScore}
              onChange={(e) => {
                const updated = [...criteria]
                const nextHasScore = e.target.checked
                updated[index] = {
                  ...updated[index],
                  hasScore: nextHasScore,
                  scoreMax: nextHasScore ? Math.max(0, updated[index].scoreMax || 0) : 0,
                }
                onChange(updated)
              }}
              disabled={disabled}
            />
          </label>
          {item.hasScore ? (
            <input
              type="number"
              min="0"
              value={item.scoreMax}
              onChange={(e) => {
                const updated = [...criteria]
                updated[index] = { ...updated[index], scoreMax: Math.max(0, Number(e.target.value)) }
                onChange(updated)
              }}
              placeholder="Enter score max"
              disabled={disabled}
            />
          ) : null}
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
