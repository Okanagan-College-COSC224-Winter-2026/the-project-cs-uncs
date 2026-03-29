import { useCallback, useEffect, useState } from 'react'
import {
  applyMarkdownShortcut,
  getMarkdownActiveState,
  type MarkdownActiveState,
  type MarkdownShortcut,
} from '../util/markdownShortcuts'
import './MarkdownToolbar.css'

interface MarkdownToolbarProps {
  textareaRef: { current: HTMLTextAreaElement | null }
  value: string
}

type ToolbarButtonShortcut =
  | 'bold'
  | 'italic'
  | 'underline'
  | 'strikethrough'
  | 'superscript'
  | 'subscript'
  | 'code'
  | 'bullet'
  | 'ordered'
  | 'table'
  | 'link'

interface ShortcutButton {
  id: ToolbarButtonShortcut
  label: string
  title: string
}

const buttons: ShortcutButton[] = [
  { id: 'bold', label: 'B', title: 'Bold' },
  { id: 'italic', label: 'I', title: 'Italic' },
  { id: 'underline', label: 'U', title: 'Underline' },
  { id: 'strikethrough', label: 'S', title: 'Strikethrough' },
  { id: 'superscript', label: 'Sup', title: 'Superscript' },
  { id: 'subscript', label: 'Sub', title: 'Subscript' },
  { id: 'code', label: 'Code', title: 'Inline code' },
  { id: 'bullet', label: 'Unordered', title: 'Unordered list' },
  { id: 'ordered', label: 'Ordered', title: 'Ordered list' },
  { id: 'table', label: 'Table', title: 'Insert table' },
  { id: 'link', label: 'Link', title: 'Insert link' },
]

const headingOptions: Array<{ value: 'paragraph' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'; label: string }> = [
  { value: 'paragraph', label: 'P' },
  { value: 'h1', label: 'H1' },
  { value: 'h2', label: 'H2' },
  { value: 'h3', label: 'H3' },
  { value: 'h4', label: 'H4' },
  { value: 'h5', label: 'H5' },
  { value: 'h6', label: 'H6' },
]

const defaultActiveState: MarkdownActiveState = {
  bold: false,
  italic: false,
  underline: false,
  strikethrough: false,
  superscript: false,
  subscript: false,
  code: false,
  bullet: false,
  ordered: false,
  table: false,
  link: false,
  headingLevel: 0,
  h1: false,
  h2: false,
  h3: false,
  h4: false,
  h5: false,
  h6: false,
}

function isHistoryCommandEnabled(command: 'undo' | 'redo') {
  if (typeof document.queryCommandEnabled !== 'function') {
    return false
  }

  try {
    return document.queryCommandEnabled(command)
  } catch {
    return false
  }
}

function applyTextareaEditForUndo(
  textarea: HTMLTextAreaElement,
  edit: ReturnType<typeof applyMarkdownShortcut>
) {
  textarea.focus()
  textarea.setSelectionRange(edit.replaceStart, edit.replaceEnd)

  let insertedWithExecCommand = false
  if (typeof document.execCommand === 'function') {
    try {
      insertedWithExecCommand = document.execCommand('insertText', false, edit.insertText)
    } catch {
      insertedWithExecCommand = false
    }
  }

  if (!insertedWithExecCommand) {
    textarea.setRangeText(edit.insertText, edit.replaceStart, edit.replaceEnd, 'end')
  }

  textarea.setSelectionRange(edit.nextSelectionStart, edit.nextSelectionEnd)
  textarea.dispatchEvent(new Event('input', { bubbles: true }))
}

