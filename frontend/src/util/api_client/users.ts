import { BASE_URL, getErrorMessageFromResponse, maybeHandleExpire, safeFetch } from './core'

const CURRENT_USER_TTL_MS = 2_000

let currentUserCache: { expiresAt: number; value: unknown } | null = null
let currentUserInFlight: Promise<unknown> | null = null

const invalidateCurrentUserCache = () => {
  currentUserCache = null
}

export const getCurrentUser = async (opts?: { forceRefresh?: boolean }) => {
  if (!opts?.forceRefresh) {
    if (currentUserCache && currentUserCache.expiresAt > Date.now()) {
      return currentUserCache.value
    }

    if (currentUserInFlight) {
      return await currentUserInFlight
    }
  }

  currentUserInFlight = (async () => {
    const response = await safeFetch(`${BASE_URL}/user/`, {
      method: 'GET',
      credentials: 'include'
    })

    maybeHandleExpire(response)

    if (!response.ok) {
      invalidateCurrentUserCache()
      throw new Error(await getErrorMessageFromResponse(response, 'Unable to load your account'))
    }

    const user = await response.json()
    currentUserCache = { value: user, expiresAt: Date.now() + CURRENT_USER_TTL_MS }
    return user
  })().finally(() => {
    currentUserInFlight = null
  })

  return await currentUserInFlight
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

  invalidateCurrentUserCache()
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

