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
    <div className="TabNav" role="tablist">
      {
        props.tabs.map(tab => {
          const isActive = tab.path === location.pathname
          return (
            <button
              key={tab.path}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={`Tab ${isActive ? 'active' : ''}`}
              onClick={() => navigate(tab.path)}
            >
              {tab.label}
            </button>
          )
        })
      }
    </div>
  )
}