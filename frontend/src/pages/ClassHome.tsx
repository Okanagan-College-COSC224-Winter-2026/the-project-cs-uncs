import AssignmentCard from "../components/AssignmentCard";
import Button from "../components/Button";
import "./ClassHome.css";
import { useParams } from "react-router-dom";
import { useState, useEffect } from "react";
import { listAssignments, listClasses, createAssignment } from "../util/api";
import TabNavigation from "../components/TabNavigation";
import { importCSV } from "../util/csv";
import Textbox from "../components/Textbox";
import StatusMessage from "../components/StatusMessage";
import { isTeacher } from "../util/login";

export default function ClassHome() {
  const { id } = useParams();
  const idNew = Number(id)
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [newAssignmentName, setNewAssignmentName] = useState("");
  const [newAssignmentDueDate, setNewAssignmentDueDate] = useState("");
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
  }, []);
    
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
                  <AssignmentCard id={assignment.id}>
                    {assignment.name}
                  </AssignmentCard>
                </li>
              );
            })}
          </ul>
        </div>

        {isTeacher() ? (
          <div className="AssInputChunk">
            <span>New Assignment Name:</span>
            <Textbox
              placeholder="New Assignment..."
              onInput={setNewAssignmentName}
              className="AssignmentInput"
            />
            <span>Due Date:</span>
            <input
              type="date"
              value={newAssignmentDueDate}
              onChange={(e) => setNewAssignmentDueDate(e.target.value)}
              className="AssignmentInput"
            />
            <Button
              onClick={() =>
                tryCreateAssingment()
              }
              disabled={
                newAssignmentName.trim() === "" ||
                (newAssignmentDueDate && isNaN(Date.parse(newAssignmentDueDate)))
              }
            >
              Add
            </Button>
          </div>
        ) : null}
      </div>
    </>
  );
}
