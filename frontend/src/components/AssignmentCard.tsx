import './AssignmentCard.css'
import Button from './Button'
import { isAdmin, isTeacher } from '../util/login'

interface Props {
  onClick?: () => void
  id: number | string
  name: string
  due_date?: string
  assignment_type?: string
  onDelete?: (id: number | string) => void;
  hideDueStatus?: boolean
}

function getAssignmentTypeIcon(assignmentType?: string): { alt: string; cssClass: string } {
  if (assignmentType === 'peer_eval_individual') {
    return {
      alt: 'Individual peer evaluation assignment',
      cssClass: 'peer-individual'
    }
  }

  if (assignmentType === 'peer_eval_group') {
    return {
      alt: 'Group peer evaluation assignment',
      cssClass: 'peer-group'
    }
  }

  return {
    alt: 'Standard assignment',
    cssClass: 'standard'
  }
}

function getAssignmentStatus(dueDate?: string): { status: string; label: string; color: string } {
  if (!dueDate) {
    return { status: 'not-due', label: 'No Due Date', color: 'gray' };
  }

  const now = new Date();
  const due = new Date(dueDate);
  const nowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dueStart = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  const msPerDay = 1000 * 60 * 60 * 24;
  const daysUntilDue = Math.round((dueStart.getTime() - nowStart.getTime()) / msPerDay);

  if (daysUntilDue < 0) {
    return { status: 'overdue', label: 'Overdue', color: 'red' };
  } else if (daysUntilDue === 0) {
    return { status: 'due-today', label: 'Due Today', color: 'orange' };
  } else if (daysUntilDue <= 3) {
    return { status: 'due-soon', label: `Due in ${daysUntilDue} ${daysUntilDue === 1 ? 'day' : 'days'}`, color: 'yellow' };
  } else {
    return { status: 'upcoming', label: `Due in ${daysUntilDue} ${daysUntilDue === 1 ? 'day' : 'days'}`, color: 'green' };
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
  const showStatusBubble = !(isTeacher() || isAdmin()) && !props.hideDueStatus;
  const assignmentIcon = getAssignmentTypeIcon(props.assignment_type)

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
          const type = props.assignment_type ?? null
          const isPeerEval = type === 'peer_eval_group' || type === 'peer_eval_individual'

          // Students should land on Details first (not directly into Peer Review).
          // Teachers/Admins land on the Rubric route for peer-eval assignments.
          if ((isTeacher() || isAdmin()) && isPeerEval) {
            window.location.href = `/assignment/${props.id}`
          } else {
            window.location.href = `/assignment/${props.id}/details`
          }
        }
      }}
      className='A_Card'
    >
      <span
        role="img"
        aria-label={assignmentIcon.alt}
        className={`A_Card_Icon ${assignmentIcon.cssClass}`}
      />

      <div className="A_Card_Content">
        <div className="A_Card_Name">{props.name}</div>
        <div className="A_Card_Info">
          <span className="A_Card_DueDate">{formatDate(props.due_date)}</span>
          {showStatusBubble ? (
            <span className={`A_Card_Status A_Card_Status_${statusInfo.status}`}>
              {statusInfo.label}
            </span>
          ) : null}
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