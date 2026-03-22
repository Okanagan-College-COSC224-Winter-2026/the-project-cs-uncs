import { didExpire, removeToken } from "./login";

const BASE_URL = 'http://localhost:5000'

// export const getProfile = async (id: string) => {
//   // TODO
// }


export const maybeHandleExpire = (response: Response) => {
  if (didExpire(response)) {
    // Remove the token
    removeToken();

    window.location.href = '/';
  }
}

export const tryLogin = async (email: string, password: string) => {
  try {
    const response = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email: email, password: password }),
      credentials: 'include'  // Include cookies in request/response
    });
    
    if (!response.ok) { 
      // Throw if login fails for any reason
      throw new Error(`Response status: ${response.status}`);
    }

    const json = await response.json();
    
    // Store user info (but not token - that's in httponly cookie now)
    localStorage.setItem('user', JSON.stringify(json));
    //console.log("Logged in:", json);

    return json;
  } catch (error) {
    // Login is wrong
    console.error(error);
    // window.location.href = '/';
  }

  return false
}

export const tryRegister = async (name: string, email: string, password: string) => {
  try {
    const response = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      body: JSON.stringify({
        name,
        email,
        password
      }),
      headers: {
        'Content-Type': 'application/json'
      },
    });
    if (!response.ok) {
      throw new Error(`Response status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error(error);
  }
}

export const getCurrentUser = async () => {
  const response = await fetch(`${BASE_URL}/user/`, {
    method: 'GET',
    credentials: 'include'
  });

  maybeHandleExpire(response);

  if (!response.ok) {
    throw new Error(`Failed to fetch current user: ${response.status} ${response.statusText}`);
  }

  return await response.json();
}

export const getCurrentUserPhotoUrl = (cacheBuster?: string | number) => {
  const suffix = cacheBuster ? `?v=${encodeURIComponent(String(cacheBuster))}` : ''
  return `${BASE_URL}/user/photo${suffix}`
}

export const uploadCurrentUserPhoto = async (file: File) => {
  const formData = new FormData()
  formData.append('file', file)

  const response = await fetch(`${BASE_URL}/user/photo`, {
    method: 'POST',
    body: formData,
    credentials: 'include',
  })

  maybeHandleExpire(response)

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.msg || `Failed to upload photo: ${response.status}`)
  }

  return await response.json().catch(() => ({}))
}

export const deleteAssignment = async (assignmentId: number) => {
  const response = await fetch(`${BASE_URL}/assignment/delete_assignment/${assignmentId}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include'
  });

  maybeHandleExpire(response);

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.msg || `Failed to delete assignment: ${response.status}`);
  }

  return await response.json();
};

export const createClass = async (name: string) => {
  const response = await fetch(`${BASE_URL}/class/create_class`, {
    method: 'POST',
    body: JSON.stringify({
      name,
    }),
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include'  // Include cookies (JWT token)
  })

  maybeHandleExpire(response);

  if (!response.ok) {
    throw new Error(`Response status: ${response.status}`);
  }
  return response
}

export const listClasses = async () => {
  // TODO get session info and whatnot
  const resp = await fetch(`${BASE_URL}/class/classes`, {
    method: 'GET',
    credentials: 'include'  // Include cookies (JWT token)
  })

  maybeHandleExpire(resp);

  if (!resp.ok) {
    throw new Error(`Response status: ${resp.status}`);
  }

  return await resp.json()
}

export const searchClasses = async (query: string) => {
  const resp = await fetch(`${BASE_URL}/class/search?q=${encodeURIComponent(query)}`, {
    method: 'GET',
    credentials: 'include'
  })

  maybeHandleExpire(resp);

  if (!resp.ok) {
    throw new Error(`Response status: ${resp.status}`);
  }

  return await resp.json();
}

