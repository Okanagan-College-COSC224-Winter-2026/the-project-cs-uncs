export type MarkdownShortcut =
  | 'bold'
  | 'italic'
  | 'underline'
  | 'strikethrough'
  | 'superscript'
  | 'subscript'
  | 'code'
  | 'link'
  | 'bullet'
  | 'ordered'
  | 'table'
  | 'paragraph'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'h4'
  | 'h5'
  | 'h6'

export interface MarkdownActiveState {
  bold: boolean
  italic: boolean
  underline: boolean
  strikethrough: boolean
  superscript: boolean
  subscript: boolean
  code: boolean
  link: boolean
  bullet: boolean
  ordered: boolean
  table: boolean
  headingLevel: 0 | 1 | 2 | 3 | 4 | 5 | 6
  h1: boolean
  h2: boolean
  h3: boolean
  h4: boolean
  h5: boolean
  h6: boolean
}

interface ShortcutResult {
  nextText: string
  replaceStart: number
  replaceEnd: number
  insertText: string
  nextSelectionStart: number
  nextSelectionEnd: number
}

function replaceRange(text: string, start: number, end: number, insertText: string): string {
  return text.slice(0, start) + insertText + text.slice(end)
}

const defaultTextByShortcut: Record<Exclude<MarkdownShortcut, 'bullet' | 'ordered' | 'table' | 'paragraph' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'>, string> = {
  bold: 'bold text',
  italic: 'italic text',
  underline: 'underlined text',
  strikethrough: 'struck text',
  superscript: 'superscript',
  subscript: 'subscript',
  code: 'code',
  link: 'link text',
}

const defaultHref = 'https://example.com'
const TABLE_DIVIDER = /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)+\|?\s*$/

function buildResult(
  text: string,
  replaceStart: number,
  replaceEnd: number,
  insertText: string,
  nextSelectionStart: number,
  nextSelectionEnd: number
): ShortcutResult {
  return {
    nextText: replaceRange(text, replaceStart, replaceEnd, insertText),
    replaceStart,
    replaceEnd,
    insertText,
    nextSelectionStart,
    nextSelectionEnd,
  }
}

function getLineBounds(text: string, selectionStart: number, selectionEnd: number): { lineStart: number; lineEnd: number } {
  const lineStart = text.lastIndexOf('\n', Math.max(0, selectionStart - 1)) + 1
  const nextLineBreak = text.indexOf('\n', selectionEnd)
  const lineEnd = nextLineBreak === -1 ? text.length : nextLineBreak
  return { lineStart, lineEnd }
}

function getLineBlock(text: string, selectionStart: number, selectionEnd: number): { lineStart: number; lineEnd: number; lines: string[] } {
  const { lineStart, lineEnd } = getLineBounds(text, selectionStart, selectionEnd)
  return {
    lineStart,
    lineEnd,
    lines: text.slice(lineStart, lineEnd).split('\n'),
  }
}

function isSingleAsterisk(text: string, index: number): boolean {
  return text[index] === '*' && text[index - 1] !== '*' && text[index + 1] !== '*'
}

function findWrappedRangeWithMarker(
  text: string,
  selectionStart: number,
  selectionEnd: number,
  marker: string
): { wrapperStart: number; wrapperEnd: number; markerLength: number } | null {
  const markerLength = marker.length

  if (
    selectionStart >= markerLength &&
    text.slice(selectionStart - markerLength, selectionStart) === marker &&
    text.slice(selectionEnd, selectionEnd + markerLength) === marker
  ) {
    return {
      wrapperStart: selectionStart - markerLength,
      wrapperEnd: selectionEnd + markerLength,
      markerLength,
    }
  }

  if (selectionStart !== selectionEnd) {
    return null
  }

  let openStart = text.lastIndexOf(marker, selectionStart)
  while (openStart !== -1) {
    const closeStart = text.indexOf(marker, openStart + markerLength)
    if (closeStart === -1) return null
    const innerStart = openStart + markerLength
    if (selectionStart >= innerStart && selectionStart <= closeStart) {
      return {
        wrapperStart: openStart,
        wrapperEnd: closeStart + markerLength,
        markerLength,
      }
    }
    openStart = text.lastIndexOf(marker, openStart - 1)
  }

  return null
}

