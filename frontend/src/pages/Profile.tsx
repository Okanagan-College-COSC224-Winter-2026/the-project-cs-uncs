import { useEffect, useRef, useState } from 'react'
import StatusMessage from '../components/StatusMessage'
import './Profile.css'
import { getCurrentUser, getCurrentUserPhotoUrl, updateCurrentUser, uploadCurrentUserPhoto } from '../util/api_client/users'

export default function Profile() {
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const [loading, setLoading] = useState(true)
  const [name, setName] = useState<string>('')
  const [email, setEmail] = useState<string>('')

  const [isEditingName, setIsEditingName] = useState(false)
  const [isEditingEmail, setIsEditingEmail] = useState(false)
  const [draftName, setDraftName] = useState('')
  const [draftEmail, setDraftEmail] = useState('')

  const [savingName, setSavingName] = useState(false)
  const [savingEmail, setSavingEmail] = useState(false)

  const [photoVersion, setPhotoVersion] = useState<number>(Date.now())
  const [photoError, setPhotoError] = useState(false)

  const [statusMessage, setStatusMessage] = useState('')
  const [statusType, setStatusType] = useState<'error' | 'success'>('error')

  useEffect(() => {
    ;(async () => {
      try {
        const user = await getCurrentUser()
        setName(String(user?.name || ''))
        setEmail(String(user?.email || ''))
      } catch (e) {
        console.error('Failed to load profile:', e)
        setStatusType('error')
        setStatusMessage('Failed to load profile')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const setLocalUserFields = (next: { name?: string; email?: string }) => {
    const raw = localStorage.getItem('user')
    if (!raw) return
    try {
      const parsed = JSON.parse(raw)
      localStorage.setItem('user', JSON.stringify({ ...parsed, ...next }))
    } catch {
      // Ignore corrupted local storage; UI will still reflect state.
    }
  }

  const isValidEmail = (value: string) => {
    const trimmed = value.trim()
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)
  }

  const onSaveName = async () => {
    const next = draftName.trim()
    if (!next) {
      setStatusType('error')
      setStatusMessage('Name is required.')
      return
    }

    setSavingName(true)
    try {
      setStatusMessage('')
      const updated = await updateCurrentUser({ name: next })
      const updatedName = String(updated?.name || next)
      const updatedEmail = String(updated?.email || email)
      setName(updatedName)
      setEmail(updatedEmail)
      setLocalUserFields({ name: updatedName, email: updatedEmail })
      setIsEditingName(false)
      setStatusType('success')
      setStatusMessage('Name updated')
    } catch (e) {
      console.error('Failed to update name:', e)
      setStatusType('error')
      setStatusMessage(e instanceof Error ? e.message : 'Failed to update name')
    } finally {
      setSavingName(false)
    }
  }

  const onSaveEmail = async () => {
    const next = draftEmail.trim()
    if (!next) {
      setStatusType('error')
      setStatusMessage('Email is required.')
      return
    }
    if (!isValidEmail(next)) {
      setStatusType('error')
      setStatusMessage('Please enter a valid email address (example: name@example.com).')
      return
    }

    setSavingEmail(true)
    try {
      setStatusMessage('')
      const updated = await updateCurrentUser({ email: next })
      const updatedName = String(updated?.name || name)
      const updatedEmail = String(updated?.email || next)
      setName(updatedName)
      setEmail(updatedEmail)
      setLocalUserFields({ name: updatedName, email: updatedEmail })
      setIsEditingEmail(false)
      setStatusType('success')
      setStatusMessage('Email updated')
    } catch (e) {
      console.error('Failed to update email:', e)
      setStatusType('error')
      setStatusMessage(e instanceof Error ? e.message : 'Failed to update email')
    } finally {
      setSavingEmail(false)
    }
  }

  const onPickPhoto = async (file: File | null) => {
    if (!file) return
    try {
      setStatusMessage('')
      await uploadCurrentUserPhoto(file)
      setStatusType('success')
      setStatusMessage('Photo updated')
      setPhotoError(false)
      setPhotoVersion(Date.now())
    } catch (e) {
      console.error('Failed to upload photo:', e)
      setStatusType('error')
      setStatusMessage(e instanceof Error ? e.message : 'Failed to upload photo')
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const photoUrl = getCurrentUserPhotoUrl(photoVersion)

  return (
    <div className="Profile Page">
      <StatusMessage message={statusMessage} type={statusType} />

      <div className="profile-hero">
        <div className="profile-imageColumn">
          <div className="profile-image">
            {!photoError ? (
              <img
                src={photoUrl}
                alt="profile"
                onError={() => setPhotoError(true)}
              />
            ) : (
              <div className="ProfilePhotoFallback" aria-label="No profile photo" />
            )}
          </div>

          <div className="ProfilePhotoActions">
            <input
              ref={fileInputRef}
              className="ProfilePhotoInput"
              type="file"
              accept="image/*"
              onChange={(e) => onPickPhoto(e.target.files?.[0] || null)}
            />
            <button
              type="button"
              className="ProfilePhotoButton"
              onClick={() => fileInputRef.current?.click()}
            >
              {photoError ? 'Add photo' : 'Change photo'}
            </button>
          </div>
        </div>

        <div className="profile-info">
          <h1>Full Name</h1>
          <div className="ProfileFieldRow">
            {!isEditingName ? (
              <>
                <span>{loading ? 'Loading…' : name || '—'}</span>
                <button
                  type="button"
                  className="ProfileEditButton"
                  onClick={() => {
                    setStatusMessage('')
                    setDraftName(name)
                    setIsEditingName(true)
                  }}
                  disabled={loading}
                >
                  Edit
                </button>
              </>
            ) : (
              <>
                <input
                  className="ProfileEditInput"
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  disabled={savingName}
                />
                <button
                  type="button"
                  className="ProfileSaveButton"
                  onClick={onSaveName}
                  disabled={savingName}
                >
                  Save
                </button>
                <button
                  type="button"
                  className="ProfileCancelButton"
                  onClick={() => {
                    setIsEditingName(false)
                    setDraftName('')
                  }}
                  disabled={savingName}
                >
                  Cancel
                </button>
              </>
            )}
          </div>
          <h1>Email</h1>
          <div className="ProfileFieldRow">
            {!isEditingEmail ? (
              <>
                <span>{loading ? 'Loading…' : email || '—'}</span>
                <button
                  type="button"
                  className="ProfileEditButton"
                  onClick={() => {
                    setStatusMessage('')
                    setDraftEmail(email)
                    setIsEditingEmail(true)
                  }}
                  disabled={loading}
                >
                  Edit
                </button>
              </>
            ) : (
              <>
                <input
                  className="ProfileEditInput"
                  value={draftEmail}
                  onChange={(e) => setDraftEmail(e.target.value)}
                  disabled={savingEmail}
                />
                <button
                  type="button"
                  className="ProfileSaveButton"
                  onClick={onSaveEmail}
                  disabled={savingEmail}
                >
                  Save
                </button>
                <button
                  type="button"
                  className="ProfileCancelButton"
                  onClick={() => {
                    setIsEditingEmail(false)
                    setDraftEmail('')
                  }}
                  disabled={savingEmail}
                >
                  Cancel
                </button>
              </>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}