export const importStudentsForCourse = async (courseID: number, students: string) => {
  const response = await fetch(`${BASE_URL}/class/enroll_students`, {
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

  maybeHandleExpire(response);

  if (!response.ok) {
    throw new Error(`Response status: ${response.status}`);
  }
  return await response.json();  // ADD THIS LINE

}

export const enrollStudentsByEmail = async (courseID: number, emails: string) => {
  const response = await fetch(`${BASE_URL}/class/enroll_students_emails`, {
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
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.msg || `Response status: ${response.status}`)
  }

  return await response.json()
}

const assignmentsListInFlight = new Map()

export const listAssignments = async (classId: string) => {
  const existing = assignmentsListInFlight.get(classId)
  if (existing) return existing

  const request = (async () => {
    const resp = await fetch(`${BASE_URL}/assignment/` + classId, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    })

    maybeHandleExpire(resp)

    if (!resp.ok) {
      throw new Error(`Response status: ${resp.status}`)
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

export const listCourseMembers = async (classId: string) => {
  const resp = await fetch(`${BASE_URL}/class/members`, {
    method: 'POST',
    body: JSON.stringify({
      id: classId,
    }),
    headers: {
       'Content-Type': 'application/json',
    },
    credentials: 'include',
  })
  
  maybeHandleExpire(resp);

  if (!resp.ok) {
    throw new Error(`Response status: ${resp.status}`);
  }
  
  return await resp.json()
} 

// ============================================================
// COURSE GROUPS (Flask backend: /groups/*)
// ============================================================

export type CourseGroupMember = { id: number; name: string; email?: string }
export type CourseGroup = { id: number; name: string; members: CourseGroupMember[] }

export const listCourseGroups = async (courseId: number): Promise<CourseGroup[]> => {
  const resp = await fetch(`${BASE_URL}/groups/course/${courseId}`, {
    method: 'GET',
    credentials: 'include',
  })

  maybeHandleExpire(resp)

  if (!resp.ok) {
    const errorData = await resp.json().catch(() => ({}))
    throw new Error(errorData.msg || `Failed to list groups: ${resp.status}`)
  }

  return await resp.json()
}

export const createCourseGroup = async (
  courseId: number,
  name: string,
  memberIds: number[]
): Promise<{ msg: string; group_id: number }> => {
  const resp = await fetch(`${BASE_URL}/groups/course/${courseId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, members: memberIds }),
    credentials: 'include',
  })

  maybeHandleExpire(resp)

  const json = await resp.json().catch(() => ({}))
  if (!resp.ok) {
    throw new Error(json.msg || `Failed to create group: ${resp.status}`)
  }

  return json
}

export const getMyCourseGroup = async (courseId: number): Promise<{ group: CourseGroup | null; multiple?: boolean }> => {
  const resp = await fetch(`${BASE_URL}/groups/course/${courseId}/my`, {
    method: 'GET',
    credentials: 'include',
  })

  maybeHandleExpire(resp)

  const json = await resp.json().catch(() => ({}))
  if (!resp.ok) {
    throw new Error(json.msg || `Failed to fetch my group: ${resp.status}`)
  }

  return json
}

export const addCourseGroupMember = async (groupId: number, userId: number): Promise<CourseGroup> => {
  const resp = await fetch(`${BASE_URL}/groups/${groupId}/members`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId }),
    credentials: 'include',
  })

  maybeHandleExpire(resp)

  const json = await resp.json().catch(() => ({}))
  if (!resp.ok) {
    throw new Error(json.msg || `Failed to add group member: ${resp.status}`)
  }

  return json
}

export const removeCourseGroupMember = async (groupId: number, userId: number): Promise<CourseGroup> => {
  const resp = await fetch(`${BASE_URL}/groups/${groupId}/members/${userId}`, {
    method: 'DELETE',
    credentials: 'include',
  })

  maybeHandleExpire(resp)

  const json = await resp.json().catch(() => ({}))
  if (!resp.ok) {
    throw new Error(json.msg || `Failed to remove group member: ${resp.status}`)
  }

  return json
}

export const deleteCourseGroup = async (groupId: number): Promise<{ msg?: string }> => {
  const resp = await fetch(`${BASE_URL}/groups/${groupId}`, {
    method: 'DELETE',
    credentials: 'include',
  })

  maybeHandleExpire(resp)

  const json = await resp.json().catch(() => ({}))
  if (!resp.ok) {
    throw new Error(json.msg || `Failed to delete group: ${resp.status}`)
  }

  return json
}

export const removeCourseMember = async (classId: number, userId: number) => {
  const resp = await fetch(`${BASE_URL}/class/remove_member`, {
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

  const json = await resp.json().catch(() => ({}))
  if (!resp.ok) {
    throw new Error(json.msg || `Response status: ${resp.status}`)
  }
  return json
}




export const listGroupMembers = async (assignmentId : number, groupID: number) => {
  const resp = await fetch(`${BASE_URL}/list_group_members/` + assignmentId + '/' + groupID, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
   },
    credentials: 'include',
  })

  maybeHandleExpire(resp);

  if (!resp.ok) {
    throw new Error(`Response status: ${resp.status}`);
  }
  
  return await resp.json()
} 

export const getUserId = async () => {
  const resp = await fetch(`${BASE_URL}/user_id`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
   },
    credentials: 'include',
  })

  maybeHandleExpire(resp);

  if (!resp.ok) {
    throw new Error(`Response status: ${resp.status}`);
  }
  
  return await resp.json()
} 

export const saveGroups = async (groupID: number, userID: number, assignmentID : number) =>{
  await fetch(`${BASE_URL}/save_groups`, {
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

export const getCriteria = async (assignmentID: number) => {
  const resp = await fetch(`${BASE_URL}/review/criteria/${assignmentID}`, {
    credentials: 'include'
  })

  maybeHandleExpire(resp);

  if (!resp.ok) {
    throw new Error(`Response status: ${resp.status}`);
  }

  return await resp.json()
}

const rubricCriteriaInFlight = new Map()

export const getRubricCriteria = async (assignmentID: number) => {
  const existing = rubricCriteriaInFlight.get(assignmentID)
  if (existing) return existing

  const request = (async () => {
    const resp = await fetch(`${BASE_URL}/get_criteria/${assignmentID}`, {
      credentials: 'include'
    })

    maybeHandleExpire(resp)

    if (!resp.ok) {
      throw new Error(`Response status: ${resp.status}`)
    }

    return await resp.json()
  })()

  rubricCriteriaInFlight.set(assignmentID, request)
  request.finally(() => rubricCriteriaInFlight.delete(assignmentID))
  return request
}

export const createCriteria = async (rubricID: number, question: string, scoreMax: number, canComment: boolean, hasScore: boolean = true) => {
  const response = await fetch(`${BASE_URL}/create_criteria`, {
    method: 'POST',
    body: JSON.stringify({
      rubricID, question, scoreMax, canComment, hasScore
    }),
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include'
  })

  maybeHandleExpire(response);

  if (!response.ok) {
    throw new Error(`Response status: ${response.status}`);
  }
}

export const createRubric = async (id: number, assignmentID: number, canComment: boolean): Promise<{ id: number }> => {
  const response = await fetch(`${BASE_URL}/create_rubric`, {
    method: 'POST',
    body: JSON.stringify({
      id, assignmentID, canComment
    }),
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include'
  })

  maybeHandleExpire(response);

  if (!response.ok) {
    throw new Error(`Response status: ${response.status}`);
  }

  return await response.json();
}

export const getRubricForAssignment = async (assignmentId: number) => {
  const resp = await fetch(`${BASE_URL}/get_rubric/${assignmentId}`, {
    credentials: 'include'
  })

  maybeHandleExpire(resp)

  if (!resp.ok) {
    throw new Error(`Response status: ${resp.status}`)
  }

  return await resp.json()
}

export const deleteCriteriaDescription = async (criteriaId: number) => {
  const resp = await fetch(`${BASE_URL}/delete_criteria/${criteriaId}`, {
    method: 'DELETE',
    credentials: 'include'
  })

  maybeHandleExpire(resp)

  if (!resp.ok) {
    const errorData = await resp.json().catch(() => ({}))
    throw new Error(errorData.msg || `Response status: ${resp.status}`)
  }

  return await resp.json().catch(() => ({}))
}

export const updateCriteriaDescription = async (
  criteriaId: number,
  payload: { question?: string; scoreMax?: number; hasScore?: boolean }
) => {
  const resp = await fetch(`${BASE_URL}/update_criteria/${criteriaId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
  })

  maybeHandleExpire(resp)

  if (!resp.ok) {
    const errorData = await resp.json().catch(() => ({}))
    throw new Error(errorData.msg || `Response status: ${resp.status}`)
  }

  return await resp.json().catch(() => ({}))
}

// ============================================================
// REVIEW ENDPOINTS - Student Peer Review Features
// ============================================================

/**
 * Get all reviews assigned to the current user for a specific assignment
 */
const assignedReviewsInFlight = new Map()

export const getAssignedReviews = async (assignmentId: number) => {
  const key = Number(assignmentId)
  const existing = assignedReviewsInFlight.get(key)
  if (existing) return existing

  const request = (async () => {
    const response = await fetch(`${BASE_URL}/review/assigned/${assignmentId}`, {
      method: 'GET',
      credentials: 'include'
    });

    maybeHandleExpire(response);

    if (!response.ok) {
      throw new Error(`Response status: ${response.status}`);
    }

    return await response.json();
  })()

  assignedReviewsInFlight.set(key, request)
  request.finally(() => assignedReviewsInFlight.delete(key))
  return request
}

/**
 * Get the submission content for a specific review
 */
export const getReviewSubmission = async (reviewId: number) => {
  const response = await fetch(`${BASE_URL}/review/submission/${reviewId}`, {
    method: 'GET',
    credentials: 'include'
  });

  maybeHandleExpire(response);

  if (response.status === 404) {
    return { submission: null };
  }

  if (!response.ok) {
    throw new Error(`Response status: ${response.status}`);
  }

  return await response.json();
}

/**
 * Submit feedback for a peer review
 */
export const submitReviewFeedback = async (
  reviewId: number,
  criteria: { criterionRowID: number; grade: number; comments: string }[]
) => {
  const response = await fetch(`${BASE_URL}/review/submit/${reviewId}`, {
    method: 'POST',
    body: JSON.stringify({ criteria }),
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include'
  });

  maybeHandleExpire(response);

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.msg || `Response status: ${response.status}`);
  }

  return await response.json();
}

/**
 * Update an already-submitted peer review (edit without unsubmit)
 */
export const updateReviewFeedback = async (
  reviewId: number,
  criteria: { criterionRowID: number; grade: number; comments: string }[]
) => {
  const response = await fetch(`${BASE_URL}/review/update/${reviewId}`, {
    method: 'POST',
    body: JSON.stringify({ criteria }),
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include'
  });

  maybeHandleExpire(response);

  if (!response.ok) {
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const errorData = await response.json().catch(() => ({} as any));
      throw new Error(errorData.msg || `Response status: ${response.status}`);
    }

    await response.text().catch(() => '');
    throw new Error(`Request failed: ${response.status} ${response.statusText}`);
  }

  return await response.json();
}

/**
 * Unsubmit a completed peer review so it can be edited and re-submitted
 */
export const unsubmitReviewFeedback = async (reviewId: number) => {
  const response = await fetch(`${BASE_URL}/review/unsubmit/${reviewId}`, {
    method: 'POST',
    credentials: 'include'
  });

  maybeHandleExpire(response);

  if (!response.ok) {
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const errorData = await response.json().catch(() => ({} as any));
      throw new Error(errorData.msg || `Response status: ${response.status}`);
    }

    // If the backend returns HTML (e.g., 404/500 default page), avoid JSON parse errors.
    await response.text().catch(() => '');
    throw new Error(`Request failed: ${response.status} ${response.statusText}`);
  }

  return await response.json();
}

/**
 * Get details of a specific review including all criteria
 */
export const getReviewDetails = async (reviewId: number) => {
  const response = await fetch(`${BASE_URL}/review/${reviewId}`, {
    method: 'GET',
    credentials: 'include'
  });

  maybeHandleExpire(response);

  if (!response.ok) {
    throw new Error(`Response status: ${response.status}`);
  }

  return await response.json();
}

/**
 * Create a new review assignment (teacher/admin only)
 */
export const createReviewAssignment = async (
  assignmentId: number,
  reviewerId: number,
  revieweeId: number
) => {
  const response = await fetch(`${BASE_URL}/review/create`, {
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
  });

  maybeHandleExpire(response);

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.msg || `Response status: ${response.status}`);
  }

  return await response.json();
}