export default function MarkdownToolbar({ textareaRef, value }: MarkdownToolbarProps) {
  const [activeState, setActiveState] = useState<MarkdownActiveState>(defaultActiveState)
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)

  const refreshActiveState = useCallback(() => {
    const textarea = textareaRef.current
    if (!textarea) {
      setActiveState(defaultActiveState)
      return
    }

    const start = textarea.selectionStart ?? 0
    const end = textarea.selectionEnd ?? start
    setActiveState(getMarkdownActiveState(value, start, end))
  }, [textareaRef, value])

  const refreshHistoryState = useCallback(() => {
    if (!textareaRef.current) {
      setCanUndo(false)
      setCanRedo(false)
      return
    }

    setCanUndo(isHistoryCommandEnabled('undo'))
    setCanRedo(isHistoryCommandEnabled('redo'))
  }, [textareaRef])

  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return

    const update = () => {
      refreshActiveState()
      refreshHistoryState()
    }
    textarea.addEventListener('select', update)
    textarea.addEventListener('keyup', update)
    textarea.addEventListener('click', update)
    textarea.addEventListener('input', update)

    refreshActiveState()
    refreshHistoryState()

    return () => {
      textarea.removeEventListener('select', update)
      textarea.removeEventListener('keyup', update)
      textarea.removeEventListener('click', update)
      textarea.removeEventListener('input', update)
    }
  }, [textareaRef, refreshActiveState, refreshHistoryState])

  useEffect(() => {
    refreshActiveState()
    refreshHistoryState()
  }, [value, refreshActiveState, refreshHistoryState])

  const handleShortcut = useCallback(
    (shortcut: MarkdownShortcut) => {
      const textarea = textareaRef.current
      if (!textarea) return

      const selectionStart = textarea.selectionStart ?? 0
      const selectionEnd = textarea.selectionEnd ?? selectionStart
      const result = applyMarkdownShortcut(value, selectionStart, selectionEnd, shortcut)

      applyTextareaEditForUndo(textarea, result)

      refreshActiveState()
      refreshHistoryState()
    },
    [textareaRef, value, refreshActiveState, refreshHistoryState]
  )

  const handleHeadingChange = useCallback(
    (value: 'paragraph' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6') => {
      handleShortcut(value)
    },
    [handleShortcut]
  )

  const selectedHeading = activeState.headingLevel === 0 ? 'paragraph' : (`h${activeState.headingLevel}` as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6')

  const handleHistoryAction = useCallback(
    (type: 'undo' | 'redo') => {
      const textarea = textareaRef.current
      if (!textarea) return
      if (type === 'undo' && !canUndo) return
      if (type === 'redo' && !canRedo) return

      textarea.focus()
      if (typeof document.execCommand === 'function') {
        try {
          document.execCommand(type)
        } catch {
          // no-op: some browsers block command; keep native shortcuts available
        }
      }
      textarea.dispatchEvent(new Event('input', { bubbles: true }))
      refreshActiveState()
      refreshHistoryState()
    },
    [textareaRef, refreshActiveState, refreshHistoryState, canUndo, canRedo]
  )

  return (
    <div className="MarkdownToolbar" role="toolbar" aria-label="Description markdown toolbar">
      <button
        type="button"
        className="MarkdownToolbarButton MarkdownToolbarIconButton"
        title="Undo"
        aria-label="Undo"
        disabled={!canUndo}
        aria-disabled={!canUndo}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => handleHistoryAction('undo')}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="MarkdownToolbarIcon"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M9 14 4 9l5-5" />
          <path d="M4 9h10a6 6 0 0 1 0 12h-1" />
        </svg>
      </button>
      <button
        type="button"
        className="MarkdownToolbarButton MarkdownToolbarIconButton"
        title="Redo"
        aria-label="Redo"
        disabled={!canRedo}
        aria-disabled={!canRedo}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => handleHistoryAction('redo')}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="MarkdownToolbarIcon"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m15 14 5-5-5-5" />
          <path d="M20 9H10a6 6 0 0 0 0 12h1" />
        </svg>
      </button>

      <label className="MarkdownToolbarHeadingLabel" htmlFor="markdown-heading-select">
        Heading
      </label>
      <div className="MarkdownToolbarHeadingControl">
        <select
          id="markdown-heading-select"
          className="MarkdownToolbarHeadingSelect"
          value={selectedHeading}
          onChange={(e) => handleHeadingChange(e.target.value as 'paragraph' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6')}
        >
          {headingOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="MarkdownToolbarHeadingChevron"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </div>

      {buttons.map((button) => {
        const isActive = activeState[button.id]
        return (
          <button
            key={button.id}
            type="button"
            className={`MarkdownToolbarButton${isActive ? ' active' : ''}`}
            title={button.title}
            aria-label={button.title}
            aria-pressed={isActive}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => handleShortcut(button.id)}
          >
            {button.label}
          </button>
        )
      })}
    </div>
  )
}
