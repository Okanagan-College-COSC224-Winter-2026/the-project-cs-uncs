import './Textbox.css'

interface Props {
  onInput?: (value: string) => void
  className?: string
  placeholder?: string
  type?: string
  id?: string
  value?: string
  min?: string
  max?: string
  disabled?: boolean
}

export default function Textbox(props: Props) {
  return (
    <input
      type={props.type || 'text'}
      id={props.id}
      className={'Textbox' + (props.className ? ' ' + props.className : '')}
      placeholder={props.placeholder}
      value={props.value}
      min={props.min}
      max={props.max}
      disabled={props.disabled}
      onInput={(e) => {
      e.preventDefault()
      if (!props?.onInput) {
        return
      }

      // @ts-expect-error womp womp
      props.onInput(e.target.value)
    }}
    />
  )
}