import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useRef, useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import MarkdownToolbar from '../components/MarkdownToolbar'

function TestHarness() {
  const [value, setValue] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  return (
    <>
      <MarkdownToolbar textareaRef={textareaRef} value={value} />
      <textarea
        ref={textareaRef}
        aria-label="Description"
        value={value}
        onChange={(event) => setValue(event.target.value)}
      />
    </>
  )
}

describe('MarkdownToolbar history buttons', () => {
  let queryCommandEnabledMock: ReturnType<typeof vi.fn>
  let execCommandMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    queryCommandEnabledMock = vi.fn(() => false)
    execCommandMock = vi.fn(() => true)

    Object.defineProperty(document, 'queryCommandEnabled', {
      configurable: true,
      writable: true,
      value: queryCommandEnabledMock,
    })

    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      writable: true,
      value: execCommandMock,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('disables undo and redo when no history is available', () => {
    render(<TestHarness />)

    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Redo' })).toBeDisabled()
  })

  it('updates undo and redo disabled state from command availability', async () => {
    let canUndo = false
    let canRedo = false
    queryCommandEnabledMock.mockImplementation((command: string) => {
      if (command === 'undo') return canUndo
      if (command === 'redo') return canRedo
      return false
    })

    render(<TestHarness />)

    const textarea = screen.getByRole('textbox', { name: 'Description' })
    const undoButton = screen.getByRole('button', { name: 'Undo' })
    const redoButton = screen.getByRole('button', { name: 'Redo' })

    expect(undoButton).toBeDisabled()
    expect(redoButton).toBeDisabled()

    canUndo = true
    fireEvent.input(textarea, { target: { value: 'New text' } })

    await waitFor(() => {
      expect(undoButton).toBeEnabled()
      expect(redoButton).toBeDisabled()
    })

    canRedo = true
    fireEvent.keyUp(textarea)

    await waitFor(() => {
      expect(redoButton).toBeEnabled()
    })
  })

  it('does not execute undo command when undo is disabled', async () => {
    render(<TestHarness />)

    const undoButton = screen.getByRole('button', { name: 'Undo' })
    await userEvent.click(undoButton)

    expect(execCommandMock).not.toHaveBeenCalledWith('undo')
  })
})

