import type { ReactNode } from 'react'

type ListType = 'ul' | 'ol'

const BULLET_MARKER = /^[-*+]\s+(.+)$/
const ORDERED_MARKER = /^\d+\.\s+(.+)$/
const HEADING_MARKER = /^(#{1,3})\s+(.+)$/
const INLINE_MARKER = /(\*\*([^*]+)\*\*|__([^_]+)__|\*([^*]+)\*|_([^_]+)_|`([^`]+)`|\[([^\]]+)]\(([^)]+)\))/g

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

  for (const match of text.matchAll(INLINE_MARKER)) {
    const fullMatch = match[0]
    if (!fullMatch) continue

    const start = match.index ?? 0
    if (start > cursor) {
      nodes.push(text.slice(cursor, start))
    }

    if (match[2] || match[3]) {
      nodes.push(<strong key={`${keyPrefix}-b-${matchIndex}`}>{match[2] ?? match[3]}</strong>)
    } else if (match[4] || match[5]) {
      nodes.push(<em key={`${keyPrefix}-i-${matchIndex}`}>{match[4] ?? match[5]}</em>)
    } else if (match[6]) {
      nodes.push(<code key={`${keyPrefix}-c-${matchIndex}`}>{match[6]}</code>)
    } else if (match[7] && match[8]) {
      const label = match[7]
      const href = match[8].trim()
      if (isSafeLink(href)) {
        nodes.push(
          <a key={`${keyPrefix}-a-${matchIndex}`} href={href} target="_blank" rel="noreferrer">
            {label}
          </a>
        )
      } else {
        nodes.push(fullMatch)
      }
    } else {
      nodes.push(fullMatch)
    }

    cursor = start + fullMatch.length
    matchIndex += 1
  }

  if (cursor < text.length) {
    nodes.push(text.slice(cursor))
  }

  return nodes.length > 0 ? nodes : [text]
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

    const headingMatch = currentLine.match(HEADING_MARKER)
    if (headingMatch) {
      const level = headingMatch[1].length
      const content = parseInline(headingMatch[2], `h-${index}`)
      if (level === 1) blocks.push(<h1 key={`h1-${index}`}>{content}</h1>)
      else if (level === 2) blocks.push(<h2 key={`h2-${index}`}>{content}</h2>)
      else blocks.push(<h3 key={`h3-${index}`}>{content}</h3>)
      index += 1
      continue
    }

    if (BULLET_MARKER.test(currentLine) || ORDERED_MARKER.test(currentLine)) {
      const { nextIndex, node } = parseList(lines, index)
      blocks.push(node)
      index = nextIndex
      continue
    }

    const paragraphLines: string[] = [currentLine]
    index += 1

    while (index < lines.length) {
      const nextLine = lines[index].trim()
      if (!nextLine || BULLET_MARKER.test(nextLine) || ORDERED_MARKER.test(nextLine) || HEADING_MARKER.test(nextLine)) {
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

  return <div className={className}>{blocks}</div>
}

