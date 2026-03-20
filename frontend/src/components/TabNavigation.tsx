import { useLocation, useNavigate } from 'react-router-dom'

import './TabNavigation.css'

interface Props {
  tabs: {
    label: string,
    path: string,
  }[]
}

export default function TabNavigation(props: Props) {
  const location = useLocation()
  const navigate = useNavigate()

  return (
    <div className="TabNav">
      {
        props.tabs.map(tab => {
          return (
            <div
              key={tab.path}
              className={`Tab ${tab.path === location.pathname ? 'active' : ''}`}
              onClick={() => navigate(tab.path)}
            >
              {tab.label}
            </div>
          )
        })
      }
    </div>
  )
}