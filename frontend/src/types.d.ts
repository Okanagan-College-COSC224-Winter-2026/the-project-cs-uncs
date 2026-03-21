interface Course {
  id: number;
  teacherID: number;
  name: string;
}

interface User {
  id: number;
  name: string;
  email: string;
  role: 'student' | 'teacher' | 'admin';
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
  hasScore: boolean;
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