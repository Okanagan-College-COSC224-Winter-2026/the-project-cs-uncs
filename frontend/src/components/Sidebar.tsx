import { getUserRole, logout } from '../util/login'
import { useTheme } from '../context/ThemeContext'
import './Sidebar.css'

export default function Sidebar() {
  // Check which page we are on
  const location = window.location.pathname
  const { theme, toggleTheme } = useTheme()

  const role = getUserRole()
  const dashboardLabel = role === 'teacher' ? 'Teacher Dashboard' : role === 'admin' ? 'Admin Dashboard' : role === 'student' ? 'Student Dashboard' : 'Dashboard'

  return (
    <div className="Sidebar">
      <div className="SidebarLogo">
        <img src={theme === 'dark' ? '/icons/logo_dark.svg' : '/icons/logo_light.svg'} alt="Peer Evaluation App Logo" />
      </div>

      <div className="SidebarTop">
        <SidebarRow
          onClick={() => logout()}
          href='#'
          selected={false}
        >
          Logout
        </SidebarRow>

        <SidebarRow selected={location === '/home'} href="/home">
          {dashboardLabel}
        </SidebarRow>

        <SidebarRow selected={location.includes('/profile')} href="/profile">
          My Info
        </SidebarRow>

        <SidebarRow selected={location === '/change-password'} href="/change-password">
          Change Password
        </SidebarRow>
      </div>

      <div className="SidebarBottom">
        <button
          className="ThemeToggle"
          onClick={toggleTheme}
          aria-label={theme === 'light' ? 'Toggle Theme to dark mode' : 'Toggle Theme to light mode'}
        >
          {theme === 'light' ? (
            <span title="Switch to dark mode"><img src="/icons/light-mode.svg" alt="Light mode" /></span>
          ) : (
            <span title="Switch to light mode"><img src="/icons/dark-mode.svg" alt="Dark mode" />️</span>
          )}
        </button>
      </div>
    </div>
  )
}

interface SidebarRowProps {
  selected: boolean
  href: string
  children: React.ReactNode
  onClick?: () => void
}

function SidebarRow(props: SidebarRowProps) {
  return (
    <div className={`SidebarRow ${props.selected ? 'selected' : ''}`} onClick={props.onClick}>
      <a href={props.selected ? '#' : props.href}>{props.children}</a>
    </div>
  )
}