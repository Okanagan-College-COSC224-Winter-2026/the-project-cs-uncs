import { BASE_URL, getErrorMessageFromResponse, maybeHandleExpire, safeFetch } from './core'

export const createUserAdmin = async (name: string, email: string, password: string, role: string = 'student', mustChangePassword: boolean = false) => {
  const response = await safeFetch(`${BASE_URL}/admin/users/create`, {
    method: 'POST',
    body: JSON.stringify({
      name,
      email,
      password,
      role,
      must_change_password: mustChangePassword
    }),
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include'
  })

  maybeHandleExpire(response)

  if (!response.ok) {
    throw new Error(await getErrorMessageFromResponse(response, 'Failed to create user'))
  }

  return await response.json()
}

export const listAllUsers = async () => {
  const resp = await safeFetch(`${BASE_URL}/admin/users`, {
    method: 'GET',
    credentials: 'include'
  })

  maybeHandleExpire(resp)

  if (!resp.ok) {
    throw new Error(await getErrorMessageFromResponse(resp))
  }

  return await resp.json()
}

export const updateUserAdmin = async (userId: number, data: { name?: string; email?: string }) => {
  const resp = await safeFetch(`${BASE_URL}/admin/users/${userId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include'
  })

  maybeHandleExpire(resp)

  if (!resp.ok) {
    throw new Error(await getErrorMessageFromResponse(resp, 'Failed to update user'))
  }

  return await resp.json()
}

export const updateUserRoleAdmin = async (userId: number, role: string) => {
  const resp = await safeFetch(`${BASE_URL}/admin/users/${userId}/role`, {
    method: 'PUT',
    body: JSON.stringify({ role }),
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include'
  })

  maybeHandleExpire(resp)

  if (!resp.ok) {
    throw new Error(await getErrorMessageFromResponse(resp, 'Failed to update user role'))
  }

  return await resp.json()
}

export const deleteUserAdmin = async (userId: number) => {
  const resp = await safeFetch(`${BASE_URL}/admin/users/${userId}`, {
    method: 'DELETE',
    credentials: 'include'
  })

  maybeHandleExpire(resp)

  if (!resp.ok) {
    throw new Error(await getErrorMessageFromResponse(resp, 'Failed to delete user'))
  }

  return await resp.json()
}

