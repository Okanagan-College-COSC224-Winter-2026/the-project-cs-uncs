import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import BackArrow from '../components/BackArrow'
import Button from '../components/Button'
import StatusMessage from '../components/StatusMessage'
import Textbox from '../components/Textbox'
import type { RubricCriterionDraft } from '../components/RubricCriteriaEditor'
import RubricEditorPanel from '../components/RubricEditorPanel'
import { createAssignment, listCourseGroups, type CourseGroup } from '../util/api'
import { hasEmptyRubricQuestion, hasInvalidRubricScore } from '../util/rubric'
import './CreateAssignment.css'
import '../components/RubricCreator.css'

type AssignmentType = 'standard' | 'peer_eval_group' | 'peer_eval_individual'

const defaultRubricFor = (assignmentType: AssignmentType): RubricCriterionDraft[] => {
  if (assignmentType === 'peer_eval_individual') {
    return [
      { question: "Contributed meaningfully to the team's work", scoreMax: 5, hasScore: true },
      { question: 'Communicated clearly and respectfully', scoreMax: 5, hasScore: true },
      { question: 'Was reliable and met commitments', scoreMax: 5, hasScore: true },
      { question: 'Produced high-quality work', scoreMax: 5, hasScore: true },
      { question: 'Helped the team succeed (supportive/collaborative)', scoreMax: 5, hasScore: true },
    ]
  }

  if (assignmentType === 'peer_eval_group') {
    return [
      { question: 'Deliverable was clear and easy to follow', scoreMax: 5, hasScore: true },
      { question: 'Work was complete and met requirements', scoreMax: 5, hasScore: true },
      { question: 'Evidence of strong teamwork/coordination', scoreMax: 5, hasScore: true },
      { question: 'Overall effectiveness/quality', scoreMax: 5, hasScore: true },
      { question: 'Actionable suggestions for improvement', scoreMax: 0, hasScore: false },
    ]
  }

  return []
}

