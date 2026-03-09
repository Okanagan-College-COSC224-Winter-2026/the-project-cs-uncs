import './Textbox.css'

interface Props {
  onInput?: (value: string) => void
  className?: string
  placeholder?: string
  type?: string
  id?: string
}

export default function Textbox(props: Props) {
  return (
    <input type={props.type || 'text'} id={props.id} className={'Textbox' + (props.className ? ' ' + props.className : '')} placeholder={props.placeholder} onInput={(e) => {
      e.preventDefault()
      if (!props?.onInput) {
        return
      }

      // @ts-expect-error womp womp
      props.onInput(e.target.value)
    }} />
  )
}