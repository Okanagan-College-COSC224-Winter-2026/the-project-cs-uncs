import { describe, expect, it } from 'vitest'
import { applyMarkdownShortcut, getMarkdownActiveState } from '../util/markdownShortcuts'

describe('applyMarkdownShortcut', () => {
  it('wraps selected text as bold', () => {
    const input = 'hello world'
    const start = input.indexOf('world')
    const end = start + 'world'.length

    const result = applyMarkdownShortcut(input, start, end, 'bold')

    expect(result.nextText).toBe('hello **world**')
    expect(result.nextSelectionStart).toBe(8)
    expect(result.nextSelectionEnd).toBe(13)
  })

  it('toggles bold off when selection is already bold', () => {
    const input = 'hello **world**'
    const start = input.indexOf('world')
    const end = start + 'world'.length

    const result = applyMarkdownShortcut(input, start, end, 'bold')

    expect(result.nextText).toBe('hello world')
  })

  it('wraps and unwraps underline', () => {
    const input = 'mark this'
    const start = input.indexOf('this')
    const end = start + 'this'.length
    const wrapped = applyMarkdownShortcut(input, start, end, 'underline')
    expect(wrapped.nextText).toBe('mark ++this++')

    const unwrapped = applyMarkdownShortcut(wrapped.nextText, wrapped.nextSelectionStart, wrapped.nextSelectionEnd, 'underline')
    expect(unwrapped.nextText).toBe('mark this')
  })

  it('wraps and unwraps strikethrough', () => {
    const input = 'remove this'
    const start = input.indexOf('this')
    const end = start + 'this'.length
    const wrapped = applyMarkdownShortcut(input, start, end, 'strikethrough')
    expect(wrapped.nextText).toBe('remove ~~this~~')

    const unwrapped = applyMarkdownShortcut(wrapped.nextText, wrapped.nextSelectionStart, wrapped.nextSelectionEnd, 'strikethrough')
    expect(unwrapped.nextText).toBe('remove this')
  })

  it('wraps and unwraps superscript/subscript', () => {
    const sup = applyMarkdownShortcut('x2', 1, 2, 'superscript')
    expect(sup.nextText).toBe('x^(2)')
    const supOff = applyMarkdownShortcut(sup.nextText, sup.nextSelectionStart, sup.nextSelectionEnd, 'superscript')
    expect(supOff.nextText).toBe('x2')

    const sub = applyMarkdownShortcut('H2O', 1, 2, 'subscript')
    expect(sub.nextText).toBe('H~(2)O')
    const subOff = applyMarkdownShortcut(sub.nextText, sub.nextSelectionStart, sub.nextSelectionEnd, 'subscript')
    expect(subOff.nextText).toBe('H2O')
  })

  it('applies bullets to selected lines', () => {
    const input = 'one\ntwo\nthree'
    const start = 0
    const end = 'one\ntwo'.length

    const result = applyMarkdownShortcut(input, start, end, 'bullet')

    expect(result.nextText).toBe('- one\n- two\nthree')
  })

  it('toggles list markers off when selected lines are already bulleted', () => {
    const input = '- one\n- two\nthree'
    const result = applyMarkdownShortcut(input, 0, '- one\n- two'.length, 'bullet')

    expect(result.nextText).toBe('one\ntwo\nthree')
  })

  it('applies and removes numbered list markers', () => {
    const added = applyMarkdownShortcut('alpha\nbeta', 0, 'alpha\nbeta'.length, 'ordered')
    expect(added.nextText).toBe('1. alpha\n2. beta')

    const removed = applyMarkdownShortcut(added.nextText, 0, added.nextText.length, 'ordered')
    expect(removed.nextText).toBe('alpha\nbeta')
  })

  it('wraps and unwraps inline code', () => {
    const input = 'run this'
    const start = input.indexOf('this')
    const end = start + 'this'.length
    const wrapped = applyMarkdownShortcut(input, start, end, 'code')
    expect(wrapped.nextText).toBe('run `this`')

    const unwrapped = applyMarkdownShortcut(wrapped.nextText, wrapped.nextSelectionStart, wrapped.nextSelectionEnd, 'code')
    expect(unwrapped.nextText).toBe('run this')
  })

  it('applies and removes heading prefixes', () => {
    const added = applyMarkdownShortcut('section title', 0, 'section title'.length, 'h2')
    expect(added.nextText).toBe('## section title')

    const removed = applyMarkdownShortcut(added.nextText, 0, added.nextText.length, 'h2')
    expect(removed.nextText).toBe('section title')
  })

  it('removes heading prefixes via paragraph shortcut', () => {
    const input = '### Heading title\n#### Next line'
    const result = applyMarkdownShortcut(input, 0, input.length, 'paragraph')
    expect(result.nextText).toBe('Heading title\nNext line')
  })

  it('inserts a link template when nothing is selected', () => {
    const input = 'See '
    const result = applyMarkdownShortcut(input, input.length, input.length, 'link')

    expect(result.nextText).toBe('See [link text](https://example.com)')
    expect(result.nextSelectionStart).toBe(16)
    expect(result.nextSelectionEnd).toBe(35)
  })

  it('toggles link off when cursor is inside an existing link', () => {
    const input = 'Go to [Tabler](https://tabler.io/icons) today'
    const cursor = input.indexOf('Tabler') + 2
    const result = applyMarkdownShortcut(input, cursor, cursor, 'link')

    expect(result.nextText).toBe('Go to Tabler today')
  })

  it('inserts a markdown table and toggles it back to plain rows', () => {
    const created = applyMarkdownShortcut('', 0, 0, 'table')
    expect(created.nextText).toContain('| Column 1 | Column 2 |')

    const removed = applyMarkdownShortcut(created.nextText, 0, created.nextText.length, 'table')
    expect(removed.nextText).toContain('Column 1 Column 2')
  })
})

