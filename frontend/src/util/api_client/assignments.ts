import { BASE_URL, getErrorMessageFromResponse, maybeHandleExpire, safeFetch } from './core'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

export const deleteAssignment = async (assignmentId: number) => {
  const response = await safeFetch(`${BASE_URL}/assignment/delete_assignment/${assignmentId}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include'
  })

  maybeHandleExpire(response)

  if (!response.ok) {
    throw new Error(await getErrorMessageFromResponse(response, 'Failed to delete assignment'))
  }

  return await response.json()
}

export type SetAssignmentClosedResponse = {
  msg?: string
  assignment?: unknown
}

export const setAssignmentClosed = async (
  assignmentId: number,
  isClosed: boolean
): Promise<SetAssignmentClosedResponse> => {
  const response = await safeFetch(`${BASE_URL}/assignment/closed/${assignmentId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ is_closed: isClosed }),
    credentials: 'include'
  })

  maybeHandleExpire(response)

  if (!response.ok) {
    throw new Error(await getErrorMessageFromResponse(response, 'Failed to update assignment status'))
  }

  const json: unknown = await response.json()
  if (!isRecord(json)) return {}

  const updated = json.assignment
  if (isRecord(updated)) {
    const updatedId = toNumberOrNull(updated.id)
    if (updatedId != null) {
      cacheAssignmentDetails(updatedId, updated)
    }
  }

  return {
    msg: typeof json.msg === 'string' ? json.msg : undefined,
    assignment: updated,
  }
}

const assignmentsListInFlight = new Map()

export const listAssignments = async (classId: string) => {
  const existing = assignmentsListInFlight.get(classId)
  if (existing) return existing

  const request = (async () => {
    const resp = await safeFetch(`${BASE_URL}/assignment/` + classId, {
      method: 'GET',
      credentials: 'include',
    })

    maybeHandleExpire(resp)

    if (!resp.ok) {
      throw new Error(await getErrorMessageFromResponse(resp))
    }

    const json = await resp.json()
    if (Array.isArray(json)) {
      for (const a of json) {
        const assignmentId = Number(a?.id)
        if (!Number.isFinite(assignmentId)) continue
        cacheAssignmentDetails(assignmentId, a)
      }
    }

    return json
  })()

  assignmentsListInFlight.set(classId, request)
  request.finally(() => assignmentsListInFlight.delete(classId))
  return request
}

const assignmentDetailsInFlight = new Map()
const assignmentDetailsCache = new Map()

const assignmentDetailsStorageKey = (assignmentId: number) => `assignmentDetails:${assignmentId}`