function findItalicWrappedRange(
  text: string,
  selectionStart: number,
  selectionEnd: number
): { wrapperStart: number; wrapperEnd: number; markerLength: number } | null {
  if (
    selectionStart > 0 &&
    text[selectionStart - 1] === '*' &&
    isSingleAsterisk(text, selectionStart - 1) &&
    isSingleAsterisk(text, selectionEnd)
  ) {
    return {
      wrapperStart: selectionStart - 1,
      wrapperEnd: selectionEnd + 1,
      markerLength: 1,
    }
  }

  if (selectionStart !== selectionEnd) return null

  for (let open = selectionStart - 1; open >= 0; open -= 1) {
    if (!isSingleAsterisk(text, open)) continue
    for (let close = open + 1; close < text.length; close += 1) {
      if (!isSingleAsterisk(text, close)) continue
      if (selectionStart > open && selectionStart <= close) {
        return {
          wrapperStart: open,
          wrapperEnd: close + 1,
          markerLength: 1,
        }
      }
    }
  }

  return null
}

function findLinkRange(
  text: string,
  selectionStart: number,
  selectionEnd: number
): {
  wrapperStart: number
  wrapperEnd: number
  labelStart: number
  labelEnd: number
  hrefStart: number
  hrefEnd: number
} | null {
  for (let open = text.lastIndexOf('[', selectionStart); open !== -1; open = text.lastIndexOf('[', open - 1)) {
    const closeBracket = text.indexOf('](', open + 1)
    if (closeBracket === -1) continue
    const closeParen = text.indexOf(')', closeBracket + 2)
    if (closeParen === -1) continue

    const wrapperStart = open
    const wrapperEnd = closeParen + 1
    const insideForSelection = selectionStart >= open + 1 && selectionEnd <= closeParen
    const insideForCursor = selectionStart > open && selectionStart <= closeParen

    if (insideForSelection && insideForCursor) {
      return {
        wrapperStart,
        wrapperEnd,
        labelStart: open + 1,
        labelEnd: closeBracket,
        hrefStart: closeBracket + 2,
        hrefEnd: closeParen,
      }
    }
  }

  return null
}

function findWrappedRangeWithDelimiters(
  text: string,
  selectionStart: number,
  selectionEnd: number,
  prefix: string,
  suffix: string
): { wrapperStart: number; wrapperEnd: number; prefixLength: number; suffixLength: number } | null {
  const prefixLength = prefix.length
  const suffixLength = suffix.length

  if (
    selectionStart >= prefixLength &&
    text.slice(selectionStart - prefixLength, selectionStart) === prefix &&
    text.slice(selectionEnd, selectionEnd + suffixLength) === suffix
  ) {
    return {
      wrapperStart: selectionStart - prefixLength,
      wrapperEnd: selectionEnd + suffixLength,
      prefixLength,
      suffixLength,
    }
  }

  if (selectionStart !== selectionEnd) {
    return null
  }

  let openStart = text.lastIndexOf(prefix, selectionStart)
  while (openStart !== -1) {
    const closeStart = text.indexOf(suffix, openStart + prefixLength)
    if (closeStart === -1) return null
    const innerStart = openStart + prefixLength
    if (selectionStart >= innerStart && selectionStart <= closeStart) {
      return {
        wrapperStart: openStart,
        wrapperEnd: closeStart + suffixLength,
        prefixLength,
        suffixLength,
      }
    }
    openStart = text.lastIndexOf(prefix, openStart - 1)
  }

  return null
}

