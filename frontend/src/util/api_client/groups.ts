import { BASE_URL, getErrorMessageFromResponse, maybeHandleExpire, safeFetch } from './core'

export type CourseGroupMember = { id: number; name: string; email?: string }
export type CourseGroup = { id: number; name: string; members: CourseGroupMember[] }

export const listCourseGroups = async (courseId: number): Promise<CourseGroup[]> => {
  const resp = await safeFetch(`${BASE_URL}/groups/course/${courseId}`, {
    method: 'GET',
    credentials: 'include',
  })

  maybeHandleExpire(resp)

  if (!resp.ok) {
    throw new Error(await getErrorMessageFromResponse(resp, 'Unable to load groups'))
  }

  return await resp.json()
}

export const createCourseGroup = async (
  courseId: number,
  name: string,
  memberIds: number[]
): Promise<{ msg: string; group_id: number }> => {
  const resp = await safeFetch(`${BASE_URL}/groups/course/${courseId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, members: memberIds }),
    credentials: 'include',
  })

  const json = await resp.json().catch(() => ({}))
  maybeHandleExpire(resp)

  if (!resp.ok) {
    throw new Error(await getErrorMessageFromResponse(resp, 'Unable to create the group'))
  }

  return json
}

export const getMyCourseGroup = async (courseId: number): Promise<{ group: CourseGroup | null; multiple?: boolean }> => {
  const resp = await safeFetch(`${BASE_URL}/groups/course/${courseId}/my`, {
    method: 'GET',
    credentials: 'include',
  })

  const json = await resp.json().catch(() => ({}))
  maybeHandleExpire(resp)

  if (!resp.ok) {
    throw new Error(await getErrorMessageFromResponse(resp, 'Unable to load your group'))
  }

  return json
}

export const addCourseGroupMember = async (groupId: number, userId: number): Promise<CourseGroup> => {
  const resp = await safeFetch(`${BASE_URL}/groups/${groupId}/members`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId }),
    credentials: 'include',
  })

  const json = await resp.json().catch(() => ({}))
  maybeHandleExpire(resp)

  if (!resp.ok) {
    throw new Error(await getErrorMessageFromResponse(resp, 'Unable to add the student to the group'))
  }

  return json
}

export const removeCourseGroupMember = async (groupId: number, userId: number): Promise<CourseGroup> => {
  const resp = await safeFetch(`${BASE_URL}/groups/${groupId}/members/${userId}`, {
    method: 'DELETE',
    credentials: 'include',
  })

  const json = await resp.json().catch(() => ({}))
  maybeHandleExpire(resp)

  if (!resp.ok) {
    throw new Error(await getErrorMessageFromResponse(resp, 'Unable to remove the student from the group'))
  }

  return json
}

export const deleteCourseGroup = async (groupId: number): Promise<{ msg?: string }> => {
  const resp = await safeFetch(`${BASE_URL}/groups/${groupId}`, {
    method: 'DELETE',
    credentials: 'include',
  })

  const json = await resp.json().catch(() => ({}))
  maybeHandleExpire(resp)

  if (!resp.ok) {
    throw new Error(await getErrorMessageFromResponse(resp, 'Unable to delete the group'))
  }

  return json
}

export const listGroupMembers = async (assignmentId: number, groupID: number) => {
  const resp = await safeFetch(`${BASE_URL}/list_group_members/` + assignmentId + '/' + groupID, {
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

export const saveGroups = async (groupID: number, userID: number, assignmentID: number) => {
  await safeFetch(`${BASE_URL}/save_groups`, {
    method: 'POST',
    body: JSON.stringify({
      groupID,
      userID,
      assignmentID
    }),
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
  })
}

export const deleteGroup = async (groupID: number) => {
  await safeFetch(`${BASE_URL}/delete_group`, {
    method: 'POST',
    body: JSON.stringify({
      groupID,
    }),
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
  })
}

export const getNextGroupID = async (assignmentID: number) => {
  const response = await safeFetch(`${BASE_URL}/next_groupid?assignmentID=${assignmentID}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include'
  })

  maybeHandleExpire(response)

  if (!response.ok) {
    throw new Error(await getErrorMessageFromResponse(response))
  }

  return await response.json()
}

export const createGroup = async (assignmentID: number, name: string, id: number) => {
  const response = await safeFetch(`${BASE_URL}/create_group`, {
    method: 'POST',
    body: JSON.stringify({
      assignmentID, name, id
    }),
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include'
  })

  maybeHandleExpire(response)

  if (!response.ok) {
    throw new Error(await getErrorMessageFromResponse(response))
  }

  return await response.json()
}

