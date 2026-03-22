# API Endpoint Summary

This document summarizes all API endpoints documented across the user stories and indicates which endpoints are implemented vs. proposed.

## Implemented Endpoints

### Authentication (UC28, UC29)

| Endpoint | Method | Use Case | Status | Description |
|----------|--------|----------|--------|-------------|
| `/auth/login` | POST | UC28 | ✅ Implemented | User login, returns JWT token |
| `/auth/register` | POST | UC29 | ✅ Implemented | Create new user account |
| `/auth/logout` | POST | N/A | ✅ Implemented | Logout (JWT cleanup) |

### User Management (UC30)

| Endpoint | Method | Use Case | Status | Description |
|----------|--------|----------|--------|-------------|
| `/user/` | GET | UC30 | ✅ Implemented | Get current authenticated user info |
| `/user/` | PUT | N/A | ✅ Implemented | Update current user information |
| `/user/<id>` | GET | N/A | ✅ Implemented | Get user by ID (self or admin) |
| `/user/<id>` | DELETE | N/A | ✅ Implemented | Delete user (self or admin) |
| `/user/password` | PATCH | N/A | ✅ Implemented | Changes the current user's password |

### Peer Reviews

| Endpoint | Method | Use Case | Status | Description |
|----------|--------|----------|--------|-------------|
| `/review/assigned/<assignment_id>` | GET | US1 | ✅ Implemented | Get all reviews assigned to current user for an assignment |
| `/review/submission/<review_id>` | GET | US1 | ✅ Implemented | Get submission content for a specific review |
| `/review/submit/<review_id>` | POST | US1 | ✅ Implemented | Submit feedback for a peer review |
| `/review/create` | POST | N/A | ✅ Implemented | Create new review assignment (teacher/admin only) |
| `/review/<review_id>` | GET | N/A | ✅ Implemented | Get details of a specific review with criteria |
| `/review/criteria/<assignment_id>` | GET | N/A | ✅ Implemented | Get rubric criteria for an assignment |
| `/review/assignment/<assignment_id>/all` | GET | US3 | ✅ Implemented | Get all reviews for an assignment (teacher/admin only) |

## Authentication Requirements

All protected endpoints require:

- **HTTPOnly Cookie**: JWT token is automatically included by the browser
- **Credentials**: All fetch requests must include `credentials: 'include'`
- **Admin endpoints**: User must have `role = 'admin'`

Obtain JWT token via `POST /auth/login` with valid credentials. The token is automatically stored in an HTTPOnly cookie.

# API Endpoint Summary (generated)

This summary is generated from `docs/dev-guidelines/endpoints.json` (generatedAt: 2025-10-24). It reflects the backend routes currently implemented under `backend/src/routes`.

- Source of truth for shapes and notes: `endpoints.json`
- Most endpoints are protected and require an Authorization header

## Authentication and access

- **Protected routes**: Require HTTPOnly cookie with JWT token (automatically sent by browser when `credentials: 'include'` is specified)
- **Login**: Call `POST /auth/login` with JSON body `{ email, password }` to obtain user info and set HTTPOnly cookie
- **Public routes**: `GET /ping`, `POST /auth/register`, `POST /auth/login`
- **Legacy note**: Old documentation may reference `Authorization: Bearer <token>` headers - these are no longer used

---

## Public endpoints

| Method | Path   | Headers                                   | Response                        | Notes |
|--------|--------|-------------------------------------------|----------------------------------|-------|
| POST   | `/auth/login` | `Content-Type: application/json` | `200 { role, user_id, name, msg }` or `400/401` | Sets HTTPOnly cookie with JWT token. Frontend must use `credentials: 'include'`. |
| POST   | `/auth/register` | `Content-Type: application/json` | `201 { msg, user: {...} }` or `400` | Creates student account. Body: `{ name, email, password }`. |
| GET    | `/ping` | —                                         | `{ message: 'pong!' }`          | Lightweight healthcheck. |

---

## Protected endpoints

All endpoints in this section require the HTTPOnly JWT cookie. Frontend requests must include `credentials: 'include'`.