function stripHeadingPrefix(line: string): string {
  return line.replace(/^(\s*)#{1,6}\s+/, '$1')
}

function getHeadingLevelForLine(line: string): 0 | 1 | 2 | 3 | 4 | 5 | 6 {
  const match = line.match(/^\s*(#{1,6})\s+/)
  if (!match) return 0
  return match[1].length as 1 | 2 | 3 | 4 | 5 | 6
}

function getUniformHeadingLevel(lines: string[]): 0 | 1 | 2 | 3 | 4 | 5 | 6 {
  const nonEmptyLines = lines.filter((line) => line.trim().length > 0)
  if (!nonEmptyLines.length) return 0

  const firstLevel = getHeadingLevelForLine(nonEmptyLines[0])
  if (firstLevel === 0) return 0

  const allSame = nonEmptyLines.every((line) => getHeadingLevelForLine(line) === firstLevel)
  return allSame ? firstLevel : 0
}

function removeInlineWrapper(
  text: string,
  selectionStart: number,
  selectionEnd: number,
  wrapperStart: number,
  wrapperEnd: number,
  markerLength: number
): ShortcutResult {
  const innerStart = wrapperStart + markerLength
  const innerEnd = wrapperEnd - markerLength
  const innerText = text.slice(innerStart, innerEnd)

  let nextSelectionStart = wrapperStart
  let nextSelectionEnd = wrapperStart + innerText.length

  if (selectionStart >= innerStart && selectionEnd <= innerEnd) {
    nextSelectionStart = selectionStart - markerLength
    nextSelectionEnd = selectionEnd - markerLength
  }

  return buildResult(text, wrapperStart, wrapperEnd, innerText, nextSelectionStart, nextSelectionEnd)
}

function removeDelimitedWrapper(
  text: string,
  selectionStart: number,
  selectionEnd: number,
  wrapperStart: number,
  wrapperEnd: number,
  prefixLength: number,
  suffixLength: number
): ShortcutResult {
  const innerStart = wrapperStart + prefixLength
  const innerEnd = wrapperEnd - suffixLength
  const innerText = text.slice(innerStart, innerEnd)

  let nextSelectionStart = wrapperStart
  let nextSelectionEnd = wrapperStart + innerText.length

  if (selectionStart >= innerStart && selectionEnd <= innerEnd) {
    nextSelectionStart = selectionStart - prefixLength
    nextSelectionEnd = selectionEnd - prefixLength
  }

  return buildResult(text, wrapperStart, wrapperEnd, innerText, nextSelectionStart, nextSelectionEnd)
}

function wrapInline(
  text: string,
  selectionStart: number,
  selectionEnd: number,
  prefix: string,
  suffix: string,
  fallbackText: string
): ShortcutResult {
  const selectedText = text.slice(selectionStart, selectionEnd)
  const inner = selectedText || fallbackText
  const inserted = `${prefix}${inner}${suffix}`

  if (selectedText) {
    return buildResult(
      text,
      selectionStart,
      selectionEnd,
      inserted,
      selectionStart + prefix.length,
      selectionStart + prefix.length + selectedText.length
    )
  }

  return buildResult(
    text,
    selectionStart,
    selectionEnd,
    inserted,
    selectionStart + prefix.length,
    selectionStart + prefix.length + inner.length
  )
}

function wrapDelimited(
  text: string,
  selectionStart: number,
  selectionEnd: number,
  prefix: string,
  suffix: string,
  fallbackText: string
): ShortcutResult {
  const selectedText = text.slice(selectionStart, selectionEnd)
  const inner = selectedText || fallbackText
  const inserted = `${prefix}${inner}${suffix}`

  if (selectedText) {
    return buildResult(
      text,
      selectionStart,
      selectionEnd,
      inserted,
      selectionStart + prefix.length,
      selectionStart + prefix.length + selectedText.length
    )
  }

  return buildResult(
    text,
    selectionStart,
    selectionEnd,
    inserted,
    selectionStart + prefix.length,
    selectionStart + prefix.length + inner.length
  )
}

function applyBulletShortcut(text: string, selectionStart: number, selectionEnd: number): ShortcutResult {
  const { lineStart, lineEnd, lines } = getLineBlock(text, selectionStart, selectionEnd)
  const hasNonEmptyLine = lines.some((line) => line.trim().length > 0)
  const allBulleted =
    hasNonEmptyLine && lines.every((line) => line.trim().length === 0 || /^\s*[-*+]\s+/.test(line))

  const updatedLines = lines.map((line) => {
    if (!line.trim()) return allBulleted ? '' : '- '
    if (allBulleted) return line.replace(/^(\s*)[-*+]\s+/, '$1')
    if (/^\s*[-*+]\s+/.test(line)) return line
    return `- ${line}`
  })

  const inserted = updatedLines.join('\n')
  return buildResult(text, lineStart, lineEnd, inserted, lineStart, lineStart + inserted.length)
}

function applyOrderedShortcut(text: string, selectionStart: number, selectionEnd: number): ShortcutResult {
  const { lineStart, lineEnd, lines } = getLineBlock(text, selectionStart, selectionEnd)
  const hasNonEmptyLine = lines.some((line) => line.trim().length > 0)
  const allOrdered =
    hasNonEmptyLine && lines.every((line) => line.trim().length === 0 || /^\s*\d+\.\s+/.test(line))

  let nextNumber = 1
  const updatedLines = lines.map((line) => {
    if (!line.trim()) return allOrdered ? '' : '1. '
    if (allOrdered) return line.replace(/^(\s*)\d+\.\s+/, '$1')

    const normalized = line.replace(/^(\s*)[-*+]\s+/, '$1').replace(/^(\s*)\d+\.\s+/, '$1')
    const updated = `${nextNumber}. ${normalized}`
    nextNumber += 1
    return updated
  })

  const inserted = updatedLines.join('\n')
  return buildResult(text, lineStart, lineEnd, inserted, lineStart, lineStart + inserted.length)
}

function applyParagraphShortcut(text: string, selectionStart: number, selectionEnd: number): ShortcutResult {
  const { lineStart, lineEnd, lines } = getLineBlock(text, selectionStart, selectionEnd)
  const inserted = lines.map((line) => stripHeadingPrefix(line)).join('\n')
  return buildResult(text, lineStart, lineEnd, inserted, lineStart, lineStart + inserted.length)
}

function applyTableShortcut(text: string, selectionStart: number, selectionEnd: number): ShortcutResult {
  const { lineStart, lineEnd, lines } = getLineBlock(text, selectionStart, selectionEnd)
  const hasHeader = lines.length >= 2 && /\|/.test(lines[0]) && TABLE_DIVIDER.test(lines[1])

  if (hasHeader) {
    const cleaned = lines
      .filter((_, idx) => idx !== 1)
      .map((line) => line.replace(/^\|\s*/, '').replace(/\s*\|$/, '').replace(/\s*\|\s*/g, ' '))
    const inserted = cleaned.join('\n')
    return buildResult(text, lineStart, lineEnd, inserted, lineStart, lineStart + inserted.length)
  }

  const template = ['| Column 1 | Column 2 |', '| --- | --- |', '| Value 1 | Value 2 |'].join('\n')
  return buildResult(text, selectionStart, selectionEnd, template, selectionStart, selectionStart + template.length)
}

function isCursorInsideTable(text: string, selectionStart: number): boolean {
  const lines = text.split('\n')
  let currentLine = 0
  let offset = 0

  for (let i = 0; i < lines.length; i += 1) {
    const lineLength = lines[i].length
    if (selectionStart <= offset + lineLength) {
      currentLine = i
      break
    }
    offset += lineLength + 1
  }

  const current = lines[currentLine] ?? ''
  const prev = lines[currentLine - 1] ?? ''
  const next = lines[currentLine + 1] ?? ''

  // Accept cursor on header/body rows or the divider line itself.
  if (TABLE_DIVIDER.test(current)) {
    return /\|/.test(prev)
  }

  if (!/\|/.test(current)) return false
  return TABLE_DIVIDER.test(prev) || TABLE_DIVIDER.test(next)
}

function applyHeadingShortcut(
  text: string,
  selectionStart: number,
  selectionEnd: number,
  level: 1 | 2 | 3 | 4 | 5 | 6
): ShortcutResult {
  const marker = `${'#'.repeat(level)} `
  const { lineStart, lineEnd, lines } = getLineBlock(text, selectionStart, selectionEnd)
  const hasNonEmptyLine = lines.some((line) => line.trim().length > 0)
  const headingRegex = new RegExp(`^\\s*${'#'.repeat(level)}\\s+`)
  const allLevelHeading = hasNonEmptyLine && lines.every((line) => line.trim().length === 0 || headingRegex.test(line))

  const updatedLines = lines.map((line) => {
    if (!line.trim()) return allLevelHeading ? '' : marker
    if (allLevelHeading) {
      return line.replace(new RegExp(`^(\\s*)${'#'.repeat(level)}\\s+`), '$1')
    }

    const normalized = stripHeadingPrefix(line)
    return `${marker}${normalized}`
  })

  const inserted = updatedLines.join('\n')
  return buildResult(text, lineStart, lineEnd, inserted, lineStart, lineStart + inserted.length)
}

function applyLinkShortcut(text: string, selectionStart: number, selectionEnd: number): ShortcutResult {
  const range = findLinkRange(text, selectionStart, selectionEnd)
  if (range) {
    const label = text.slice(range.labelStart, range.labelEnd)

    let nextCursor = range.wrapperStart + label.length
    if (selectionStart >= range.labelStart && selectionStart <= range.labelEnd) {
      nextCursor = range.wrapperStart + (selectionStart - range.labelStart)
    }

    return buildResult(text, range.wrapperStart, range.wrapperEnd, label, nextCursor, nextCursor)
  }

  const selectedText = text.slice(selectionStart, selectionEnd) || defaultTextByShortcut.link
  const inserted = `[${selectedText}](${defaultHref})`
  const hrefStart = selectionStart + selectedText.length + 3
  const hrefEnd = hrefStart + defaultHref.length

  return buildResult(text, selectionStart, selectionEnd, inserted, hrefStart, hrefEnd)
}

export function getMarkdownActiveState(
  text: string,
  selectionStart: number,
  selectionEnd: number
): MarkdownActiveState {
  const { lines } = getLineBlock(text, selectionStart, selectionEnd)
  const hasNonEmptyLine = lines.some((line) => line.trim().length > 0)
  const headingLevel = getUniformHeadingLevel(lines)

  return {
    bold: findWrappedRangeWithMarker(text, selectionStart, selectionEnd, '**') !== null,
    italic: findItalicWrappedRange(text, selectionStart, selectionEnd) !== null,
    underline: findWrappedRangeWithMarker(text, selectionStart, selectionEnd, '++') !== null,
    strikethrough: findWrappedRangeWithMarker(text, selectionStart, selectionEnd, '~~') !== null,
    superscript: findWrappedRangeWithDelimiters(text, selectionStart, selectionEnd, '^(', ')') !== null,
    subscript: findWrappedRangeWithDelimiters(text, selectionStart, selectionEnd, '~(', ')') !== null,
    code: findWrappedRangeWithMarker(text, selectionStart, selectionEnd, '`') !== null,
    link: findLinkRange(text, selectionStart, selectionEnd) !== null,
    bullet:
      hasNonEmptyLine && lines.every((line) => line.trim().length === 0 || /^\s*[-*+]\s+/.test(line)),
    ordered:
      hasNonEmptyLine && lines.every((line) => line.trim().length === 0 || /^\s*\d+\.\s+/.test(line)),
    table: isCursorInsideTable(text, selectionStart),
    headingLevel,
    h1: headingLevel === 1,
    h2: headingLevel === 2,
    h3: headingLevel === 3,
    h4: headingLevel === 4,
    h5: headingLevel === 5,
    h6: headingLevel === 6,
  }
}

export function applyMarkdownShortcut(
  text: string,
  selectionStart: number,
  selectionEnd: number,
  shortcut: MarkdownShortcut
): ShortcutResult {
  const activeState = getMarkdownActiveState(text, selectionStart, selectionEnd)

  if (shortcut === 'bold') {
    if (activeState.bold) {
      const range = findWrappedRangeWithMarker(text, selectionStart, selectionEnd, '**')
      if (range) {
        return removeInlineWrapper(
          text,
          selectionStart,
          selectionEnd,
          range.wrapperStart,
          range.wrapperEnd,
          range.markerLength
        )
      }
    }
    return wrapInline(text, selectionStart, selectionEnd, '**', '**', defaultTextByShortcut.bold)
  }

  if (shortcut === 'italic') {
    if (activeState.italic) {
      const range = findItalicWrappedRange(text, selectionStart, selectionEnd)
      if (range) {
        return removeInlineWrapper(
          text,
          selectionStart,
          selectionEnd,
          range.wrapperStart,
          range.wrapperEnd,
          range.markerLength
        )
      }
    }
    return wrapInline(text, selectionStart, selectionEnd, '*', '*', defaultTextByShortcut.italic)
  }

  if (shortcut === 'underline') {
    if (activeState.underline) {
      const range = findWrappedRangeWithMarker(text, selectionStart, selectionEnd, '++')
      if (range) {
        return removeInlineWrapper(
          text,
          selectionStart,
          selectionEnd,
          range.wrapperStart,
          range.wrapperEnd,
          range.markerLength
        )
      }
    }
    return wrapInline(text, selectionStart, selectionEnd, '++', '++', defaultTextByShortcut.underline)
  }

  if (shortcut === 'strikethrough') {
    if (activeState.strikethrough) {
      const range = findWrappedRangeWithMarker(text, selectionStart, selectionEnd, '~~')
      if (range) {
        return removeInlineWrapper(
          text,
          selectionStart,
          selectionEnd,
          range.wrapperStart,
          range.wrapperEnd,
          range.markerLength
        )
      }
    }
    return wrapInline(text, selectionStart, selectionEnd, '~~', '~~', defaultTextByShortcut.strikethrough)
  }

  if (shortcut === 'superscript') {
    if (activeState.superscript) {
      const range = findWrappedRangeWithDelimiters(text, selectionStart, selectionEnd, '^(', ')')
      if (range) {
        return removeDelimitedWrapper(
          text,
          selectionStart,
          selectionEnd,
          range.wrapperStart,
          range.wrapperEnd,
          range.prefixLength,
          range.suffixLength
        )
      }
    }
    return wrapDelimited(text, selectionStart, selectionEnd, '^(', ')', defaultTextByShortcut.superscript)
  }

  if (shortcut === 'subscript') {
    if (activeState.subscript) {
      const range = findWrappedRangeWithDelimiters(text, selectionStart, selectionEnd, '~(', ')')
      if (range) {
        return removeDelimitedWrapper(
          text,
          selectionStart,
          selectionEnd,
          range.wrapperStart,
          range.wrapperEnd,
          range.prefixLength,
          range.suffixLength
        )
      }
    }
    return wrapDelimited(text, selectionStart, selectionEnd, '~(', ')', defaultTextByShortcut.subscript)
  }

  if (shortcut === 'code') {
    if (activeState.code) {
      const range = findWrappedRangeWithMarker(text, selectionStart, selectionEnd, '`')
      if (range) {
        return removeInlineWrapper(
          text,
          selectionStart,
          selectionEnd,
          range.wrapperStart,
          range.wrapperEnd,
          range.markerLength
        )
      }
    }
    return wrapInline(text, selectionStart, selectionEnd, '`', '`', defaultTextByShortcut.code)
  }

  if (shortcut === 'link') return applyLinkShortcut(text, selectionStart, selectionEnd)
  if (shortcut === 'ordered') return applyOrderedShortcut(text, selectionStart, selectionEnd)
  if (shortcut === 'table') return applyTableShortcut(text, selectionStart, selectionEnd)
  if (shortcut === 'paragraph') return applyParagraphShortcut(text, selectionStart, selectionEnd)
  if (shortcut === 'h1') return applyHeadingShortcut(text, selectionStart, selectionEnd, 1)
  if (shortcut === 'h2') return applyHeadingShortcut(text, selectionStart, selectionEnd, 2)
  if (shortcut === 'h3') return applyHeadingShortcut(text, selectionStart, selectionEnd, 3)
  if (shortcut === 'h4') return applyHeadingShortcut(text, selectionStart, selectionEnd, 4)
  if (shortcut === 'h5') return applyHeadingShortcut(text, selectionStart, selectionEnd, 5)
  if (shortcut === 'h6') return applyHeadingShortcut(text, selectionStart, selectionEnd, 6)

  return applyBulletShortcut(text, selectionStart, selectionEnd)
}

