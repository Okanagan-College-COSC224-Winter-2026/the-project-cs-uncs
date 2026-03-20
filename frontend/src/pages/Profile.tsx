import { useEffect, useRef, useState } from 'react'
import StatusMessage from '../components/StatusMessage'
import './Profile.css'
import { getCurrentUser, getCurrentUserPhotoUrl, uploadCurrentUserPhoto } from '../util/api'

export default function Profile() {
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const [loading, setLoading] = useState(true)
  const [name, setName] = useState<string>('')
  const [email, setEmail] = useState<string>('')

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

        <div className="profile-info">
          <h1>Full Name</h1>
          <span>{loading ? 'Loading…' : name || '—'}</span>
          <h1>Email</h1>
          <span>{loading ? 'Loading…' : email || '—'}</span>

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
      </div>
    </div>
  )
}