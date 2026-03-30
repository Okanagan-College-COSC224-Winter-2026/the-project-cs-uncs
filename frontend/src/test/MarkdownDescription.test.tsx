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
    const link = screen.getByRole('link', { name: 'Tabler' })
    expect(link).toHaveAttribute('href', 'https://tabler.io/icons')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('does not turn unsafe javascript links into anchors', () => {
    render(<MarkdownDescription text={'Click [bad](javascript:alert(1))'} />)

    expect(screen.queryByRole('link', { name: 'bad' })).not.toBeInTheDocument()
    expect(screen.getByText('Click [bad](javascript:alert(1))')).toBeInTheDocument()
  })

  it('renders fenced code blocks and heading level 6', () => {
    render(<MarkdownDescription text={'###### Tiny heading\n\n```ts\nconst x = 1\n```'} />)

    expect(screen.getByRole('heading', { level: 6, name: 'Tiny heading' })).toBeInTheDocument()
    const code = screen.getByText('const x = 1')
    expect(code.tagName).toBe('CODE')
    expect(code).toHaveClass('language-ts')
  })

  it('renders underline, strikethrough, superscript, subscript, and tables', () => {
    render(
      <MarkdownDescription
        text={
          'Use ++underline++, ~~strike~~, x^(2), H~(2)O.\n\n| Name | Score |\n| --- | --- |\n| Ada | 10 |'
        }
      />
    )

    expect(screen.getByText('underline').tagName).toBe('U')
    expect(screen.getByText('strike').tagName).toBe('DEL')
    const twoNodes = screen.getAllByText('2')
    expect(twoNodes.some((node) => node.tagName === 'SUP')).toBe(true)
    expect(twoNodes.some((node) => node.tagName === 'SUB')).toBe(true)
    expect(screen.getByRole('table')).toBeInTheDocument()
  })

  // Rigidity/Security Tests

  describe('XSS and injection prevention', () => {
    it('blocks javascript: protocol links', () => {
      render(<MarkdownDescription text={'[Click me](javascript:alert("XSS"))'} />)
      expect(screen.queryByRole('link')).not.toBeInTheDocument()
      expect(screen.getByText(/javascript:alert/)).toBeInTheDocument()
    })

    it('blocks data: URI links', () => {
      render(<MarkdownDescription text={'[Click](data:text/html,<script>alert("xss")</script>)'} />)
      expect(screen.queryByRole('link')).not.toBeInTheDocument()
    })

    it('blocks file: protocol links', () => {
      render(<MarkdownDescription text={'[Passwd](file:///etc/passwd)'} />)
      expect(screen.queryByRole('link')).not.toBeInTheDocument()
    })

    it('blocks ftp: protocol links', () => {
      render(<MarkdownDescription text={'[Bad](ftp://example.com)'} />)
      expect(screen.queryByRole('link')).not.toBeInTheDocument()
    })

    it('blocks blob: protocol links', () => {
      render(<MarkdownDescription text={'[Bad](blob:https://example.com/abc123)'} />)
      expect(screen.queryByRole('link')).not.toBeInTheDocument()
    })

    it('treats HTML tags as plain text, not rendered elements', () => {
      render(<MarkdownDescription text={'<script>alert("xss")</script>'} />)
      expect(screen.getByText('<script>alert("xss")</script>')).toBeInTheDocument()
      expect(screen.queryByRole('button')).not.toBeInTheDocument()
      const container = screen.getByText('<script>alert("xss")</script>').parentElement
      expect(container?.innerHTML).toContain('&lt;script&gt;')
    })

    it('treats img tags with event handlers as plain text', () => {
      render(<MarkdownDescription text={'<img src=x onerror=alert("xss")>'} />)
      const text = screen.getByText(/<img src=/)
      expect(text).toBeInTheDocument()
      const container = text.parentElement
      expect(container?.innerHTML).toContain('&lt;img')
    })

    it('blocks conditional comments and IE-specific payloads', () => {
      render(<MarkdownDescription text={'<!--[if IE]><script>alert("xss")</script><![endif]-->'} />)
      expect(screen.queryByRole('button')).not.toBeInTheDocument()
    })
  })

  describe('delimiter and regex robustness', () => {
    it('handles unmatched delimiters without crashing', () => {
      expect(() => {
        render(<MarkdownDescription text={'**bold without closing'} />)
      }).not.toThrow()
      expect(screen.getByText('**bold without closing')).toBeInTheDocument()
    })

    it('handles mixed delimiters gracefully', () => {
      expect(() => {
        render(<MarkdownDescription text={'**bold *and italic**'} />)
      }).not.toThrow()
    })

    it('renders combined bold+italic for triple asterisks', () => {
      render(<MarkdownDescription text={'Mixed: ***bold and italic***'} />)
      const text = screen.getByText('bold and italic')
      expect(text.closest('strong')).toBeInTheDocument()
      expect(text.closest('em')).toBeInTheDocument()
    })

    it('renders nested formatting inside strikethrough', () => {
      render(<MarkdownDescription text={'~~strike **bold** strike~~'} />)
      const bold = screen.getByText('bold')
      expect(bold.tagName).toBe('STRONG')
      expect(bold.closest('del')).toBeInTheDocument()
    })

    it('handles nested same delimiters', () => {
      expect(() => {
        render(<MarkdownDescription text={'**bold **nested** still bold**'} />)
      }).not.toThrow()
    })

    it('handles multiple unmatched delimiters in same text', () => {
      expect(() => {
        render(<MarkdownDescription text={'*italic without closing\n~~strikethrough without closing\n`code without closing'} />)
      }).not.toThrow()
    })
  })

  describe('edge cases for links', () => {
    it('allows safe relative URLs', () => {
      render(<MarkdownDescription text={'[Relative](/path/to/page)'} />)
      const link = screen.getByRole('link', { name: 'Relative' })
      expect(link).toHaveAttribute('href', '/path/to/page')
    })

    it('allows hash links', () => {
      render(<MarkdownDescription text={'[Hash](#section)'} />)
      const link = screen.getByRole('link', { name: 'Hash' })
      expect(link).toHaveAttribute('href', '#section')
    })

    it('allows mailto links', () => {
      render(<MarkdownDescription text={'[Email](mailto:test@example.com)'} />)
      const link = screen.getByRole('link', { name: 'Email' })
      expect(link).toHaveAttribute('href', 'mailto:test@example.com')
    })

    it('allows complex URLs with query strings and fragments', () => {
      render(<MarkdownDescription text={'[Complex](https://example.com:8080/path?query=1&other=2#frag)'} />)
      const link = screen.getByRole('link', { name: 'Complex' })
      expect(link).toHaveAttribute('href', 'https://example.com:8080/path?query=1&other=2#frag')
    })

    it('handles empty link text gracefully', () => {
      expect(() => {
        render(<MarkdownDescription text={'[](https://example.com)'} />)
      }).not.toThrow()
    })

    it('handles empty href gracefully', () => {
      expect(() => {
        render(<MarkdownDescription text={'[Text]()'} />)
      }).not.toThrow()
    })

    it('handles links with whitespace in URLs', () => {
      render(<MarkdownDescription text={'[Text](https://example.com/path with spaces)'} />)
      // Links with spaces are actually allowed by the parser (URL constructor handles them)
      const link = screen.getByRole('link', { name: 'Text' })
      expect(link).toHaveAttribute('href', 'https://example.com/path with spaces')
    })
  })

  describe('heading edge cases', () => {
    it('ignores headings with too many hashes', () => {
      render(<MarkdownDescription text={'####### Seven hashes'} />)
      expect(screen.queryByRole('heading')).not.toBeInTheDocument()
      expect(screen.getByText('####### Seven hashes')).toBeInTheDocument()
    })

    it('ignores heading with only spaces', () => {
      render(<MarkdownDescription text={'#       '} />)
      expect(screen.queryByRole('heading')).not.toBeInTheDocument()
    })

    it('renders headings with inline formatting', () => {
      render(<MarkdownDescription text={'# Heading with **bold** and *italic*'} />)
      const heading = screen.getByRole('heading', { level: 1 })
      expect(heading).toBeInTheDocument()
      expect(heading.textContent).toContain('bold')
      expect(heading.textContent).toContain('italic')
    })

    it('renders headings with safe links', () => {
      render(<MarkdownDescription text={'## [Link in heading](https://example.com)'} />)
      const heading = screen.getByRole('heading', { level: 2 })
      const link = screen.getByRole('link', { name: 'Link in heading' })
      expect(heading).toContainElement(link)
    })
  })

  describe('list edge cases', () => {
    it('handles empty list items gracefully', () => {
      expect(() => {
        render(<MarkdownDescription text={'- \n* \n+ '} />)
      }).not.toThrow()
    })

    it('treats mixed list markers as same list continuation', () => {
      render(<MarkdownDescription text={'- Bullet one\n- Bullet two\n* Different marker'} />)
      // The parser treats different markers as continuation of the same list
      const lists = screen.getAllByRole('list')
      expect(lists.length).toBe(1)
    })

    it('handles ordered list starting at zero', () => {
      render(<MarkdownDescription text={'0. Item zero\n1. Item one'} />)
      expect(screen.getByRole('list')).toBeInTheDocument()
    })

    it('parses indented list items as list items', () => {
      render(<MarkdownDescription text={'- Outer\n  - Inner (still parsed as list item)'} />)
      const listItems = screen.getAllByRole('listitem')
      // Both lines match the list pattern (after .trim()), so both are list items
      expect(listItems.length).toBe(2)
    })
  })

  describe('table edge cases', () => {
    it('handles misaligned tables gracefully', () => {
      expect(() => {
        render(<MarkdownDescription text={'| A | B |\n| --- | --- |\n| 1 |'} />)
      }).not.toThrow()
    })

    it('handles tables with excessive columns', () => {
      render(<MarkdownDescription text={'| A | B | C |\n| --- | --- | --- |\n| 1 | 2 |'} />)
      expect(screen.getByRole('table')).toBeInTheDocument()
    })

    it('renders tables with special characters', () => {
      render(<MarkdownDescription text={'| **Bold** | `Code` |\n| --- | --- |\n| > | < |'} />)
      const table = screen.getByRole('table')
      expect(table).toBeInTheDocument()
      expect(screen.getByText('Bold').tagName).toBe('STRONG')
    })

    it('does not render table without proper divider', () => {
      render(<MarkdownDescription text={'| A | B |\n| not divider |\n| 1 | 2 |'} />)
      expect(screen.queryByRole('table')).not.toBeInTheDocument()
    })
  })

  describe('unicode and special characters', () => {
    it('handles emoji and unicode text', () => {
      render(<MarkdownDescription text={'🎉 Emoji test: 中文, العربية, 🚀'} />)
      expect(screen.getByText(/Emoji test/)).toBeInTheDocument()
    })

    it('treats bare special characters as plain text', () => {
      render(<MarkdownDescription text={'Some & ampersand, < less than, > greater than'} />)
      const text = screen.getByText(/ampersand/)
      expect(text).toBeInTheDocument()
      expect(text.parentElement?.innerHTML).toContain('&amp;')
    })

    it('handles unicode in inline formatting', () => {
      render(<MarkdownDescription text={'**Ñoño** *café* ~~naïve~~'} />)
      expect(screen.getByText('Ñoño').tagName).toBe('STRONG')
      expect(screen.getByText('café').tagName).toBe('EM')
      expect(screen.getByText('naïve').tagName).toBe('DEL')
    })
  })

  describe('code block edge cases', () => {
    it('handles empty code blocks', () => {
      expect(() => {
        render(<MarkdownDescription text={'```\n```'} />)
      }).not.toThrow()
    })

    it('handles language with special characters', () => {
      // Language labels with special chars still parse as fenced blocks.
      render(<MarkdownDescription text={'```javascript!@#$%\ncode\n```'} />)
      const code = screen.getByText(/code/, { selector: 'code' })
      expect(code).toBeInTheDocument()
      const copyButton = screen.getByRole('button', { name: 'Copy' })
      expect(copyButton).toHaveAttribute('title', 'Copy code')
    })

    it('handles unclosed code block gracefully', () => {
      expect(() => {
        render(<MarkdownDescription text={'```javascript\nthis code never closes'} />)
      }).not.toThrow()
    })

    it('renders code block with themeable classes instead of inline styles', () => {
      const { container } = render(<MarkdownDescription text={'```ts\nconst x = 1\n```'} />)
      const codeBlock = container.querySelector('.md-code-block')
      const codeHeader = container.querySelector('.md-code-header')
      const codePre = container.querySelector('.md-code-pre')
      const copyButton = container.querySelector('.md-code-copy')

      expect(codeBlock).toBeInTheDocument()
      expect(codeHeader).toBeInTheDocument()
      expect(codePre).toBeInTheDocument()
      expect(copyButton).toBeInTheDocument()

      expect(codeBlock).not.toHaveAttribute('style')
      expect(codeHeader).not.toHaveAttribute('style')
      expect(codePre).not.toHaveAttribute('style')
      expect(copyButton).not.toHaveAttribute('style')
    })
  })

  describe('whitespace handling', () => {
    it('handles only whitespace markdown', () => {
      render(<MarkdownDescription text={'   \n\n   '} />)
      expect(screen.queryByRole('heading')).not.toBeInTheDocument()
    })

    it('handles trailing whitespace in formatting', () => {
      const { container } = render(<MarkdownDescription text={'**bold   **'} />)
      const strong = container.querySelector('strong')
      expect(strong).toBeInTheDocument()
      expect(strong?.textContent).toMatch(/bold\s+/)
    })

    it('handles links with whitespace in URL', () => {
      render(<MarkdownDescription text={'[Label](  http://example.com  )'} />)
      const link = screen.getByRole('link', { name: 'Label' })
      expect(link).toHaveAttribute('href', 'http://example.com')
    })

    it('handles consecutive blank lines', () => {
      expect(() => {
        render(<MarkdownDescription text={'First\n\n\nSecond'} />)
      }).not.toThrow()
    })
  })

  describe('parser boundary conditions', () => {
    it('handles paragraph immediately after code block', () => {
      expect(() => {
        render(<MarkdownDescription text={'```python\ncode\n```\nNext paragraph'} />)
      }).not.toThrow()
      expect(screen.getByText('Next paragraph')).toBeInTheDocument()
    })

    it('handles paragraph immediately after heading', () => {
      expect(() => {
        render(<MarkdownDescription text={'# Heading\nNext paragraph'} />)
      }).not.toThrow()
      expect(screen.getByText('Next paragraph')).toBeInTheDocument()
    })

    it('handles paragraph immediately after list', () => {
      expect(() => {
        render(<MarkdownDescription text={'- Item 1\n- Item 2\nNext paragraph'} />)
      }).not.toThrow()
      expect(screen.getByText('Next paragraph')).toBeInTheDocument()
    })

    it('parses a fenced block after paragraph text without blank line', () => {
      render(<MarkdownDescription text={'Paragraph before code\n```python\ncode\n```\nNext paragraph'} />)
      expect(screen.getByText('Paragraph before code')).toBeInTheDocument()
      expect(screen.getByText('code', { selector: 'code' })).toBeInTheDocument()
      const copyButton = screen.getByRole('button', { name: 'Copy' })
      expect(copyButton).toHaveAttribute('title', 'Copy code')
      expect(screen.getByText('Next paragraph')).toBeInTheDocument()
    })

    it('parses a table after paragraph text without blank line', () => {
      render(<MarkdownDescription text={'Table intro\n| A | B |\n| --- | --- |\n| 1 | 2 |'} />)
      expect(screen.getByText('Table intro')).toBeInTheDocument()
      expect(screen.getByRole('table')).toBeInTheDocument()
    })
  })
})

