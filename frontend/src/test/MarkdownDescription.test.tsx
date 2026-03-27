import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import MarkdownDescription from '../components/MarkdownDescription'

describe('MarkdownDescription', () => {
  it('renders bold, italic, list items, and links', () => {
    render(
      <MarkdownDescription
        text={'This has **bold** and *italic*.\n\n- One\n- Two\n\nVisit [Tabler](https://tabler.io/icons).'}
      />
    )

    expect(screen.getByText('bold').tagName).toBe('STRONG')
    expect(screen.getByText('italic').tagName).toBe('EM')
    expect(screen.getByRole('list')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Tabler' })).toHaveAttribute('href', 'https://tabler.io/icons')
  })

  it('does not turn unsafe javascript links into anchors', () => {
    render(<MarkdownDescription text={'Click [bad](javascript:alert(1))'} />)

    expect(screen.queryByRole('link', { name: 'bad' })).not.toBeInTheDocument()
    expect(screen.getByText('Click [bad](javascript:alert(1))')).toBeInTheDocument()
  })
})