const toNumberOrNull = (value: unknown) => {
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function cacheAssignmentDetails(assignmentId: number, details: unknown) {
  assignmentDetailsCache.set(assignmentId, details)

  // Persist a minimal subset so first-visit tab rendering can avoid collapsing.
  try {
    if (!isRecord(details)) return
    const courseRecord = isRecord(details.course) ? details.course : null
    const courseId =
      toNumberOrNull(details.courseID) ??
      toNumberOrNull(details.course_id) ??
      toNumberOrNull(courseRecord?.id)

    const minimal = {
      id: toNumberOrNull(details.id) ?? assignmentId,
      name: typeof details.name === 'string' ? details.name : null,
      assignment_type: typeof details.assignment_type === 'string' ? details.assignment_type : null,
      due_date: typeof details.due_date === 'string' ? details.due_date : null,
      is_closed: typeof details.is_closed === 'boolean' ? details.is_closed : undefined,
      courseID: courseId ?? undefined,
      course: courseId != null ? { id: courseId } : undefined,
    }
    sessionStorage.setItem(assignmentDetailsStorageKey(assignmentId), JSON.stringify(minimal))
  } catch {
    // ignore storage failures (private mode/quota)
  }
}

export const hintAssignmentType = (assignmentId: number, assignmentType: string) => {
  if (!Number.isFinite(Number(assignmentId))) return
  if (!assignmentType) return
  cacheAssignmentDetails(Number(assignmentId), { id: Number(assignmentId), assignment_type: assignmentType })
}

export const peekAssignmentDetails = (assignmentId: number) => {
  const mem = assignmentDetailsCache.get(assignmentId)
  if (mem) return mem

  try {
    const raw = sessionStorage.getItem(assignmentDetailsStorageKey(assignmentId))
    if (!raw) return null
    const parsed = JSON.parse(raw)
    assignmentDetailsCache.set(assignmentId, parsed)
    return parsed
  } catch {
    return null
  }
}

export const getAssignmentDetails = async (assignmentId: number) => {
  const existing = assignmentDetailsInFlight.get(assignmentId)
  if (existing) return existing

  const request = (async () => {
    const resp = await safeFetch(`${BASE_URL}/assignment/details/${assignmentId}`, {
      credentials: 'include'
    })

    maybeHandleExpire(resp)

    if (!resp.ok) {
      throw new Error(await getErrorMessageFromResponse(resp))
    }

    const json = await resp.json()
    cacheAssignmentDetails(assignmentId, json)
    return json
  })()

  assignmentDetailsInFlight.set(assignmentId, request)
  request.finally(() => assignmentDetailsInFlight.delete(assignmentId))
  return request
}

export const getAssignmentAttachmentUrl = (assignmentId: number) => {
  return `${BASE_URL}/assignment/attachment/${assignmentId}`
}

export const getSubmissionDownloadUrl = (submissionId: number) => {
  return `${BASE_URL}/assignment/submission/download/${submissionId}`
}

export const getSubmissionAttachmentDownloadUrl = (attachmentId: number) => {
  return `${BASE_URL}/assignment/submission/attachment/download/${attachmentId}`
}

export const getMySubmission = async (assignmentId: number) => {
  const resp = await safeFetch(`${BASE_URL}/assignment/my_submission/${assignmentId}`, {
    credentials: 'include'
  })

  maybeHandleExpire(resp)

  if (resp.status === 403) {
    const errorData = await resp.json().catch(() => ({}))
    return { submission: null, forbidden: true, msg: errorData.msg }
  }

  if (!resp.ok) {
    throw new Error(await getErrorMessageFromResponse(resp))
  }

  return await resp.json()
}

export const deleteMySubmission = async (assignmentId: number) => {
  const resp = await safeFetch(`${BASE_URL}/assignment/my_submission/${assignmentId}`, {
    method: 'DELETE',
    credentials: 'include'
  })

  maybeHandleExpire(resp)

  if (!resp.ok) {
    throw new Error(await getErrorMessageFromResponse(resp))
  }

  return await resp.json()
}

export const uploadMySubmission = async (assignmentId: number, formData: FormData) => {
  const resp = await safeFetch(`${BASE_URL}/assignment/submit/${assignmentId}`, {
    method: 'POST',
    body: formData,
    credentials: 'include'
  })

  maybeHandleExpire(resp)

  if (!resp.ok) {
    throw new Error(await getErrorMessageFromResponse(resp))
  }

  return await resp.json()
}

export const listSubmissions = async (assignmentId: number) => {
  const resp = await safeFetch(`${BASE_URL}/assignment/submissions/${assignmentId}`, {
    credentials: 'include'
  })

  maybeHandleExpire(resp)

  if (resp.status === 403) {
    const errorData = await resp.json().catch(() => ({}))
    return { submissions: [], forbidden: true, msg: errorData.msg }
  }

  if (!resp.ok) {
    throw new Error(await getErrorMessageFromResponse(resp))
  }

  return await resp.json()
}

export const updateAssignmentDetails = async (assignmentId: number, formData: FormData) => {
  const tzOffset = String(new Date().getTimezoneOffset())
  const resp = await safeFetch(`${BASE_URL}/assignment/edit_details/${assignmentId}`, {
    method: 'PATCH',
    body: formData,
    headers: {
      'X-Timezone-Offset': tzOffset,
    },
    credentials: 'include'
  })

  maybeHandleExpire(resp)

  if (!resp.ok) {
    throw new Error(await getErrorMessageFromResponse(resp))
  }

  return await resp.json()
}

export type CreateAssignmentRequest = {
  courseID: number;
  name: string;
  description?: string;
  due_date?: string;
  assignment_type?: 'standard' | 'peer_eval_group' | 'peer_eval_individual';
  included_group_ids?: number[];
  rubric_criteria?: Array<{ question: string; scoreMax?: number }>;
}

export async function createAssignment(
  arg1: number | CreateAssignmentRequest | FormData,
  name?: string,
  due_date?: string
) {
  const isMultipart = arg1 instanceof FormData
  const tzOffset = String(new Date().getTimezoneOffset())

  const jsonBody: CreateAssignmentRequest | null = (() => {
    if (isMultipart) return null
    if (typeof arg1 === 'number') {
      return { courseID: arg1, name: name || '', due_date } satisfies CreateAssignmentRequest
    }
    return arg1 as CreateAssignmentRequest
  })()

  const response = await safeFetch(`${BASE_URL}/assignment/create_assignment`, {
    method: 'POST',
    body: isMultipart
      ? arg1
      : JSON.stringify(jsonBody),
    headers: isMultipart
      ? {
          'X-Timezone-Offset': tzOffset,
        }
      : {
          'Content-Type': 'application/json',
          'X-Timezone-Offset': tzOffset,
        },
    credentials: 'include'
  })

  maybeHandleExpire(response)

  if (!response.ok) {
    throw new Error(await getErrorMessageFromResponse(response, 'Failed to create assignment'))
  }

  return await response.json()
}

