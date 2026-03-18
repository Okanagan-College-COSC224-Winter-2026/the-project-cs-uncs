import './Button.css'

interface Props {
  onClick?: () => void
  children?: React.ReactNode
  type?: 'regular' | 'secondary'
  disabled?: boolean
  className?: string
}

export default function Button(props: Props) {
  const extraClass = props.className ? ` ${props.className}` : ''
  return (
    <button
      className={'Button ' + (props.disabled ? 'disabled ' : ' ') + (props.type || 'regular') + extraClass}
      onClick={props.onClick}
      disabled={props.disabled}
    >
      {props.children}
    </button>
  )
}