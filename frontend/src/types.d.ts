interface Course {
  id: number;
  name: string;
  teacherID?: number;
  assignmentCount?: number;
}

interface User {
  id: number;
  name: string;
  preferred_name?: string;
  preferred_pronouns?: 'Not specified' | 'he/him' | 'she/her' | 'they/them';
  email: string;
  role: 'student' | 'teacher' | 'admin';
  must_change_password?: boolean;
}

interface StudentGroups {
  groupID: number;
  userID: number;
  assignmentID: number;
}

interface CourseGroup{
  id: number;
  name: string;
  assignmentID: number;
}

interface GroupTable {
  [key: number]: GroupTableValue[];
}

interface GroupTableValue{
  groupID: number;
  userID: number;
  assignmentID: number;
}

interface Criterion {
  rubricID: number;
  question: string;
  scoreMax: number;
}

interface Assignment {
  id: number;
  name: string;
  courseID: number;
  rubric?: string;
  due_date?: string;
  assignment_type?: 'standard' | 'peer_eval_group' | 'peer_eval_individual' | string;
  student_done?: boolean;
}

interface CourseWithAssignments extends Course {
  assignments?: Assignment[];
  assignmentCount?: number;
}