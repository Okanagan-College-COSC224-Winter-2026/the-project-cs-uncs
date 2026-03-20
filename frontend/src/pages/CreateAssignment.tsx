import { useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import BackArrow from '../components/BackArrow'
import Button from '../components/Button'
import StatusMessage from '../components/StatusMessage'
import Textbox from '../components/Textbox'
import { createAssignment } from '../util/api'
import './CreateAssignment.css'

export default function CreateAssignment() {
  const { id } = useParams()
  const navigate = useNavigate()

  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [attachedFile, setAttachedFile] = useState<File | null>(null)
  const [statusMessage, setStatusMessage] = useState('')
  const [statusType, setStatusType] = useState<'error' | 'success'>('error')

  const todayMinDate = (() => {
    const now = new Date()
    const yyyy = String(now.getFullYear())
    const mm = String(now.getMonth() + 1).padStart(2, '0')
    const dd = String(now.getDate()).padStart(2, '0')
    return `${yyyy}-${mm}-${dd}`
  })()

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

    try {
      setStatusMessage('')

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
    <div className="CreateAssignment">
      <BackArrow />
      <h1>Create Assignment</h1>

      <StatusMessage message={statusMessage} type={statusType} />

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
