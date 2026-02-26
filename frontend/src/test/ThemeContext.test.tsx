import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach } from 'vitest'
import { ThemeProvider, useTheme } from '../context/ThemeContext'

// A small helper component to expose context values in tests
function ThemeConsumer() {
  const { theme, toggleTheme } = useTheme()
  return (
    <div>
      <span data-testid="theme-value">{theme}</span>
      <button onClick={toggleTheme}>Toggle</button>
    </div>
  )
}

describe('ThemeContext', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
  })

  it('defaults to light theme when localStorage is empty', () => {
    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>
    )
    expect(screen.getByTestId('theme-value').textContent).toBe('light')
  })

  it('defaults to dark theme when localStorage has "dark"', () => {
    localStorage.setItem('theme', 'dark')
    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>
    )
    expect(screen.getByTestId('theme-value').textContent).toBe('dark')
  })

  it('toggles from light to dark on button click', async () => {
    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>
    )
    await userEvent.click(screen.getByRole('button', { name: 'Toggle' }))
    expect(screen.getByTestId('theme-value').textContent).toBe('dark')
  })

  it('toggles from dark to light on button click', async () => {
    localStorage.setItem('theme', 'dark')
    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>
    )
    await userEvent.click(screen.getByRole('button', { name: 'Toggle' }))
    expect(screen.getByTestId('theme-value').textContent).toBe('light')
  })

  it('persists theme choice to localStorage', async () => {
    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>
    )
    await userEvent.click(screen.getByRole('button', { name: 'Toggle' }))
    expect(localStorage.getItem('theme')).toBe('dark')
  })

  it('applies data-theme attribute to document root', async () => {
    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>
    )
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
    await userEvent.click(screen.getByRole('button', { name: 'Toggle' }))
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })
})
