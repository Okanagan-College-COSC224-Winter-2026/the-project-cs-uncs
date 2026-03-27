import { BASE_URL, getErrorMessageFromResponse, maybeHandleExpire, safeFetch } from './core'

export const getCriteria = async (assignmentID: number) => {
  const resp = await safeFetch(`${BASE_URL}/review/criteria/${assignmentID}`, {
    credentials: 'include'
  })

  maybeHandleExpire(resp)

  if (!resp.ok) {
    throw new Error(await getErrorMessageFromResponse(resp))
  }

  return await resp.json()
}

const rubricCriteriaInFlight = new Map()

export const getRubricCriteria = async (assignmentID: number) => {
  const existing = rubricCriteriaInFlight.get(assignmentID)
  if (existing) return existing

  const request = (async () => {
    const resp = await safeFetch(`${BASE_URL}/get_criteria/${assignmentID}`, {
      credentials: 'include'
    })

    maybeHandleExpire(resp)

    if (!resp.ok) {
      throw new Error(await getErrorMessageFromResponse(resp))
    }

    return await resp.json()
  })()

  rubricCriteriaInFlight.set(assignmentID, request)
  request.finally(() => rubricCriteriaInFlight.delete(assignmentID))
  return request
}

export const createCriteria = async (rubricID: number, question: string, scoreMax: number, canComment: boolean) => {
  const response = await safeFetch(`${BASE_URL}/create_criteria`, {
    method: 'POST',
    body: JSON.stringify({
      rubricID, question, scoreMax, canComment
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
}

export const createRubric = async (id: number, assignmentID: number, canComment: boolean): Promise<{ id: number }> => {
  const response = await safeFetch(`${BASE_URL}/create_rubric`, {
    method: 'POST',
    body: JSON.stringify({
      id, assignmentID, canComment
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

export const getRubricForAssignment = async (assignmentId: number) => {
  const resp = await safeFetch(`${BASE_URL}/get_rubric/${assignmentId}`, {
    credentials: 'include'
  })

  maybeHandleExpire(resp)

  if (!resp.ok) {
    throw new Error(await getErrorMessageFromResponse(resp))
  }

  return await resp.json()
}

export const deleteCriteriaDescription = async (criteriaId: number) => {
  const resp = await safeFetch(`${BASE_URL}/delete_criteria/${criteriaId}`, {
    method: 'DELETE',
    credentials: 'include'
  })

  maybeHandleExpire(resp)

  if (!resp.ok) {
    throw new Error(await getErrorMessageFromResponse(resp))
  }

  return await resp.json().catch(() => ({}))
}

export const updateCriteriaDescription = async (
  criteriaId: number,
  payload: { question?: string; scoreMax?: number }
) => {
  const resp = await safeFetch(`${BASE_URL}/update_criteria/${criteriaId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
  })

  maybeHandleExpire(resp)

  if (!resp.ok) {
    throw new Error(await getErrorMessageFromResponse(resp))
  }

  return await resp.json().catch(() => ({}))
}

export const getRubric = async (rubricID: number) => {
  const resp = await safeFetch(`${BASE_URL}/rubric?rubricID=${rubricID}`, {
    credentials: 'include'
  })

  maybeHandleExpire(resp)

  if (!resp.ok) {
    throw new Error(await getErrorMessageFromResponse(resp))
  }

  return await resp.json()
}

