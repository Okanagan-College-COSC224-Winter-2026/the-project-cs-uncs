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

  useEffect(() => {
    (async () => {
      setLoadingHeader(true);
      const resp = await listAssignments(String(id));
      const classes = await listClasses();
      const currentClass = classes.find((c: { id: number }) => c.id === Number(id));
      setAssignments(resp);
      setClassName(currentClass?.name || null);
      setLoadingHeader(false);
    })();
  }, [id]);

  const handleDeleteAssignment = async (assignmentId: number | string) => {
    if (window.confirm('Are you sure you want to delete this assignment?')) {
      try {
        await deleteAssignment(Number(assignmentId));
        setAssignments(assignments.filter(a => a.id !== assignmentId));
        setStatusType('success');
        setStatusMessage('Assignment deleted successfully!');
      } catch (error) {
        console.error('Error deleting assignment:', error);
        setStatusType('error');
        setStatusMessage('Error deleting assignment.');
      }
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
              <Button onClick={() => importCSV(id as string)}>
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
          <ul className="Assignment">
            {assignments.map((assignment) => {
              return (
                <li key={assignment.id}>
                  <AssignmentCard 
                    id={assignment.id}
                    name={assignment.name}
                    due_date={assignment.due_date}
                    assignment_type={(assignment as any).assignment_type}
                    onDelete={(isTeacher() || isAdmin()) ? handleDeleteAssignment : undefined}
                  />
                </li>
              );
            })}
          </ul>
        </div>

        {isTeacher() ? (
          <div className="AssInputChunk">
            <Button onClick={() => navigate(`/classes/${id}/create-assignment`)}>
              Create Assignment
            </Button>
          </div>
        ) : null}

      </div>
    </div>
  );
}