export default function CreateAssignment() {
  const { id } = useParams()
  const navigate = useNavigate()

  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [attachedFile, setAttachedFile] = useState<File | null>(null)
  const [assignmentType, setAssignmentType] = useState<AssignmentType>('standard')

  const [courseGroups, setCourseGroups] = useState<CourseGroup[]>([])
  const [groupsError, setGroupsError] = useState<string>('')
  const [includedGroupIds, setIncludedGroupIds] = useState<number[]>([])

  const [rubricCriteria, setRubricCriteria] = useState<RubricCriterionDraft[]>([])

  const [statusMessage, setStatusMessage] = useState('')
  const [statusType, setStatusType] = useState<'error' | 'success'>('error')

  const todayMinDate = (() => {
    const now = new Date()
    const yyyy = String(now.getFullYear())
    const mm = String(now.getMonth() + 1).padStart(2, '0')
    const dd = String(now.getDate()).padStart(2, '0')
    return `${yyyy}-${mm}-${dd}`
  })()

  const showRubricEditor = assignmentType === 'peer_eval_group' || assignmentType === 'peer_eval_individual'
  const showGroupSelector = assignmentType === 'peer_eval_group'
  const showAttachment = assignmentType === 'standard'

  useEffect(() => {
    if (!id) return
    if (!showGroupSelector) return

    setGroupsError('')
    listCourseGroups(Number(id))
      .then((groups) => setCourseGroups(groups))
      .catch((e) => {
        console.error('Error loading course groups:', e)
        setGroupsError('Failed to load groups')
      })
  }, [id, showGroupSelector])

  // For group peer eval, default to all groups selected.
  useEffect(() => {
    if (!showGroupSelector) return
    if (courseGroups.length === 0) return
    setIncludedGroupIds((prev) => {
      if (prev.length > 0) return prev
      return courseGroups.map((g) => g.id)
    })
  }, [showGroupSelector, courseGroups])

  useEffect(() => {
    if (!showRubricEditor) {
      setRubricCriteria([])
      return
    }
    setRubricCriteria(defaultRubricFor(assignmentType))
  }, [assignmentType, showRubricEditor])

  // If switching away from group peer eval, clear selection.
  useEffect(() => {
    if (!showGroupSelector) {
      setIncludedGroupIds([])
    }
  }, [showGroupSelector])

  useEffect(() => {
    if (!showAttachment) {
      setAttachedFile(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }, [showAttachment])

  const includedGroupIdSet = useMemo(() => new Set(includedGroupIds), [includedGroupIds])

  const attemptCreateAssignment = async () => {
    if (!id) {
      setStatusType('error')
      setStatusMessage('Missing class id')
      return
    }

    if (!title.trim()) {
      setStatusType('error')
      setStatusMessage('Assignment title is required')
      return
    }

    if (dueDate) {
      // Date-only input (YYYY-MM-DD). Lexicographic comparison works for ISO date strings.
      if (dueDate < todayMinDate) {
        setStatusType('error')
        setStatusMessage('Due date cannot be in the past')
        return
      }
    }

    if (showGroupSelector) {
      if (includedGroupIds.length < 2) {
        setStatusType('error')
        setStatusMessage('Select at least two groups')
        return
      }
    }

    if (showRubricEditor) {
      if (hasEmptyRubricQuestion(rubricCriteria)) {
        setStatusType('error')
        setStatusMessage('Rubric must have at least one criterion with a question')
        return
      }
      if (hasInvalidRubricScore(rubricCriteria)) {
        setStatusType('error')
        setStatusMessage('Rubric scores must be 0 or greater')
        return
      }
    }

    try {
      setStatusMessage('')

      if (assignmentType === 'standard') {
        const formData = new FormData()
        formData.append('courseID', id)
        formData.append('name', title)
        formData.append('description', description)
        if (dueDate) {
          // Send as YYYY-MM-DD to avoid timezone shifting on the frontend.
          formData.append('due_date', dueDate)
        }
        if (attachedFile) {
          formData.append('file', attachedFile)
        }

        await createAssignment(formData)
      } else {
        await createAssignment({
          courseID: Number(id),
          name: title,
          description,
          due_date: dueDate || undefined,
          assignment_type: assignmentType,
          included_group_ids: showGroupSelector ? includedGroupIds : undefined,
          rubric_criteria: showRubricEditor
            ? rubricCriteria.map((c) => ({
                question: c.question,
                hasScore: c.hasScore,
                scoreMax: c.hasScore ? c.scoreMax : 0,
              }))
            : undefined,
        })
      }
      navigate(`/classes/${id}/home`)
    } catch (error) {
      console.error('Error creating assignment:', error)
      setStatusType('error')
      setStatusMessage('Error creating assignment.')
    }
  }

  const removeFile = () => {
    setAttachedFile(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <div className="CreateAssignment Page">
      <BackArrow />
      <h1>Create Assignment</h1>

      <StatusMessage message={statusMessage} type={statusType} />

      <h2>Assignment Type</h2>
      <select
        className="Textbox"
        value={assignmentType}
        onChange={(e) => {
          setAssignmentType(e.target.value as AssignmentType)
          if (statusMessage) {
            setStatusMessage('')
          }
        }}
      >
        <option value="standard">Standard</option>
        <option value="peer_eval_group">Group Peer Evaluation</option>
        <option value="peer_eval_individual">Individual Peer Evaluation</option>
      </select>

      <h2>Title</h2>
      <Textbox onInput={setTitle} placeholder="Assignment title" />

      <h2>Description</h2>
      <textarea
        className="Textbox CreateAssignmentDescription"
        value={description}
        placeholder="Optional description"
        onChange={(e) => setDescription(e.target.value)}
        rows={5}
      />

      <h2>Due Date</h2>
      <Textbox
        type="date"
        value={dueDate}
        min={todayMinDate}
        onInput={(v) => {
          setDueDate(v)
          if (statusMessage) {
            setStatusMessage('')
          }
        }}
      />

      {showRubricEditor ? (
        <RubricEditorPanel
          header={<h2>Rubric</h2>}
          criteria={rubricCriteria}
          onChange={setRubricCriteria}
        />
      ) : null}

      {showGroupSelector ? (
        <div>
          <h2>Included Groups</h2>
          {groupsError ? <StatusMessage message={groupsError} type="error" /> : null}
          {courseGroups.length === 0 && !groupsError ? <div>No groups found for this course.</div> : null}

          {courseGroups.map((g) => (
            <label key={g.id} style={{ display: 'block', marginBottom: 8 }}>
              <input
                type="checkbox"
                checked={includedGroupIdSet.has(g.id)}
                onChange={(e) => {
                  const checked = e.target.checked
                  setIncludedGroupIds((prev) => {
                    const set = new Set(prev)
                    if (checked) set.add(g.id)
                    else set.delete(g.id)
                    return Array.from(set)
                  })
                  if (statusMessage) {
                    setStatusMessage('')
                  }
                }}
              />{' '}
              {g.name}
            </label>
          ))}
        </div>
      ) : null}

      {showAttachment ? (
        <>
          <h2>Attachment</h2>
          <input
            ref={fileInputRef}
            className="CreateAssignmentFile"
            type="file"
            onChange={(e) => {
              const f = e.target.files?.[0] || null
              setAttachedFile(f)
            }}
          />

          {attachedFile ? (
            <div className="CreateAssignmentFileRow">
              <div className="CreateAssignmentFileName">{attachedFile.name}</div>
              <Button type="secondary" onClick={removeFile}>
                Remove
              </Button>
            </div>
          ) : null}
        </>
      ) : null}

      <div className="CreateAssignmentActions">
        <Button onClick={attemptCreateAssignment} disabled={!title.trim()}>
          Create
        </Button>
        <Button type="secondary" onClick={() => navigate(`/classes/${id}/home`)}>
          Cancel
        </Button>
      </div>
    </div>
  )
}
