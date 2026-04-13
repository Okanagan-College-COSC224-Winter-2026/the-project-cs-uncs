import { useEffect, useRef, useState } from 'react'
import StatusMessage from '../components/StatusMessage'
import './Profile.css'
import {
  getCurrentUser,
  getCurrentUserPhotoUrl,
  updateCurrentUser,
  uploadCurrentUserPhoto
} from '../util/api_client/users'

export default function Profile() {
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const [loading, setLoading] = useState(true)
  const [name, setName] = useState<string>('')
  const [preferredName, setPreferredName] = useState<string>('')
  const [preferredPronouns, setPreferredPronouns] = useState<
    'Not specified' | 'he/him' | 'she/her' | 'they/them'
  >('Not specified')
  const [email, setEmail] = useState<string>('')

  const [isEditingName, setIsEditingName] = useState(false)
  const [isEditingPreferredName, setIsEditingPreferredName] = useState(false)
  const [isEditingPreferredPronouns, setIsEditingPreferredPronouns] = useState(false)
  const [isEditingEmail, setIsEditingEmail] = useState(false)
  const [draftName, setDraftName] = useState('')
  const [draftPreferredName, setDraftPreferredName] = useState('')
  const [draftPreferredPronouns, setDraftPreferredPronouns] = useState<
    'Not specified' | 'he/him' | 'she/her' | 'they/them'
  >('Not specified')
  const [draftEmail, setDraftEmail] = useState('')

  const [savingName, setSavingName] = useState(false)
  const [savingPreferredName, setSavingPreferredName] = useState(false)
  const [savingPreferredPronouns, setSavingPreferredPronouns] = useState(false)
  const [savingEmail, setSavingEmail] = useState(false)

  const [photoVersion, setPhotoVersion] = useState<number>(Date.now())
  const [photoError, setPhotoError] = useState(false)

  const [statusMessage, setStatusMessage] = useState('')
  const [statusType, setStatusType] = useState<'error' | 'success'>('error')

  useEffect(() => {
      document.title = 'Profile';

    ;(async () => {
      try {
        const user = (await getCurrentUser()) as Partial<User>
        setName(String(user?.name || ''))
        setPreferredName(String(user?.preferred_name || user?.name || ''))
        setPreferredPronouns(
          (user?.preferred_pronouns as typeof preferredPronouns) || 'Not specified'
        )
        setEmail(String(user?.email || ''))
      } catch (e) {
        console.error('Failed to load profile:', e)
        setStatusType('error')
        setStatusMessage(e instanceof Error ? e.message : 'Failed to load profile')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const setLocalUserFields = (next: {
    name?: string
    preferred_name?: string
    preferred_pronouns?: typeof preferredPronouns
    email?: string
  }) => {
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
      const updatedPreferredName = String(updated?.preferred_name || updatedName)
      const updatedPronouns =
        (updated?.preferred_pronouns as typeof preferredPronouns) || preferredPronouns
      const updatedEmail = String(updated?.email || email)
      setName(updatedName)
      setPreferredName(updatedPreferredName)
      setPreferredPronouns(updatedPronouns)
      setEmail(updatedEmail)
      setLocalUserFields({
        name: updatedName,
        preferred_name: updatedPreferredName,
        preferred_pronouns: updatedPronouns,
        email: updatedEmail
      })
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

  const onSavePreferredName = async () => {
    const next = draftPreferredName.trim()
    const payload = !next || next === name ? { preferred_name: null } : { preferred_name: next }

    setSavingPreferredName(true)
    try {
      setStatusMessage('')
      const updated = await updateCurrentUser(payload)
      const updatedName = String(updated?.name || name)
      const updatedPreferredName = String(updated?.preferred_name || updatedName)
      const updatedEmail = String(updated?.email || email)
      const updatedPronouns =
        (updated?.preferred_pronouns as typeof preferredPronouns) || preferredPronouns

      setName(updatedName)
      setPreferredName(updatedPreferredName)
      setPreferredPronouns(updatedPronouns)
      setEmail(updatedEmail)
      setLocalUserFields({
        name: updatedName,
        preferred_name: updatedPreferredName,
        preferred_pronouns: updatedPronouns,
        email: updatedEmail
      })
      setIsEditingPreferredName(false)
      setStatusType('success')
      setStatusMessage('Preferred name updated')
    } catch (e) {
      console.error('Failed to update preferred name:', e)
      setStatusType('error')
      setStatusMessage(e instanceof Error ? e.message : 'Failed to update preferred name')
    } finally {
      setSavingPreferredName(false)
    }
  }

  const onSavePreferredPronouns = async () => {
    const next = draftPreferredPronouns

    setSavingPreferredPronouns(true)
    try {
      setStatusMessage('')
      const updated = await updateCurrentUser({ preferred_pronouns: next })
      const updatedName = String(updated?.name || name)
      const updatedPreferredName = String(updated?.preferred_name || updatedName)
      const updatedEmail = String(updated?.email || email)
      const updatedPronouns =
        (updated?.preferred_pronouns as typeof preferredPronouns) || next

      setName(updatedName)
      setPreferredName(updatedPreferredName)
      setPreferredPronouns(updatedPronouns)
      setEmail(updatedEmail)
      setLocalUserFields({
        name: updatedName,
        preferred_name: updatedPreferredName,
        preferred_pronouns: updatedPronouns,
        email: updatedEmail
      })
      setIsEditingPreferredPronouns(false)
      setStatusType('success')
      setStatusMessage('Preferred pronouns updated')
    } catch (e) {
      console.error('Failed to update preferred pronouns:', e)
      setStatusType('error')
      setStatusMessage(e instanceof Error ? e.message : 'Failed to update preferred pronouns')
    } finally {
      setSavingPreferredPronouns(false)
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
      const updatedPreferredName = String(updated?.preferred_name || updatedName)
      const updatedPronouns =
        (updated?.preferred_pronouns as typeof preferredPronouns) || preferredPronouns
      const updatedEmail = String(updated?.email || next)
      setName(updatedName)
      setPreferredName(updatedPreferredName)
      setPreferredPronouns(updatedPronouns)
      setEmail(updatedEmail)
      setLocalUserFields({
        name: updatedName,
        preferred_name: updatedPreferredName,
        preferred_pronouns: updatedPronouns,
        email: updatedEmail
      })
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
          <h1>Preferred Name</h1>
          <div className="ProfileFieldRow">
            {!isEditingPreferredName ? (
              <>
                <span>{loading ? 'Loading…' : preferredName || name || '—'}</span>
                <button
                  type="button"
                  className="ProfileEditButton"
                  onClick={() => {
                    setStatusMessage('')
                    setDraftPreferredName(preferredName || name)
                    setIsEditingPreferredName(true)
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
                  value={draftPreferredName}
                  onChange={(e) => setDraftPreferredName(e.target.value)}
                  disabled={savingPreferredName}
                />
                <button
                  type="button"
                  className="ProfileSaveButton"
                  onClick={onSavePreferredName}
                  disabled={savingPreferredName}
                >
                  Save
                </button>
                <button
                  type="button"
                  className="ProfileCancelButton"
                  onClick={() => {
                    setIsEditingPreferredName(false)
                    setDraftPreferredName('')
                  }}
                  disabled={savingPreferredName}
                >
                  Cancel
                </button>
              </>
            )}
          </div>
          <h1>Preferred Pronouns</h1>
          <div className="ProfileFieldRow">
            {!isEditingPreferredPronouns ? (
              <>
                <span>
                  {loading
                    ? 'Loading…'
                    : preferredPronouns}
                </span>
                <button
                  type="button"
                  className="ProfileEditButton"
                  onClick={() => {
                    setStatusMessage('')
                    setDraftPreferredPronouns(preferredPronouns || 'Not specified')
                    setIsEditingPreferredPronouns(true)
                  }}
                  disabled={loading}
                >
                  Edit
                </button>
              </>
            ) : (
              <>
                <select
                  className="ProfileEditInput"
                  value={draftPreferredPronouns}
                  onChange={(e) =>
                    setDraftPreferredPronouns(e.target.value as typeof preferredPronouns)
                  }
                  disabled={savingPreferredPronouns}
                >
                  <option value="Not specified">Not specified</option>
                  <option value="he/him">he/him</option>
                  <option value="she/her">she/her</option>
                  <option value="they/them">they/them</option>
                </select>
                <button
                  type="button"
                  className="ProfileSaveButton"
                  onClick={onSavePreferredPronouns}
                  disabled={savingPreferredPronouns}
                >
                  Save
                </button>
                <button
                  type="button"
                  className="ProfileCancelButton"
                  onClick={() => {
                    setIsEditingPreferredPronouns(false)
                    setDraftPreferredPronouns('Not specified')
                  }}
                  disabled={savingPreferredPronouns}
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