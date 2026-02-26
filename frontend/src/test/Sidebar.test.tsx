import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import { ThemeProvider } from '../context/ThemeContext'

// Mock the login utility to avoid real network calls
vi.mock('../util/login', () => ({
  logout: vi.fn(),
}))

function renderSidebar() {
  return render(
    <ThemeProvider>
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>
    </ThemeProvider>
  )
}

describe('Sidebar theme toggle', () => {
  beforeEach(() => {
    localStorage.removeItem('theme')
    document.documentElement.removeAttribute('data-theme')
  })

  it('renders a theme toggle button', () => {
    renderSidebar()
    expect(screen.getByRole('button', { name: /toggle theme|dark mode|light mode/i })).toBeInTheDocument()
  })

  it('shows moon icon when in light mode', () => {
    renderSidebar()
    expect(screen.getByTitle(/switch to dark mode/i)).toBeInTheDocument()
  })

  it('shows sun icon when in dark mode', () => {
    localStorage.setItem('theme', 'dark')
    renderSidebar()
    expect(screen.getByTitle(/switch to light mode/i)).toBeInTheDocument()
  })

  it('toggles theme when button is clicked', async () => {
    renderSidebar()
    const btn = screen.getByRole('button', { name: /toggle theme|dark mode|light mode/i })
    await userEvent.click(btn)
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })
})
