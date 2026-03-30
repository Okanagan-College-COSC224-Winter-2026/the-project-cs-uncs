import { BASE_URL, getErrorMessageFromResponse, maybeHandleExpire, safeFetch } from './core'

export const getCurrentUser = async () => {
  const response = await safeFetch(`${BASE_URL}/user/`, {
    method: 'GET',
    credentials: 'include'
  })

  maybeHandleExpire(response)

  if (!response.ok) {
    throw new Error(await getErrorMessageFromResponse(response, 'Unable to load your account'))
  }

  return await response.json()
}

export const updateCurrentUser = async (payload: { name?: string; email?: string }) => {
  const response = await safeFetch(`${BASE_URL}/user/`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload),
    credentials: 'include'
  })

  maybeHandleExpire(response)

  if (!response.ok) {
    throw new Error(await getErrorMessageFromResponse(response, 'Unable to update your account'))
  }

  return await response.json()
}

export const getCurrentUserPhotoUrl = (cacheBuster?: string | number) => {
  const suffix = cacheBuster ? `?v=${encodeURIComponent(String(cacheBuster))}` : ''
  return `${BASE_URL}/user/photo${suffix}`
}

export const uploadCurrentUserPhoto = async (file: File) => {
  const formData = new FormData()
  formData.append('file', file)

  const response = await safeFetch(`${BASE_URL}/user/photo`, {
    method: 'POST',
    body: formData,
    credentials: 'include',
  })

  maybeHandleExpire(response)

  if (!response.ok) {
    throw new Error(await getErrorMessageFromResponse(response, 'Failed to upload photo'))
  }

  return await response.json().catch(() => ({}))
}

export const getUserId = async () => {
  const resp = await safeFetch(`${BASE_URL}/user_id`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
  })

  maybeHandleExpire(resp)

  if (!resp.ok) {
    throw new Error(await getErrorMessageFromResponse(resp))
  }

  return await resp.json()
}

// NOTE: This function intentionally does NOT call maybeHandleExpire().
// The PATCH /user/password endpoint returns 401 for "wrong current password",
// which is a user-facing validation error — not an expired session.
export const changePassword = async (currentPassword: string, newPassword: string) => {
  const response = await safeFetch(`${BASE_URL}/user/password`, {
    method: 'PATCH',
    body: JSON.stringify({
      current_password: currentPassword,
      new_password: newPassword
    }),
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include'
  })

  if (!response.ok) {
    throw new Error(await getErrorMessageFromResponse(response, 'Failed to change password'))
  }

  return await response.json()
}

