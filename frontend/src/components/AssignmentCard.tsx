import './AssignmentCard.css'
import Button from './Button'

interface Props {
  onClick?: () => void
  id: number | string
  name: string
  due_date?: string
  onDelete?: (id: number | string) => void;
}

function getAssignmentStatus(dueDate?: string): { status: string; label: string; color: string } {
  if (!dueDate) {
    return { status: 'not-due', label: 'No Due Date', color: 'gray' };
  }

  const now = new Date();
  const due = new Date(dueDate);
  const daysUntilDue = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (daysUntilDue < 0) {
    return { status: 'overdue', label: 'Overdue', color: 'red' };
  } else if (daysUntilDue === 0) {
    return { status: 'due-today', label: 'Due Today', color: 'orange' };
  } else if (daysUntilDue <= 3) {
    return { status: 'due-soon', label: `Due in ${daysUntilDue} days`, color: 'yellow' };
  } else {
    return { status: 'upcoming', label: `Due in ${daysUntilDue} days`, color: 'green' };
  }
}

function formatDate(dateString?: string): string {
  if (!dateString) {
    return 'No due date';
  }

  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

export default function AssignmentCard(props: Props) {
  const statusInfo = getAssignmentStatus(props.due_date);

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent the card's onClick from firing
    if (props.onDelete) {
      props.onDelete(props.id);
    }
  };

  return (
    <div
      onClick={() => {
        if (props.onClick) {
          props.onClick();
        } else {
          window.location.href = `/assignment/${props.id}`
        }
      }}
      className='A_Card'
    >
      <img src="/icons/document.svg" alt="document" />

      <div className="A_Card_Content">
        <div className="A_Card_Name">{props.name}</div>
        <div className="A_Card_Info">
          <span className="A_Card_DueDate">{formatDate(props.due_date)}</span>
          <span className={`A_Card_Status A_Card_Status_${statusInfo.status}`}>
            {statusInfo.label}
          </span>
        </div>
      </div>
      {props.onDelete && (
        <Button
          type="secondary"
          className="delete-assignment-btn"
          onClick={handleDelete}
          htmlType="button"
        >
          Delete
        </Button>
      )}
    </div>
  )
}