/**
 * Get all reviews for an assignment (teacher/admin only)
 * Returns detailed information about all peer reviews including completion stats
 */
const allReviewsForAssignmentInFlight = new Map()

export const getAllReviewsForAssignment = async (assignmentId: number) => {
  const key = Number(assignmentId)
  const existing = allReviewsForAssignmentInFlight.get(key)
  if (existing) return existing

  const request = (async () => {
    const response = await fetch(`${BASE_URL}/review/assignment/${assignmentId}/all`, {
      method: 'GET',
      credentials: 'include'
    });

    maybeHandleExpire(response);

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.msg || `Response status: ${response.status}`);
    }

    return await response.json();
  })()

  allReviewsForAssignmentInFlight.set(key, request)
  request.finally(() => allReviewsForAssignmentInFlight.delete(key))
  return request
}

/**
 * Get feedback received by the current student for a specific assignment.
 * Returns completed peer reviews where the student is the reviewee,
 * with grades and comments for each criterion. Reviewer identity is anonymous.
 */
const receivedFeedbackInFlight = new Map()

export const getReceivedFeedback = async (assignmentId: number) => {
  const key = Number(assignmentId)
  const existing = receivedFeedbackInFlight.get(key)
  if (existing) return existing

  const request = (async () => {
    const response = await fetch(`${BASE_URL}/review/received/${assignmentId}`, {
      method: 'GET',
      credentials: 'include'
    });

    maybeHandleExpire(response);

    if (!response.ok) {
      throw new Error(`Response status: ${response.status}`);
    }

    return await response.json();
  })()

  receivedFeedbackInFlight.set(key, request)
  request.finally(() => receivedFeedbackInFlight.delete(key))
  return request
}