| Method | Path | Params | Query | Body | Response | Status | Notes |
|--------|------|--------|-------|------|----------|--------|-------|
| GET | `/assignment/:class_id` | `{ class_id: number }` | — | — | `Array<Assignment>` | ✅Implemented |Returns all assignments for a course. |
| POST | `/class/members` | — | — | `{ id: number }` | `Array<User { id, name, email }>` | ✅Implemented | Uses `User_Course` to look up members. |
| GET | `/class/classes` | — | — | — | `Array<Course>` | ✅Implemented | Currently returns classes for student / Instructor |
| GET | `/class/browse_classes` | — | — | — | `Array<Course>` | ✅Implemented | Returns all classes |
| POST | `/assignment/create_assignment` | — | — | `{ courseID: number, name: string, rubric: string, due_date?: string }` | `{ msg: string, assignment: Assignment }` | ✅Implemented | Creates assignment and returns created id. |
| PATCH | `/assignment/edit_assignment/:assignment_id` | `{ assignment_id: string }` | — | `{ name: string, rubric: string, due_date: string }` | `{ msg: string, assignment: Assignment }` | ✅Implemented | Edits assignment and returns updated assignment |
| DELETE | `/assignment/delete_assignment/:assignment_id` | `{ assignment_id: string }` | — | — | `{ msg: string}` | ✅Implemented | Deletes assignment and returns message |
| POST | `/class/create_class` | — | — | `{ name: string }` | `201 { message: 'Class created', id }` or `400 { message: 'Class already exists' }` | ✅Implemented | Creates a class for the given teacher |
| POST | `/rubric/create_criteria` | — | — | `{ id: number, rubricID: number, question: string, scoreMax: number }` | `{ message: string, id: number }` | Not Implemented: TODO | Creates a `Criteria_Description` row. Field `id` is taken from body. |
| POST | `/criterion/create_criterion` | — | — | `{ reviewID: number, criterionRowID: number, grade: number, comments: string }` | `{ message: string, id: number }` | Not Implemented: TODO | Creates one `Criterion` (row within a Review). |
| POST | `/group/create_group` | — | — | `{ id: number, name: string, assignmentID: number }` | `{ message: string, id: number }` | Not Implemented: TODO | Creates `CourseGroup`; route swallows DB errors and logs them. |
| POST | `/review/create_review` | — | — | `{ assignmentID: number, reviewerID: number, revieweeID: number }` | `{ message: string, id: number }` | Not Implemented: TODO | Links reviewer and reviewee for an assignment. |
| POST | `/rubric/create_rubric` | — | — | `{ id: number, assignmentID: number, canComment: boolean }` | `{ message: string, id: number }` | Not Implemented: TODO | Destroys existing rubric with same id before creating new one. |
| GET | `/rubric/criteria` | — | `{ rubricID: string }` | — | `400 if missing` or `Array<Criteria_Description>` | Not Implemented: TODO | Query param parsed with `parseInt` before DB lookup. |
| POST | `/group/delete_group` | — | — | `{ groupID: number }` | `{ message: string, id: number, groupMembers: update result }` | Not Implemented: TODO | Sets members' `groupID` to `-1` then destroys the `CourseGroup`. |
| GET | `/class/get_className/:classID` | `{ classID: number }` | — | — | `404 if not found; else { className: string }` | Not Implemented: TODO | Finds Course by id and returns its name. |
| GET | `/review/` | — | `{ assignmentID: string, reviewerID: string, revieweeID: string }` | — | `400/404` or `{ grades: number[] }` | Not Implemented: TODO | Aggregates grade fields from `Criterion` rows. |
| GET | `/rubric/` | — | `{ rubricID: string }` | — | `400/404` or `{ id, assignmentID, canComment }` | Not Implemented: TODO | Returns a simplified rubric object. |
| GET | `/group/list_all_groups/:assignmentID` | `{ assignmentID: number }` | — | — | `Array<CourseGroup>` | Not Implemented: TODO | Finds all `CourseGroup` rows where `assignmentID` matches. |
| GET | `/group/list_group_members/:assignmentID/:groupID` | `{ assignmentID: number, groupID: string }` | — | — | `Array<Group_Member>` | Not Implemented: TODO | `groupID` treated as string in route typing. |
| GET | `/group/list_stu_groups/:assignmentID/:studentID` | `{ assignmentID: number, studentID: number }` | — | — | `300 { msg: 'student has no group' }` or `Array<Group_Member>` | Not Implemented: TODO | Returns peers in the student's group. |
| GET | `/group/list_ua_groups/:assignmentID` | `{ assignmentID: number }` | — | — | `Array<Group_Member>` | Not Implemented: TODO | Unassigned students for an assignment (`groupID === -1`). |
| GET | `/group/next_groupid` | — | — | — | `number` | Not Implemented: TODO | Count of groups with `id > 0` (Sequelize `count` with `Op.gt`). |
| POST | `/group/save_groups` | — | — | `{ groupID: number, userID: number, assignmentID: number }` | `{ message: 'successful DB post!' }` or `401` | Not Implemented: TODO | Updates `Group_Member` rows to set `groupID` for a user in an assignment. |
| POST | `/class/enroll_students` | — | — | `{ class_id: number, students: string (CSV) }` | `{ msg: string }` | ✅Implemented | Enrolls specified students on the csv to the course, if student doesn't exist it creates it. TODO: change the default password to random and email it to the user. |
| GET | `/user/user_id` | — | — | — | `number` | Not Implemented: TODO | Reads `app.session[token].id`. Handler assumes session contains token; no explicit 401 check. |

---

### Notes

- Parameter types in curly braces are the expected types; some routes accept strings for numeric IDs and cast internally.
- For stability, prefer sending numeric IDs as numbers where indicated.
- If any discrepancy arises between this document and `endpoints.json`, treat `endpoints.json` as canonical.
