import { BASE_URL, getErrorMessageFromResponse, maybeHandleExpire, safeFetch } from './core'

const CLASSES_CACHE_TTL_MS = 5_000
let classesCache: unknown[] | null = null
let classesCacheAt = 0
let classesInFlight: Promise<unknown[]> | null = null

const clearClassesCache = () => {
  classesCache = null
  classesCacheAt = 0
}

export const createClass = async (name: string) => {
  const response = await safeFetch(`${BASE_URL}/class/create_class`, {
    method: 'POST',
    body: JSON.stringify({
      name,
    }),
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include'
  })

  maybeHandleExpire(response)

  if (!response.ok) {
    throw new Error(await getErrorMessageFromResponse(response, 'Failed to create class'))
  }

  clearClassesCache()
  return await response.json().catch(() => ({}))
}

export const listClasses = async (opts?: { forceRefresh?: boolean }) => {
  const forceRefresh = Boolean(opts?.forceRefresh)
  const now = Date.now()
  if (!forceRefresh && classesCache && now - classesCacheAt < CLASSES_CACHE_TTL_MS) {
    return classesCache
  }

  if (!forceRefresh && classesInFlight) {
    return classesInFlight
  }

  const request = (async () => {
    const resp = await safeFetch(`${BASE_URL}/class/classes`, {
      method: 'GET',
      credentials: 'include'
    })

    maybeHandleExpire(resp)

    if (!resp.ok) {
      throw new Error(await getErrorMessageFromResponse(resp))
    }

    const json = await resp.json()
    if (Array.isArray(json)) {
      classesCache = json
      classesCacheAt = Date.now()
    } else {
      classesCache = null
      classesCacheAt = 0
    }

    return json
  })()

  classesInFlight = request
  request.finally(() => {
    if (classesInFlight === request) classesInFlight = null
  })

  return request
}

export const searchClasses = async (query: string) => {
  const resp = await safeFetch(`${BASE_URL}/class/search?q=${encodeURIComponent(query)}`, {
    method: 'GET',
    credentials: 'include'
  })

  maybeHandleExpire(resp)

  if (!resp.ok) {
    throw new Error(await getErrorMessageFromResponse(resp))
  }

  return await resp.json()
}

export const importStudentsForCourse = async (courseID: number, students: string) => {
  const response = await safeFetch(`${BASE_URL}/class/enroll_students`, {
    method: 'POST',
    body: JSON.stringify({
      students,
      class_id: courseID,
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

  clearClassesCache()
  return await response.json()
}

export const enrollStudentsByEmail = async (courseID: number, emails: string) => {
  const response = await safeFetch(`${BASE_URL}/class/enroll_students_emails`, {
    method: 'POST',
    body: JSON.stringify({
      emails,
      class_id: courseID,
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

  clearClassesCache()
  return await response.json()
}

export const listCourseMembers = async (classId: string) => {
  const resp = await safeFetch(`${BASE_URL}/class/members`, {
    method: 'POST',
    body: JSON.stringify({
      id: classId,
    }),
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

export const removeCourseMember = async (classId: number, userId: number) => {
  const resp = await safeFetch(`${BASE_URL}/class/remove_member`, {
    method: 'POST',
    body: JSON.stringify({
      class_id: classId,
      user_id: userId,
    }),
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
  })

  maybeHandleExpire(resp)

  if (!resp.ok) {
    throw new Error(await getErrorMessageFromResponse(resp))
  }

  clearClassesCache()
  return await resp.json().catch(() => ({}))
}

export const joinRosterCourse = async (courseId: number) => {
  const resp = await safeFetch(`${BASE_URL}/class/join_course`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ course_id: courseId }),
    credentials: 'include'
  })

  maybeHandleExpire(resp)

  if (!resp.ok) {
    throw new Error(await getErrorMessageFromResponse(resp))
  }

  clearClassesCache()
  return await resp.json()
}

export const getAvailableCourses = async () => {
  const resp = await safeFetch(`${BASE_URL}/class/available_courses`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include'
  })

  maybeHandleExpire(resp)

  if (!resp.ok) {
    throw new Error(await getErrorMessageFromResponse(resp))
  }

  return await resp.json()
}