export const getRubric = async (rubricID: number) => {
  const resp = await fetch(`${BASE_URL}/rubric?rubricID=${rubricID}`, {
      credentials: 'include'
  });

  maybeHandleExpire(resp);

  if (!resp.ok) {
      throw new Error(`Response status: ${resp.status}`);
  }

  return await resp.json();
}

const assignmentDetailsInFlight = new Map()
const assignmentDetailsCache = new Map()

const assignmentDetailsStorageKey = (assignmentId: number) => `assignmentDetails:${assignmentId}`

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

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
    const resp = await fetch(`${BASE_URL}/assignment/details/${assignmentId}`, {
      credentials: 'include'
    })

    maybeHandleExpire(resp)

    if (!resp.ok) {
      throw new Error(`Response status: ${resp.status}`)
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

export const getMySubmission = async (assignmentId: number) => {
  const resp = await fetch(`${BASE_URL}/assignment/my_submission/${assignmentId}`, {
    credentials: 'include'
  })

  maybeHandleExpire(resp)

  if (resp.status === 403) {
    const errorData = await resp.json().catch(() => ({}))
    return { submission: null, forbidden: true, msg: errorData.msg }
  }

  if (!resp.ok) {
    const errorData = await resp.json().catch(() => ({}))
    throw new Error(errorData.msg || `Response status: ${resp.status}`)
  }

  return await resp.json()
}

export const deleteMySubmission = async (assignmentId: number) => {
  const resp = await fetch(`${BASE_URL}/assignment/my_submission/${assignmentId}`, {
    method: 'DELETE',
    credentials: 'include'
  })

  maybeHandleExpire(resp)

  if (!resp.ok) {
    const errorData = await resp.json().catch(() => ({}))
    throw new Error(errorData.msg || `Response status: ${resp.status}`)
  }

  return await resp.json()
}

export const uploadMySubmission = async (assignmentId: number, formData: FormData) => {
  const resp = await fetch(`${BASE_URL}/assignment/submit/${assignmentId}`, {
    method: 'POST',
    body: formData,
    credentials: 'include'
  })

  maybeHandleExpire(resp)

  if (!resp.ok) {
    const errorData = await resp.json().catch(() => ({}))
    throw new Error(errorData.msg || `Response status: ${resp.status}`)
  }

  return await resp.json()
}

export type PeerEvalGroupStatusResponse = {
  assignment: { id: number; name: string };
  reviewer_group: { id: number; name: string };
  submitted: boolean;
  targets: Array<{ id: number; name: string }>;
  criteria: Array<{ id: number; question: string; scoreMax: number; hasScore: boolean }>;
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
};

const groupPeerEvalStatusInFlight = new Map<number, Promise<PeerEvalGroupStatusResponse>>()

export const getGroupPeerEvalStatus = async (assignmentId: number): Promise<PeerEvalGroupStatusResponse> => {
  const key = Number(assignmentId)
  const existing = groupPeerEvalStatusInFlight.get(key)
  if (existing) return existing

  const request: Promise<PeerEvalGroupStatusResponse> = (async () => {
    const resp = await fetch(`${BASE_URL}/peer_eval/group/status/${assignmentId}`, {
      credentials: 'include'
    })

    maybeHandleExpire(resp)

    if (!resp.ok) {
      const errorData = await resp.json().catch(() => ({}))
      throw new Error(errorData.msg || `Response status: ${resp.status}`)
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
  const resp = await fetch(`${BASE_URL}/peer_eval/group/submit/${assignmentId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ evaluations }),
    credentials: 'include'
  })

  maybeHandleExpire(resp)

  if (!resp.ok) {
    const errorData = await resp.json().catch(() => ({}))
    throw new Error(errorData.msg || `Response status: ${resp.status}`)
  }

  return await resp.json()
}

export const unsubmitGroupPeerEval = async (assignmentId: number) => {
  const resp = await fetch(`${BASE_URL}/peer_eval/group/unsubmit/${assignmentId}`, {
    method: 'POST',
    credentials: 'include'
  })

  maybeHandleExpire(resp)

  if (!resp.ok) {
    const contentType = resp.headers.get('content-type') || ''
    if (contentType.includes('application/json')) {
      const errorData = await resp.json().catch(() => ({} as any))
      throw new Error(errorData.msg || `Response status: ${resp.status}`)
    }

    await resp.text().catch(() => '')
    throw new Error(`Request failed: ${resp.status} ${resp.statusText}`)
  }

  return await resp.json()
}

export const updateGroupPeerEval = async (assignmentId: number, evaluations: PeerEvalGroupEvaluation[]) => {
  const resp = await fetch(`${BASE_URL}/peer_eval/group/update/${assignmentId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ evaluations }),
    credentials: 'include'
  })

  maybeHandleExpire(resp)

  if (!resp.ok) {
    const contentType = resp.headers.get('content-type') || ''
    if (contentType.includes('application/json')) {
      const errorData = await resp.json().catch(() => ({} as any))
      throw new Error(errorData.msg || `Response status: ${resp.status}`)
    }

    await resp.text().catch(() => '')
    throw new Error(`Request failed: ${resp.status} ${resp.statusText}`)
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
      hasScore: boolean;
      grade: number | null;
      comments: string | null;
    }>;
  }>;
  total_reviews: number;
}

export const getReceivedGroupPeerEvalFeedback = async (assignmentId: number): Promise<PeerEvalGroupReceivedResponse> => {
  const resp = await fetch(`${BASE_URL}/peer_eval/group/received/${assignmentId}`, {
    credentials: 'include'
  })

  maybeHandleExpire(resp)

  if (!resp.ok) {
    const errorData = await resp.json().catch(() => ({}))
    throw new Error(errorData.msg || `Response status: ${resp.status}`)
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
        hasScore: boolean;
        grade: number | null;
        comments: string | null;
      }>;
    }>;
  }>;
  total_submissions: number;
}

