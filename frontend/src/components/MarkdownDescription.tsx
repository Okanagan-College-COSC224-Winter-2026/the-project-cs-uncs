import type { ReactNode } from 'react'
import { useState } from 'react'
import './MarkdownDescription.css'

type ListType = 'ul' | 'ol'

const BULLET_MARKER = /^[-*+]\s+(.+)$/
const ORDERED_MARKER = /^\d+\.\s+(.+)$/
const HEADING_MARKER = /^(#{1,6})\s+(.+)$/
const FENCE_MARKER = /^```\s*([^`]*)\s*$/
const TABLE_DIVIDER = /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)+\|?\s*$/
const LINK_MARKER = /^\[([^\]]+)]\(([^)]+)\)/

function CodeBlock({ code, language }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  return (
    <div className="md-code-block">
      <div className="md-code-header">
        {language && <span className="md-code-language">{language}</span>}
        <button type="button" onClick={handleCopy} className="md-code-copy" title="Copy code">
          {copied ? '✓ Copied' : 'Copy'}
        </button>
      </div>
      <pre className="md-code-pre">
        <code className={getLanguageClass(language)}>{code}</code>
      </pre>
    </div>
  )
}

function getLanguageClass(language?: string): string | undefined {
  if (!language) return undefined
  const normalized = language.trim().replace(/[^A-Za-z0-9_-]/g, '-')
  if (!normalized) return undefined
  return `language-${normalized}`
}


function isSafeLink(rawHref: string): boolean {
  const href = rawHref.trim()
  if (!href) return false

  if (href.startsWith('#') || href.startsWith('/')) {
    return true
  }

  try {
    const parsed = new URL(href)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' || parsed.protocol === 'mailto:'
  } catch {
    return false
  }
}

function parseInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = []
  let cursor = 0
  let matchIndex = 0

  const pushText = (value: string) => {
    if (value) nodes.push(value)
  }

  const closeIndex = (marker: string, from: number): number => text.indexOf(marker, from)
  const findNextTokenStart = (from: number): number => {
    for (let i = from; i < text.length; i += 1) {
      const ch = text[i]
      if (ch === '*' || ch === '_' || ch === '~' || ch === '+' || ch === '`' || ch === '[' || ch === '^') {
        return i
      }
    }
    return -1
  }

  while (cursor < text.length) {
    // Combined emphasis must be checked before ** and *.
    if (text.startsWith('***', cursor)) {
      const end = closeIndex('***', cursor + 3)
      if (end > cursor + 3) {
        const inner = text.slice(cursor + 3, end)
        nodes.push(
          <em key={`${keyPrefix}-ebi-${matchIndex}`}>
            <strong>{parseInline(inner, `${keyPrefix}-ebi-${matchIndex}`)}</strong>
          </em>
        )
        cursor = end + 3
        matchIndex += 1
        continue
      }
    }

    if (text.startsWith('**', cursor)) {
      const end = closeIndex('**', cursor + 2)
      if (end > cursor + 2) {
        const inner = text.slice(cursor + 2, end)
        nodes.push(<strong key={`${keyPrefix}-b-${matchIndex}`}>{parseInline(inner, `${keyPrefix}-b-${matchIndex}`)}</strong>)
        cursor = end + 2
        matchIndex += 1
        continue
      }
    }

    if (text.startsWith('~~', cursor)) {
      const end = closeIndex('~~', cursor + 2)
      if (end > cursor + 2) {
        const inner = text.slice(cursor + 2, end)
        nodes.push(<del key={`${keyPrefix}-s-${matchIndex}`}>{parseInline(inner, `${keyPrefix}-s-${matchIndex}`)}</del>)
        cursor = end + 2
        matchIndex += 1
        continue
      }
    }

    if (text.startsWith('++', cursor)) {
      const end = closeIndex('++', cursor + 2)
      if (end > cursor + 2) {
        const inner = text.slice(cursor + 2, end)
        nodes.push(<u key={`${keyPrefix}-u-${matchIndex}`}>{parseInline(inner, `${keyPrefix}-u-${matchIndex}`)}</u>)
        cursor = end + 2
        matchIndex += 1
        continue
      }
    }

    if (text[cursor] === '*' || text[cursor] === '_') {
      const marker = text[cursor]
      const end = closeIndex(marker, cursor + 1)
      if (end > cursor + 1) {
        const inner = text.slice(cursor + 1, end)
        nodes.push(<em key={`${keyPrefix}-i-${matchIndex}`}>{parseInline(inner, `${keyPrefix}-i-${matchIndex}`)}</em>)
        cursor = end + 1
        matchIndex += 1
        continue
      }
    }

    if (text.startsWith('^(', cursor)) {
      const end = closeIndex(')', cursor + 2)
      if (end > cursor + 2) {
        nodes.push(<sup key={`${keyPrefix}-sup-${matchIndex}`}>{text.slice(cursor + 2, end)}</sup>)
        cursor = end + 1
        matchIndex += 1
        continue
      }
    }

    if (text.startsWith('~(', cursor)) {
      const end = closeIndex(')', cursor + 2)
      if (end > cursor + 2) {
        nodes.push(<sub key={`${keyPrefix}-sub-${matchIndex}`}>{text.slice(cursor + 2, end)}</sub>)
        cursor = end + 1
        matchIndex += 1
        continue
      }
    }

    if (text[cursor] === '`') {
      const end = closeIndex('`', cursor + 1)
      if (end > cursor + 1) {
        nodes.push(<code key={`${keyPrefix}-c-${matchIndex}`}>{text.slice(cursor + 1, end)}</code>)
        cursor = end + 1
        matchIndex += 1
        continue
      }
    }

    if (text[cursor] === '[') {
      const linkMatch = text.slice(cursor).match(LINK_MARKER)
      if (linkMatch) {
        const fullMatch = linkMatch[0]
        const label = linkMatch[1]
        const href = linkMatch[2].trim()
        if (isSafeLink(href)) {
          nodes.push(
            <a key={`${keyPrefix}-a-${matchIndex}`} href={href} target="_blank" rel="noopener noreferrer">
              {parseInline(label, `${keyPrefix}-a-${matchIndex}`)}
            </a>
          )
        } else {
          pushText(fullMatch)
        }
        cursor += fullMatch.length
        matchIndex += 1
        continue
      }
    }

    const next = findNextTokenStart(cursor + 1)
    if (next === -1) {
      pushText(text.slice(cursor))
      cursor = text.length
    } else {
      pushText(text.slice(cursor, next))
      cursor = next
    }
  }

  return nodes.length > 0 ? nodes : [text]
}

function parseTableRow(row: string): string[] {
  return row
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim())
}

