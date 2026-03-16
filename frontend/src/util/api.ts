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

export const listAssignments = async (classId: string) => {
  const resp = await fetch(`${BASE_URL}/assignment/`+classId, {
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

export const listStuGroup = async (assignmentId : number, studentId : number) => {
  const resp = await fetch(`${BASE_URL}/list_stu_groups/`+ assignmentId + "/" + studentId, {
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

export const listGroups = async (assignmentId : number) => {
  const resp = await fetch(`${BASE_URL}/list_all_groups/` + assignmentId, {
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

export const listUnassignedGroups = async (assignmentId : number) => {
  const resp = await fetch(`${BASE_URL}/list_ua_groups/` + assignmentId, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
   },
    credentials: 'include',
  })

  maybeHandleExpire(resp);

  return await resp.json()
}

export const listCourseMembers = async (classId: string) => {
  const resp = await fetch(`${BASE_URL}/classes/members`, {
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

// ============================================================
// REVIEW ENDPOINTS - Student Peer Review Features
// ============================================================

/**
 * Get all reviews assigned to the current user for a specific assignment
 */
export const getAssignedReviews = async (assignmentId: number) => {
  const response = await fetch(`${BASE_URL}/review/assigned/${assignmentId}`, {
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
 * Get the submission content for a specific review
 */
export const getReviewSubmission = async (reviewId: number) => {
  const response = await fetch(`${BASE_URL}/review/submission/${reviewId}`, {
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
 * Get review completion status for current user on an assignment
 */
export const getReviewStatus = async (assignmentId: number) => {
  const response = await fetch(`${BASE_URL}/review/status/${assignmentId}`, {
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
export const getAllReviewsForAssignment = async (assignmentId: number) => {
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


// typed request body for creating an assignment
export type CreateAssignmentRequest = {
  courseID: number;
  name: string;
  due_date?: string;
};

export const createAssignment = async (courseID: number, name: string, due_date?: string)=> {
  const body: CreateAssignmentRequest = { courseID, name };
  if (due_date) {
    body.due_date = due_date;
  }

  const response = await fetch(`${BASE_URL}/assignment/create_assignment`, {
    method: 'POST',
    body: JSON.stringify(body),
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
    } catch (parseErr) {
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
    } catch (parseErr) {
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
    } catch (parseErr) {
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