export const getTeacherGroupPeerEvalOverview = async (assignmentId: number): Promise<TeacherGroupPeerEvalOverviewResponse> => {
  const resp = await fetch(`${BASE_URL}/peer_eval/group/assignment/${assignmentId}/all`, {
    credentials: 'include'
  })

  maybeHandleExpire(resp)

  if (!resp.ok) {
    const errorData = await resp.json().catch(() => ({}))
    throw new Error(errorData.msg || `Response status: ${resp.status}`)
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
  const resp = await fetch(`${BASE_URL}/peer_eval/group/assignment/${assignmentId}/summary`, {
    credentials: 'include'
  })

  maybeHandleExpire(resp)

  if (!resp.ok) {
    const errorData = await resp.json().catch(() => ({}))
    throw new Error(errorData.msg || `Response status: ${resp.status}`)
  }

  return await resp.json()
}

export const syncIndividualPeerEvalReviews = async (assignmentId: number) => {
  const resp = await fetch(`${BASE_URL}/peer_eval/individual/sync/${assignmentId}`, {
    method: 'POST',
    credentials: 'include'
  })

  maybeHandleExpire(resp)

  if (!resp.ok) {
    const errorData = await resp.json().catch(() => ({}))
    throw new Error(errorData.msg || `Response status: ${resp.status}`)
  }

  return await resp.json()
}

export const listSubmissions = async (assignmentId: number) => {
  const resp = await fetch(`${BASE_URL}/assignment/submissions/${assignmentId}`, {
    credentials: 'include'
  })

  maybeHandleExpire(resp)

  if (resp.status === 403) {
    const errorData = await resp.json().catch(() => ({}))
    return { submissions: [], forbidden: true, msg: errorData.msg }
  }

  if (!resp.ok) {
    const errorData = await resp.json().catch(() => ({}))
    throw new Error(errorData.msg || `Response status: ${resp.status}`)
  }

  return await resp.json()
}

export const updateAssignmentDetails = async (assignmentId: number, formData: FormData) => {
  const tzOffset = String(new Date().getTimezoneOffset())
  const resp = await fetch(`${BASE_URL}/assignment/edit_details/${assignmentId}`, {
    method: 'PATCH',
    body: formData,
    headers: {
      'X-Timezone-Offset': tzOffset,
    },
    credentials: 'include'
  })

  maybeHandleExpire(resp)

  if (!resp.ok) {
    const errorData = await resp.json().catch(() => ({}))
    throw new Error(errorData.msg || `Response status: ${resp.status}`)
  }

  return await resp.json()
}


// typed request body for creating an assignment
export type CreateAssignmentRequest = {
  courseID: number;
  name: string;
  description?: string;
  due_date?: string;
  assignment_type?: 'standard' | 'peer_eval_group' | 'peer_eval_individual';
  included_group_ids?: number[];
  rubric_criteria?: Array<{ question: string; scoreMax?: number; hasScore?: boolean }>;
};

export async function createAssignment(
  arg1: number | CreateAssignmentRequest | FormData,
  name?: string,
  due_date?: string
) {
  const isMultipart = arg1 instanceof FormData;
  const tzOffset = String(new Date().getTimezoneOffset())

  const jsonBody: CreateAssignmentRequest | null = (() => {
    if (isMultipart) return null;
    if (typeof arg1 === 'number') {
      return { courseID: arg1, name: name || '', due_date } satisfies CreateAssignmentRequest;
    }
    return arg1 as CreateAssignmentRequest;
  })();

  const response = await fetch(`${BASE_URL}/assignment/create_assignment`, {
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
  
  maybeHandleExpire(response);

  if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.msg || `Response status: ${response.status}`);
  }

  return await response.json();
}

export const deleteGroup = async (groupID: number) => {
  await fetch(`${BASE_URL}/delete_group`, {
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

export const createReview = async (assignmentID: number, reviewerID: number, revieweeID: number) => {
  const response = await fetch(`${BASE_URL}/create_review`, {
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

  maybeHandleExpire(response);

  if (!response.ok) {
    throw new Error(`Response status: ${response.status}`);
  }
  return response
}

export const createCriterion = async (reviewID: number, criterionRowID: number, grade: number, comments: string) => {
  const response = await fetch(`${BASE_URL}/create_criterion`, {
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

  maybeHandleExpire(response);

  if (!response.ok) {
    throw new Error(`Response status: ${response.status}`);
  }
  return response
}

export const getReview = async (assignmentID: number, reviewerID: number, revieweeID: number) => {
  const resp = await fetch(`${BASE_URL}/review?assignmentID=${assignmentID}&reviewerID=${reviewerID}&revieweeID=${revieweeID}`, {
    credentials: 'include'
  })

  maybeHandleExpire(resp);

  if (!resp.ok) {
    throw new Error(`Response status: ${resp.status}`);
  }

  return resp
}

export const getNextGroupID = async(assignmentID: number)=> {
  const response = await fetch(`${BASE_URL}/next_groupid?assignmentID=${assignmentID}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include'
  })

  maybeHandleExpire(response);

  if (!response.ok) {
      throw new Error(`Response status: ${response.status}`);
  }

  return await response.json();
}

export const createGroup = async(assignmentID: number, name: string, id: number) =>{
  const response = await fetch(`${BASE_URL}/create_group`,{
    method:"POST",
    body: JSON.stringify({
      assignmentID, name, id
    }),
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include'
  })
  maybeHandleExpire(response);

  if (!response.ok) {
      throw new Error(`Response status: ${response.status}`);
  }

  return await response.json();
}

// Deprecated: use `createUserAdmin` for creating users of any role (teachers included).

// Admin - Generic Create User (any role)
export const createUserAdmin = async (name: string, email: string, password: string, role: string = 'student', mustChangePassword: boolean = false) => {
  const response = await fetch(`${BASE_URL}/admin/users/create`, {
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
  });

  maybeHandleExpire(response);

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.msg || `Response status: ${response.status}`);
  }

  return await response.json();
}

// Admin - List all users
export const listAllUsers = async () => {
  const resp = await fetch(`${BASE_URL}/admin/users`, {
    method: 'GET',
    credentials: 'include'
  });

  maybeHandleExpire(resp);

  if (!resp.ok) {
    throw new Error(`Response status: ${resp.status}`);
  }

  return await resp.json();
}

// Admin - Update user details (name/email)
export const updateUserAdmin = async (userId: number, data: { name?: string; email?: string }) => {
  const resp = await fetch(`${BASE_URL}/admin/users/${userId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include'
  });

  maybeHandleExpire(resp);

  if (!resp.ok) {
    // Some error responses may be HTML (debug pages). Clone the response
    // so we can attempt JSON parse and fall back to text without consuming
    // the original body stream twice.
    const copyForJson = resp.clone();
    const copyForText = resp.clone();
    try {
      const err = await copyForJson.json();
      throw new Error(err.msg || `Response status: ${resp.status}`);
    } catch {
      const text = await copyForText.text();
      throw new Error(text || `Response status: ${resp.status}`);
    }
  }

  return await resp.json();
}

// Admin - Update user role
export const updateUserRoleAdmin = async (userId: number, role: string) => {
  const resp = await fetch(`${BASE_URL}/admin/users/${userId}/role`, {
    method: 'PUT',
    body: JSON.stringify({ role }),
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include'
  });

  maybeHandleExpire(resp);

  if (!resp.ok) {
    const copyForJson = resp.clone();
    const copyForText = resp.clone();
    try {
      const err = await copyForJson.json();
      throw new Error(err.msg || `Response status: ${resp.status}`);
    } catch {
      const text = await copyForText.text();
      throw new Error(text || `Response status: ${resp.status}`);
    }
  }

  return await resp.json();
}

// Admin - Delete user
export const deleteUserAdmin = async (userId: number) => {
  const resp = await fetch(`${BASE_URL}/admin/users/${userId}`, {
    method: 'DELETE',
    credentials: 'include'
  });

  maybeHandleExpire(resp);

  if (!resp.ok) {
    const copyForJson = resp.clone();
    const copyForText = resp.clone();
    try {
      const err = await copyForJson.json();
      throw new Error(err.msg || `Response status: ${resp.status}`);
    } catch {
      const text = await copyForText.text();
      throw new Error(text || `Response status: ${resp.status}`);
    }
  }

  return await resp.json();
}

// User - Change Password
// NOTE: This function intentionally does NOT call maybeHandleExpire().
// The PATCH /user/password endpoint returns 401 for "wrong current password",
// which is a user-facing validation error — not an expired session. Calling
// maybeHandleExpire() here would incorrectly redirect the user to login.
export const changePassword = async (currentPassword: string, newPassword: string) => {
  const response = await fetch(`${BASE_URL}/user/password`, {
    method: 'PATCH',
    body: JSON.stringify({
      current_password: currentPassword,
      new_password: newPassword
    }),
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include'
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.msg || `Response status: ${response.status}`);
  }

  return await response.json();
}
export const joinRosterCourse = async (courseId: number) => {
  const resp = await fetch(`${BASE_URL}/class/join_course`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ course_id: courseId }),
    credentials: 'include'
  });

  maybeHandleExpire(resp);

  if (!resp.ok) {
    throw new Error(`Response status: ${resp.status}`);
  }

  return await resp.json();
};

export const getAvailableCourses = async () => {
  const resp = await fetch(`${BASE_URL}/class/available_courses`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include'
  });

  maybeHandleExpire(resp);

  if (!resp.ok) {
    throw new Error(`Response status: ${resp.status}`);
  }

  return await resp.json();
};