function parseTable(lines: string[], start: number): { nextIndex: number; node: ReactNode } | null {
  if (start + 1 >= lines.length) return null

  const headerRow = lines[start].trim()
  const dividerRow = lines[start + 1].trim()
  if (!headerRow.includes('|') || !TABLE_DIVIDER.test(dividerRow)) return null

  const headers = parseTableRow(headerRow)
  if (!headers.length) return null

  const bodyRows: string[][] = []
  let index = start + 2
  while (index < lines.length) {
    const row = lines[index].trim()
    if (!row || !row.includes('|')) break
    bodyRows.push(parseTableRow(row))
    index += 1
  }

  return {
    nextIndex: index,
    node: (
      <table key={`table-${start}`}>
        <thead>
          <tr>{headers.map((header, idx) => <th key={`th-${start}-${idx}`}>{parseInline(header, `th-${start}-${idx}`)}</th>)}</tr>
        </thead>
        <tbody>
          {bodyRows.map((row, rIdx) => (
            <tr key={`tr-${start}-${rIdx}`}>
              {row.map((cell, cIdx) => (
                <td key={`td-${start}-${rIdx}-${cIdx}`}>{parseInline(cell, `td-${start}-${rIdx}-${cIdx}`)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    ),
  }
}

function parseList(lines: string[], start: number): { nextIndex: number; node: ReactNode } {
  const firstLine = lines[start].trim()
  const listType: ListType = ORDERED_MARKER.test(firstLine) ? 'ol' : 'ul'
  const items: ReactNode[] = []

  let index = start
  while (index < lines.length) {
    const line = lines[index].trim()
    const match = listType === 'ol' ? line.match(ORDERED_MARKER) : line.match(BULLET_MARKER)
    if (!match) break

    items.push(<li key={`li-${index}`}>{parseInline(match[1], `li-${index}`)}</li>)
    index += 1
  }

  if (listType === 'ol') {
    return { nextIndex: index, node: <ol key={`ol-${start}`}>{items}</ol> }
  }

  return { nextIndex: index, node: <ul key={`ul-${start}`}>{items}</ul> }
}

function parseMarkdown(text: string): ReactNode[] {
  const normalized = text.replace(/\r\n/g, '\n').trim()
  if (!normalized) return []

  const lines = normalized.split('\n')
  const blocks: ReactNode[] = []

  let index = 0
  while (index < lines.length) {
    const currentLine = lines[index].trim()

    if (!currentLine) {
      index += 1
      continue
    }

    const fenceMatch = currentLine.match(FENCE_MARKER)
    if (fenceMatch) {
      const language = (fenceMatch[1] ?? '').trim()
      index += 1
      const fencedLines: string[] = []
      while (index < lines.length && !FENCE_MARKER.test(lines[index].trim())) {
        fencedLines.push(lines[index])
        index += 1
      }
      if (index < lines.length) {
        index += 1
      }

      blocks.push(
        <CodeBlock key={`code-${index}`} code={fencedLines.join('\n')} language={language} />
      )
      continue
    }

    const headingMatch = currentLine.match(HEADING_MARKER)
    if (headingMatch) {
      const level = headingMatch[1].length
      const content = parseInline(headingMatch[2], `h-${index}`)
      if (level === 1) blocks.push(<h1 key={`h1-${index}`}>{content}</h1>)
      else if (level === 2) blocks.push(<h2 key={`h2-${index}`}>{content}</h2>)
      else if (level === 3) blocks.push(<h3 key={`h3-${index}`}>{content}</h3>)
      else if (level === 4) blocks.push(<h4 key={`h4-${index}`}>{content}</h4>)
      else if (level === 5) blocks.push(<h5 key={`h5-${index}`}>{content}</h5>)
      else blocks.push(<h6 key={`h6-${index}`}>{content}</h6>)
      index += 1
      continue
    }

    if (BULLET_MARKER.test(currentLine) || ORDERED_MARKER.test(currentLine)) {
      const { nextIndex, node } = parseList(lines, index)
      blocks.push(node)
      index = nextIndex
      continue
    }

    const parsedTable = parseTable(lines, index)
    if (parsedTable) {
      blocks.push(parsedTable.node)
      index = parsedTable.nextIndex
      continue
    }

    const paragraphLines: string[] = [currentLine]
    index += 1

    while (index < lines.length) {
      const nextLine = lines[index].trim()
      if (
        !nextLine
        || BULLET_MARKER.test(nextLine)
        || ORDERED_MARKER.test(nextLine)
        || HEADING_MARKER.test(nextLine)
        || FENCE_MARKER.test(nextLine)
        || parseTable(lines, index)
      ) {
        break
      }
      paragraphLines.push(nextLine)
      index += 1
    }

    blocks.push(<p key={`p-${index}`}>{parseInline(paragraphLines.join(' '), `p-${index}`)}</p>)
  }

  return blocks
}

interface MarkdownDescriptionProps {
  text: string
  className?: string
}

export default function MarkdownDescription({ text, className }: MarkdownDescriptionProps) {
  const blocks = parseMarkdown(text)
  if (!blocks.length) {
    return null
  }

  const finalClassName = `markdown-description ${className || ''}`.trim()
  return <div className={finalClassName}>{blocks}</div>
}

