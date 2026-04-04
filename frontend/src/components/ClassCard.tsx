import './ClassCard.css'

interface Props {
  image: string
  name: string
  subtitle: string
  onclick?: () => void
  actions?: React.ReactNode
}

export default function ClassCard(props: Props) {
  return (
    <div className="ClassCard" onClick={props.onclick}>
      <img src={props.image} alt={props.name} />
      <div className="ClassInfo">
        <h2>{props.name}</h2>
        <p>{props.subtitle}</p>
        {props.actions ? <div className="ClassCardActions">{props.actions}</div> : null}
      </div>
    </div>
  )
}