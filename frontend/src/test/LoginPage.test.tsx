import { render, screen } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import LoginPage from '../pages/LoginPage'
import { ThemeProvider } from '../context/ThemeContext'

vi.mock('../util/api', () => ({
  tryLogin: vi.fn(),
}))

function renderLoginPage(theme: 'light' | 'dark' = 'light') {
  localStorage.setItem('theme', theme)
  return render(
    <ThemeProvider>
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    </ThemeProvider>
  )
}

describe('LoginPage theme integration', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
  })

  it('renders without crashing', () => {
    renderLoginPage()
    expect(screen.getByRole('heading', { name: /login/i })).toBeInTheDocument()
  })

  it('renders inside ThemeProvider and applies light data-theme by default', () => {
    renderLoginPage('light')
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
  })

  it('applies dark data-theme attribute when dark theme is set', () => {
    renderLoginPage('dark')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })

  it('renders email and password inputs', () => {
    renderLoginPage()
    expect(screen.getByPlaceholderText(/email/i)).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/password/i)).toBeInTheDocument()
  })

  it('renders login and register buttons', () => {
    renderLoginPage()
    expect(screen.getByRole('button', { name: /login/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /register/i })).toBeInTheDocument()
  })
})
