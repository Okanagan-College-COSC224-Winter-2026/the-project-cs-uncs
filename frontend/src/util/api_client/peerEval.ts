import { BASE_URL, getErrorMessageFromResponse, maybeHandleExpire, safeFetch } from './core'

export type PeerEvalGroupStatusResponse = {
  assignment: { id: number; name: string };
  reviewer_group: { id: number; name: string };
  submitted: boolean;
  targets: Array<{ id: number; name: string }>;
  criteria: Array<{ id: number; question: string; scoreMax: number }>;
  submission?: {
    id: number;
    submitted_at: string | null;
    submitted_by_user_id: number;
    submitted_by_name?: string | null;
    evaluations: Array<{
      reviewee_group: { id: number; name: string };
      criteria: Array<{ criterionRowID: number; grade: number | null; comments: string | null }>;
    }>;
  } | null;
}

const groupPeerEvalStatusInFlight = new Map<number, Promise<PeerEvalGroupStatusResponse>>()

export const getGroupPeerEvalStatus = async (assignmentId: number): Promise<PeerEvalGroupStatusResponse> => {
  const key = Number(assignmentId)
  const existing = groupPeerEvalStatusInFlight.get(key)
  if (existing) return existing

  const request: Promise<PeerEvalGroupStatusResponse> = (async () => {
    const resp = await safeFetch(`${BASE_URL}/peer_eval/group/status/${assignmentId}`, {
      credentials: 'include'
    })

    maybeHandleExpire(resp)

    if (!resp.ok) {
      throw new Error(await getErrorMessageFromResponse(resp))
    }

    return await resp.json()
  })()

  groupPeerEvalStatusInFlight.set(key, request)
  request.finally(() => groupPeerEvalStatusInFlight.delete(key))
  return request
}

export type PeerEvalSubmittedCriterion = {
  criterionRowID: number;
  grade: number | null;
  comments: string | null;
}

export type PeerEvalGroupEvaluation = {
  reviewee_group_id: number;
  criteria: PeerEvalSubmittedCriterion[];
}

export const submitGroupPeerEval = async (assignmentId: number, evaluations: PeerEvalGroupEvaluation[]) => {
  const resp = await safeFetch(`${BASE_URL}/peer_eval/group/submit/${assignmentId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ evaluations }),
    credentials: 'include'
  })

  maybeHandleExpire(resp)

  if (!resp.ok) {
    throw new Error(await getErrorMessageFromResponse(resp))
  }

  return await resp.json()
}

export const unsubmitGroupPeerEval = async (assignmentId: number) => {
  const resp = await safeFetch(`${BASE_URL}/peer_eval/group/unsubmit/${assignmentId}`, {
    method: 'POST',
    credentials: 'include'
  })

  maybeHandleExpire(resp)

  if (!resp.ok) {
    throw new Error(await getErrorMessageFromResponse(resp))
  }

  return await resp.json()
}

export const updateGroupPeerEval = async (assignmentId: number, evaluations: PeerEvalGroupEvaluation[]) => {
  const resp = await safeFetch(`${BASE_URL}/peer_eval/group/update/${assignmentId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ evaluations }),
    credentials: 'include'
  })

  maybeHandleExpire(resp)

  if (!resp.ok) {
    throw new Error(await getErrorMessageFromResponse(resp))
  }

  return await resp.json()
}

export type PeerEvalGroupReceivedResponse = {
  assignment: { id: number; name: string };
  feedback: Array<{
    target_id: number;
    criteria: Array<{
      criterionRowID: number;
      question: string;
      scoreMax: number | null;
      grade: number | null;
      comments: string | null;
    }>;
  }>;
  total_reviews: number;
}

export const getReceivedGroupPeerEvalFeedback = async (assignmentId: number): Promise<PeerEvalGroupReceivedResponse> => {
  const resp = await safeFetch(`${BASE_URL}/peer_eval/group/received/${assignmentId}`, {
    credentials: 'include'
  })

  maybeHandleExpire(resp)

  if (!resp.ok) {
    throw new Error(await getErrorMessageFromResponse(resp))
  }

  return await resp.json()
}

export type TeacherGroupPeerEvalOverviewResponse = {
  assignment: { id: number; name: string; course_id: number };
  submissions: Array<{
    id: number;
    reviewer_group: { id: number; name: string };
    submitted_by: { id: number; name: string | null };
    submitted_at: string | null;
    on_time?: boolean | null;
    evaluations: Array<{
      reviewee_group: { id: number; name: string };
      criteria: Array<{
        criterionRowID: number;
        question: string;
        scoreMax: number | null;
        grade: number | null;
        comments: string | null;
      }>;
    }>;
  }>;
  total_submissions: number;
}

export const getTeacherGroupPeerEvalOverview = async (assignmentId: number): Promise<TeacherGroupPeerEvalOverviewResponse> => {
  const resp = await safeFetch(`${BASE_URL}/peer_eval/group/assignment/${assignmentId}/all`, {
    credentials: 'include'
  })

  maybeHandleExpire(resp)

  if (!resp.ok) {
    throw new Error(await getErrorMessageFromResponse(resp))
  }

  return await resp.json()
}

export type TeacherGroupPeerEvalSummaryResponse = {
  assignment: { id: number; name: string; course_id: number };
  max_per_review: number;
  groups: Array<{
    group: { id: number; name: string };
    reviews_received: number;
    total_received: number;
    max_possible: number;
  }>;
}

export const getTeacherGroupPeerEvalSummary = async (assignmentId: number): Promise<TeacherGroupPeerEvalSummaryResponse> => {
  const resp = await safeFetch(`${BASE_URL}/peer_eval/group/assignment/${assignmentId}/summary`, {
    credentials: 'include'
  })

  maybeHandleExpire(resp)

  if (!resp.ok) {
    throw new Error(await getErrorMessageFromResponse(resp))
  }

  return await resp.json()
}

export const syncIndividualPeerEvalReviews = async (assignmentId: number) => {
  const resp = await safeFetch(`${BASE_URL}/peer_eval/individual/sync/${assignmentId}`, {
    method: 'POST',
    credentials: 'include'
  })

  maybeHandleExpire(resp)

  if (!resp.ok) {
    throw new Error(await getErrorMessageFromResponse(resp))
  }

  return await resp.json()
}

