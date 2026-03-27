import { BASE_URL, getErrorMessageFromResponse, maybeHandleExpire, safeFetch } from './core'

const assignedReviewsInFlight = new Map()

export const getAssignedReviews = async (assignmentId: number) => {
  const key = Number(assignmentId)
  const existing = assignedReviewsInFlight.get(key)
  if (existing) return existing

  const request = (async () => {
    const response = await safeFetch(`${BASE_URL}/review/assigned/${assignmentId}`, {
      method: 'GET',
      credentials: 'include'
    })

    maybeHandleExpire(response)

    if (!response.ok) {
      throw new Error(await getErrorMessageFromResponse(response))
    }

    return await response.json()
  })()

  assignedReviewsInFlight.set(key, request)
  request.finally(() => assignedReviewsInFlight.delete(key))
  return request
}

export const getReviewSubmission = async (reviewId: number) => {
  const response = await safeFetch(`${BASE_URL}/review/submission/${reviewId}`, {
    method: 'GET',
    credentials: 'include'
  })

  maybeHandleExpire(response)

  if (response.status === 404) {
    return { submission: null }
  }

  if (!response.ok) {
    throw new Error(await getErrorMessageFromResponse(response))
  }

  return await response.json()
}

export const submitReviewFeedback = async (
  reviewId: number,
  criteria: { criterionRowID: number; grade: number; comments: string }[]
) => {
  const response = await safeFetch(`${BASE_URL}/review/submit/${reviewId}`, {
    method: 'POST',
    body: JSON.stringify({ criteria }),
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

export const updateReviewFeedback = async (
  reviewId: number,
  criteria: { criterionRowID: number; grade: number; comments: string }[]
) => {
  const response = await safeFetch(`${BASE_URL}/review/update/${reviewId}`, {
    method: 'POST',
    body: JSON.stringify({ criteria }),
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

export const unsubmitReviewFeedback = async (reviewId: number) => {
  const response = await safeFetch(`${BASE_URL}/review/unsubmit/${reviewId}`, {
    method: 'POST',
    credentials: 'include'
  })

  maybeHandleExpire(response)

  if (!response.ok) {
    throw new Error(await getErrorMessageFromResponse(response))
  }

  return await response.json()
}

export const getReviewDetails = async (reviewId: number) => {
  const response = await safeFetch(`${BASE_URL}/review/${reviewId}`, {
    method: 'GET',
    credentials: 'include'
  })

  maybeHandleExpire(response)

  if (!response.ok) {
    throw new Error(await getErrorMessageFromResponse(response))
  }

  return await response.json()
}

export const createReviewAssignment = async (
  assignmentId: number,
  reviewerId: number,
  revieweeId: number
) => {
  const response = await safeFetch(`${BASE_URL}/review/create`, {
    method: 'POST',
    body: JSON.stringify({
      assignmentID: assignmentId,
      reviewerID: reviewerId,
      revieweeID: revieweeId
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

const allReviewsForAssignmentInFlight = new Map()

export const getAllReviewsForAssignment = async (assignmentId: number) => {
  const key = Number(assignmentId)
  const existing = allReviewsForAssignmentInFlight.get(key)
  if (existing) return existing

  const request = (async () => {
    const response = await safeFetch(`${BASE_URL}/review/assignment/${assignmentId}/all`, {
      method: 'GET',
      credentials: 'include'
    })

    maybeHandleExpire(response)

    if (!response.ok) {
      throw new Error(await getErrorMessageFromResponse(response))
    }

    return await response.json()
  })()

  allReviewsForAssignmentInFlight.set(key, request)
  request.finally(() => allReviewsForAssignmentInFlight.delete(key))
  return request
}

const receivedFeedbackInFlight = new Map()

export const getReceivedFeedback = async (assignmentId: number) => {
  const key = Number(assignmentId)
  const existing = receivedFeedbackInFlight.get(key)
  if (existing) return existing

  const request = (async () => {
    const response = await safeFetch(`${BASE_URL}/review/received/${assignmentId}`, {
      method: 'GET',
      credentials: 'include'
    })

    maybeHandleExpire(response)

    if (!response.ok) {
      throw new Error(await getErrorMessageFromResponse(response))
    }

    return await response.json()
  })()

  receivedFeedbackInFlight.set(key, request)
  request.finally(() => receivedFeedbackInFlight.delete(key))
  return request
}

export const createReview = async (assignmentID: number, reviewerID: number, revieweeID: number) => {
  const response = await safeFetch(`${BASE_URL}/create_review`, {
    method: 'POST',
    body: JSON.stringify({
      assignmentID,
      reviewerID,
      revieweeID,
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
  return response
}

export const createCriterion = async (reviewID: number, criterionRowID: number, grade: number, comments: string) => {
  const response = await safeFetch(`${BASE_URL}/create_criterion`, {
    method: 'POST',
    body: JSON.stringify({
      reviewID,
      criterionRowID,
      grade,
      comments,
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
  return response
}

export const getReview = async (assignmentID: number, reviewerID: number, revieweeID: number) => {
  const resp = await safeFetch(`${BASE_URL}/review?assignmentID=${assignmentID}&reviewerID=${reviewerID}&revieweeID=${revieweeID}`, {
    credentials: 'include'
  })

  maybeHandleExpire(resp)

  if (!resp.ok) {
    throw new Error(await getErrorMessageFromResponse(resp))
  }

  return resp
}

