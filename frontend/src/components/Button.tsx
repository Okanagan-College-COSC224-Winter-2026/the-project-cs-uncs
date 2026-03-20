import './Button.css'

interface Props {
  onClick?: React.MouseEventHandler<HTMLButtonElement>
  children?: React.ReactNode
  type?: 'regular' | 'secondary'
  htmlType?: 'button' | 'submit' | 'reset'
  disabled?: boolean
  className?: string
}

export default function Button(props: Props) {
  const extraClass = props.className ? ` ${props.className}` : ''
  return (
    <button
      type={props.htmlType}
      className={'Button ' + (props.disabled ? 'disabled ' : ' ') + (props.type || 'regular') + extraClass}
      onClick={props.onClick}
      disabled={props.disabled}
    >
      {props.children}
    </button>
  )
}