describe('getMarkdownActiveState', () => {
  it('detects active markdown around the cursor and selection', () => {
    const input = 'A **bold** line\n- item\nVisit [Tabler](https://tabler.io/icons)'

    const boldCursor = input.indexOf('bold') + 1
    const boldState = getMarkdownActiveState(input, boldCursor, boldCursor)
    expect(boldState.bold).toBe(true)

    const listCursor = input.indexOf('item') + 1
    const listState = getMarkdownActiveState(input, listCursor, listCursor)
    expect(listState.bullet).toBe(true)

    const linkCursor = input.indexOf('Tabler') + 2
    const linkState = getMarkdownActiveState(input, linkCursor, linkCursor)
    expect(linkState.link).toBe(true)

    const headingInput = '## Heading here'
    const headingState = getMarkdownActiveState(headingInput, 4, 4)
    expect(headingState.h2).toBe(true)
    expect(headingState.headingLevel).toBe(2)

    const headingSix = '###### Tiny heading'
    const headingSixState = getMarkdownActiveState(headingSix, 8, 8)
    expect(headingSixState.h6).toBe(true)
    expect(headingSixState.headingLevel).toBe(6)

    const codeInput = 'Run `script` now'
    const codeCursor = codeInput.indexOf('script') + 2
    const codeState = getMarkdownActiveState(codeInput, codeCursor, codeCursor)
    expect(codeState.code).toBe(true)

    const orderedInput = '1. First\n2. Second'
    const orderedState = getMarkdownActiveState(orderedInput, 4, 4)
    expect(orderedState.ordered).toBe(true)

    const underlineState = getMarkdownActiveState('a ++word++ b', 5, 5)
    expect(underlineState.underline).toBe(true)

    const strikeState = getMarkdownActiveState('a ~~word~~ b', 5, 5)
    expect(strikeState.strikethrough).toBe(true)

    const superState = getMarkdownActiveState('x^(2)', 3, 3)
    expect(superState.superscript).toBe(true)

    const subState = getMarkdownActiveState('H~(2)O', 3, 3)
    expect(subState.subscript).toBe(true)

    const tableState = getMarkdownActiveState('| A | B |\n| --- | --- |\n| 1 | 2 |', 2, 2)
    expect(tableState.table).toBe(true)
  })
})
