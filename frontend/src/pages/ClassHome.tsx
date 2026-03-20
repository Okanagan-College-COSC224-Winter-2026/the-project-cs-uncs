import AssignmentCard from "../components/AssignmentCard";
import BackArrow from "../components/BackArrow";
import Button from "../components/Button";
import "./ClassHome.css";
import { useNavigate, useParams } from "react-router-dom";
import { useState, useEffect } from "react";
import { listAssignments, listClasses, deleteAssignment } from "../util/api";
import TabNavigation from "../components/TabNavigation";
import { importCSV } from "../util/csv";
import StatusMessage from "../components/StatusMessage";
import { isTeacher, isAdmin } from "../util/login";

export default function ClassHome() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [className, setClassName] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [statusType, setStatusType] = useState<'error' | 'success'>('error');

  useEffect(() => {
    (async () => {
      const resp = await listAssignments(String(id));
      const classes = await listClasses();
      const currentClass = classes.find((c: { id: number }) => c.id === Number(id));
      setAssignments(resp);
      setClassName(currentClass?.name || null);
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
    
    return (
      <>
        <BackArrow />
        <div className="ClassHeader">
          <div className="ClassHeaderLeft">
            <h2>{className}</h2>
          </div>

        <div className="ClassHeaderRight">
          {isTeacher() ? (
            <Button onClick={() => importCSV(id as string)}>
              Add Students via CSV
            </Button>
          ) : null}
        </div>
      </div>

      <TabNavigation
        tabs={
          isTeacher() || isAdmin()
            ? [
                { label: "Home", path: `/classes/${id}/home` },
                { label: "Members", path: `/classes/${id}/members` },
                { label: "Groups", path: `/classes/${id}/groups` },
              ]
            : [
                { label: "Home", path: `/classes/${id}/home` },
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
    </>
  );
}
