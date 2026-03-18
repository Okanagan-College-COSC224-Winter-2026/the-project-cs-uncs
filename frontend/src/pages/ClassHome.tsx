import AssignmentCard from "../components/AssignmentCard";
import Button from "../components/Button";
import "./ClassHome.css";
import { useParams } from "react-router-dom";
import { useState, useEffect } from "react";
import { listAssignments, listClasses, createAssignment, deleteAssignment } from "../util/api";
import TabNavigation from "../components/TabNavigation";
import { importCSV } from "../util/csv";
import Textbox from "../components/Textbox";
import StatusMessage from "../components/StatusMessage";
import { isTeacher, isAdmin } from "../util/login";

export default function ClassHome() {
  const { id } = useParams();
  const idNew = Number(id)
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [newAssignmentName, setNewAssignmentName] = useState("");
  const [newAssignmentDueDate, setNewAssignmentDueDate] = useState("");
  const [className, setClassName] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
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
    
    const tryCreateAssingment = async () => {
      // client‑side validation before sending
      if (!newAssignmentName.trim()) {
        setStatusType('error');
        setStatusMessage('Assignment name is required');
        return;
      }
      if (newAssignmentDueDate) {
        const parsed = Date.parse(newAssignmentDueDate);
        if (isNaN(parsed)) {
          setStatusType('error');
          setStatusMessage('Invalid due date');
          return;
        }
      }

      try {
        setStatusMessage('');
        const response = await createAssignment(idNew, newAssignmentName, newAssignmentDueDate || undefined);
        const createdAssignment = response?.assignment;

        if (!createdAssignment?.id) {
          throw new Error('Failed to create assignment');
        }

        setAssignments((prev) => [...prev, createdAssignment]);
        setNewAssignmentName("");
        setNewAssignmentDueDate("");
        setStatusType('success');
        setStatusMessage('Assignment created successfully!');
        setShowModal(false);
      } catch (error) {
        console.error('Error creating assignment:', error);
        setStatusType('error');
        setStatusMessage('Error creating assignment.');
      }
    };
    
    return (
      <>
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
        tabs={[
          {
            label: "Home",
            path: `/classes/${id}/home`,
          },
          {
            label: "Members",
            path: `/classes/${id}/members`,
          },
        ]}
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
            <Button onClick={() => setShowModal(true)}>
              Create Assignment
            </Button>
          </div>
        ) : null}

        {showModal && (
          <div className="ModalOverlay">
            <div className="ModalContent">
              <h3>Create Assignment</h3>
              <div>
                <label htmlFor="assignment-name-input">Name:</label>
                <Textbox
                  placeholder="New Assignment..."
                  onInput={setNewAssignmentName}
                  className="AssignmentInput"
                />
              </div>
              <div>
                <label htmlFor="assignment-due-input">Due Date:</label>
                <input
                  id="assignment-due-input"
                  type="date"
                  value={newAssignmentDueDate}
                  onChange={(e) => setNewAssignmentDueDate(e.target.value)}
                  className="AssignmentInput"
                />
              </div>
              <div className="ModalButtons">
                <Button
                  onClick={() => tryCreateAssingment()}
                  disabled={
                    newAssignmentName.trim() === "" ||
                    (!!newAssignmentDueDate && isNaN(Date.parse(newAssignmentDueDate)))
                  }
                >
                  Add
                </Button>
                <Button type="secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </Button>
              </div>
              <StatusMessage message={statusMessage} type={statusType} />
            </div>
          </div>
        )}

      </div>
    </>
  );
}
