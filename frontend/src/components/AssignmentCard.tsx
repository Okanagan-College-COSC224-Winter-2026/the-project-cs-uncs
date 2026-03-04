import './AssignmentCard.css'

interface Props {
  onClick?: () => void
  id: number | string
  name: string
  due_date?: string
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

  return (
    <div
      onClick={() => {
        window.location.href = `/assignment/${props.id}`
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
    </div>
  )
}