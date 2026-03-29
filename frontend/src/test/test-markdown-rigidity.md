# Markdown Rigidity Test Suite

Test for malicious inputs, edge cases, and parser robustness.

## XSS / Script Injection Attempts

javascript: link attempt
[Click me](javascript:alert('XSS'))

data: URI attempt
[Click me](data:text/html,<script>alert('xss')</script>)

Event handler attempts (should render as plain text, not as attributes)
<img src=x onerror=alert('xss')>
<a href="#" onclick="alert('xss')">Click</a>

HTML/XML tags should be rendered as text
<script>alert('xss')</script>
<iframe src="evil.com"></iframe>
<?xml version="1.0"?>
<!--[if IE]><script>alert('xss')</script><![endif]-->

## Regex Breakout / Delimiter Confusion

Mixed delimiters: ***bold and italic***

Mixed with strikethrough: ~~strike **bold** strike~~

Mixed inline: *italic `code` italic*

Nested same delimiters (should handle gracefully): **bold **nested bold** still bold**

Nested italics: *italic *nested italic* still italic*

## Empty and Whitespace Edge Cases

Empty markdown
(nothing here)

Only whitespace

Lots of blank lines


Between blocks

Trailing whitespace    
Inside formatting **bold   **
Links with whitespace [Label](  http://example.com  )

## Code Block Edge Cases

Empty code block
```
```

Language with special characters
```javascript!@#$%
code here
```

## Heading Edge Cases

Too many hashes (should be treated as text)
####### Seven hashes

Heading with only spaces
#       

Heading with inline formatting
# Heading with **bold** and *italic*

Heading with link
## [Link in heading](https://example.com)

## List Edge Cases

Empty list items
- 
* 
+ 

Mixed list markers (should stay separate lists)
- Bullet one
- Bullet two
* Different marker
* Another one

Ordered list starting at zero
0. Item zero
1. Item one

Mixed ordered/unordered
1. First ordered
2. Second ordered
- Now bullet
- Another bullet

Deeply nested (markdown doesn't support nesting, so second level should be treated as text)
- Outer item
  - Inner item (treated as text)
    - Deeper (treated as text)

## Table Edge Cases

Misaligned table (missing cells)
| A | B |
| --- | --- |
| 1 |

Excessive columns
| A | B | C | D |
| --- | --- | --- | --- |
| 1 | 2 |

Table with special characters
| **Bold** | `Code` |
| --- | --- |
| > | < |

Table without proper divider (should not render as table)
| A | B |
| not divider |
| 1 | 2 |

## Link Edge Cases

Empty link
[](https://example.com)

Empty href
[Text]()

Link with spaces in URL
[Text](https://example.com/path with spaces)

Complex URLs
[Link](https://example.com:8080/path?query=1&other=2#fragment)

Relative URLs
[Relative](/path/to/page)
[Hash link](#section)

Mailto links
[Email](mailto:test@example.com)

Protocol variations
[Bad](ftp://example.com)
[Bad](file:///etc/passwd)
[Bad](blob:https://example.com/abc123)

## Unicode and Special Characters

Emoji and unicode
🎉 Emoji test: 中文, العربية, 🚀

Special markdown characters that aren't delimiters
Some & ampersand, < less than, > greater than
Asterisk * alone, underscore _ alone, plus + alone

Unicode in formatting
**Ñoño** *café* ~~naïve~~

## Extremely Long Content

Very long line without breaks (no newline, just one paragraph)
Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.

Paragraph with many inline formats
This is **bold** and this is *italic* and this is ~~strikethrough~~ and this is `code` and this is a [link](https://example.com) all in one paragraph with x^(2) and H~(2)O.

## Parser Boundary Conditions

Consecutive blank lines preserved
First paragraph

Second paragraph


Third paragraph

Paragraph immediately after code block
```python
code
```
Next paragraph without blank line

Paragraph immediately after heading
# Heading
Next paragraph without blank line

Paragraph immediately after list
- Item 1
- Item 2
Next paragraph without blank line

