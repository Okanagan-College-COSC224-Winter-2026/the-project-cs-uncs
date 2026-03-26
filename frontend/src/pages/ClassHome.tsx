import AssignmentCard from "../components/AssignmentCard";
import BackArrow from "../components/BackArrow";
import Button from "../components/Button";
import "./ClassHome.css";
import { useNavigate, useParams } from "react-router-dom";
import { useState, useEffect } from "react";
import { listAssignments, listClasses, deleteAssignment, enrollStudentsByEmail } from "../util/api";
import TabNavigation from "../components/TabNavigation";
import { importCSV } from "../util/csv";
import StatusMessage from "../components/StatusMessage";
import { isTeacher, isAdmin } from "../util/login";
import HeaderTitle from "../components/HeaderTitle";

export default function ClassHome() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [className, setClassName] = useState<string | null>(null);
  const [loadingHeader, setLoadingHeader] = useState(true);
  const [statusMessage, setStatusMessage] = useState('');
  const [statusType, setStatusType] = useState<'error' | 'success'>('error');
  const [showAddStudents, setShowAddStudents] = useState(false);
  const [emailsText, setEmailsText] = useState("");
  const [adding, setAdding] = useState(false);
  const [confirmDeleteAssignmentId, setConfirmDeleteAssignmentId] = useState<number | null>(null);

  const isTeacherOrAdmin = isTeacher() || isAdmin();

  useEffect(() => {
    let cancelled = false;
    let latestRequestId = 0;

    const load = async () => {
      if (!id) {
        setLoadingHeader(false);
        return;
      }

      const requestId = ++latestRequestId;
      setLoadingHeader(true);

      try {
        const [resp, classes] = await Promise.all([listAssignments(String(id)), listClasses()]);
        if (cancelled || requestId !== latestRequestId) return;

        const currentClass = classes.find((c: { id: number }) => c.id === Number(id));
        setAssignments(resp);
        setClassName(currentClass?.name || null);
      } catch (error) {
        if (cancelled || requestId !== latestRequestId) return;
        setStatusType("error");
        setStatusMessage(error instanceof Error ? error.message : "Failed to load class details.");
      } finally {
        if (!cancelled && requestId === latestRequestId) {
          setLoadingHeader(false);
        }
      }
    };

    void load();

    const onFocus = () => void load();
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") void load();
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [id]);

  const now = new Date();

  const dueDateMs = (a: Assignment): number => {
    if (!a.due_date) return Number.POSITIVE_INFINITY;
    const ms = new Date(a.due_date).getTime();
    return Number.isFinite(ms) ? ms : Number.POSITIVE_INFINITY;
  };

  const sortByDueDateAsc = (list: Assignment[]) =>
    [...list].sort((a, b) => dueDateMs(a) - dueDateMs(b));

  const teacherFinishedAssignments = isTeacherOrAdmin
    ? sortByDueDateAsc(assignments.filter((a) => a.due_date && new Date(a.due_date) < now))
    : [];
  const teacherUpcomingAssignments = isTeacherOrAdmin
    ? sortByDueDateAsc(assignments.filter((a) => !a.due_date || new Date(a.due_date) >= now))
    : [];

  const studentTodoAssignments = !isTeacherOrAdmin
    ? sortByDueDateAsc(assignments.filter((a) => !a.student_done))
    : [];
  const studentDoneAssignments = !isTeacherOrAdmin
    ? sortByDueDateAsc(assignments.filter((a) => !!a.student_done))
    : [];

  const handleDeleteAssignment = async (assignmentId: number | string) => {
    const idNum = Number(assignmentId);
    if (confirmDeleteAssignmentId !== idNum) {
      setConfirmDeleteAssignmentId(idNum);
      setStatusType('error');
      setStatusMessage('Click delete again to confirm.');
      return;
    }

    try {
      await deleteAssignment(idNum);
      setAssignments(assignments.filter((a) => a.id !== assignmentId));
      setConfirmDeleteAssignmentId(null);
      setStatusType('success');
      setStatusMessage('Assignment deleted successfully!');
    } catch (error) {
      console.error('Error deleting assignment:', error);
      setStatusType('error');
      setStatusMessage('Error deleting assignment.');
    }
  };

  const handleAddStudents = async () => {
    if (!id) return;
    if (!emailsText.trim()) {
      setStatusType('error');
      setStatusMessage('Please enter at least one email.');
      return;
    }

    try {
      setAdding(true);
      const result = await enrollStudentsByEmail(Number(id), emailsText);
      setStatusType('success');
      setStatusMessage(result.msg || 'Students added successfully!');
      setEmailsText("");
      setShowAddStudents(false);
    } catch (error) {
      setStatusType('error');
      setStatusMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setAdding(false);
    }
  };
    
    return (
      <div className="Page">
        <BackArrow />
        <div className="ClassHeader">
          <div className="ClassHeaderLeft">
            <h2>
              <HeaderTitle title={className} loading={loadingHeader} fallback="Class" />
            </h2>
          </div>

        <div className="ClassHeaderRight">
          {isTeacher() ? (
            <>
              <Button
                onClick={() =>
                  importCSV(id as string, {
                    onSuccess: (msg) => {
                      setStatusType('success');
                      setStatusMessage(msg);
                    },
                    onError: (msg) => {
                      setStatusType('error');
                      setStatusMessage(msg);
                    },
                  })
                }
              >
                Add Students via CSV
              </Button>
              <Button
                type="secondary"
                onClick={() => setShowAddStudents((v) => !v)}
                disabled={adding}
              >
                {showAddStudents ? "Cancel" : "Add Students by Email"}
              </Button>
            </>
          ) : null}
        </div>
      </div>

      {isTeacher() && showAddStudents ? (
        <div className="AddStudentsPanel">
          <label className="AddStudentsLabel">
            Student emails (comma / space / newline separated)
            <textarea
              className="AddStudentsTextarea"
              rows={4}
              value={emailsText}
              onChange={(e) => setEmailsText(e.target.value)}
              placeholder="student1@example.com, student2@example.com"
              disabled={adding}
            />
          </label>

          <div className="AddStudentsActions">
            <Button onClick={handleAddStudents} disabled={adding}>
              {adding ? "Adding..." : "Add"}
            </Button>
          </div>
        </div>
      ) : null}

      <TabNavigation
        tabs={
          isTeacher() || isAdmin()
            ? [
                { label: "Assignments", path: `/classes/${id}/home` },
                { label: "Members", path: `/classes/${id}/members` },
                { label: "Groups", path: `/classes/${id}/groups` },
              ]
            : [
                { label: "Assignments", path: `/classes/${id}/home` },
                { label: "My Group", path: `/classes/${id}/my-group` },
              ]
        }
      />

      <StatusMessage message={statusMessage} type={statusType} />

      <div className="Class">
        <div className="Assignments">
          {isTeacherOrAdmin ? (
            <>
              <h3>Finished Assignments</h3>
              <ul className="Assignment">
                {teacherFinishedAssignments.map((assignment) => (
                  <li key={assignment.id}>
                    <AssignmentCard
                      id={assignment.id}
                      name={assignment.name}
                      due_date={assignment.due_date}
                      assignment_type={assignment.assignment_type}
                      onDelete={handleDeleteAssignment}
                    />
                  </li>
                ))}
              </ul>

              <h3>Upcoming Assignments</h3>
              <ul className="Assignment">
                {teacherUpcomingAssignments.map((assignment) => (
                  <li key={assignment.id}>
                    <AssignmentCard
                      id={assignment.id}
                      name={assignment.name}
                      due_date={assignment.due_date}
                      assignment_type={assignment.assignment_type}
                      onDelete={handleDeleteAssignment}
                    />
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <>
              <h3>To-do</h3>
              <ul className="Assignment">
                {studentTodoAssignments.map((assignment) => (
                  <li key={assignment.id}>
                    <AssignmentCard
                      id={assignment.id}
                      name={assignment.name}
                      due_date={assignment.due_date}
                      assignment_type={assignment.assignment_type}
                    />
                  </li>
                ))}
              </ul>

              <h3>Done</h3>
              <ul className="Assignment">
                {studentDoneAssignments.map((assignment) => (
                  <li key={assignment.id}>
                    <AssignmentCard
                      id={assignment.id}
                      name={assignment.name}
                      due_date={assignment.due_date}
                      assignment_type={assignment.assignment_type}
                      hideDueStatus={true}
                    />
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        {isTeacher() ? (
          <Button
            className="ClassHomeCreateAssignmentButton"
            onClick={() => navigate(`/classes/${id}/create-assignment`)}
          >
            Create Assignment
          </Button>
        ) : null}

      </div>
    </div>
  );
}
