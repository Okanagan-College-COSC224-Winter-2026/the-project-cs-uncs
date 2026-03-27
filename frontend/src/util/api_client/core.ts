import { didExpire, removeToken } from '../login'

export const BASE_URL = 'http://localhost:5000'

export const safeFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  try {
    return await fetch(input, init)
  } catch {
    throw new Error("We couldn't reach the server. Please check your connection and try again.")
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const normalizeErrorText = (text: string) => {
  const cleaned = text.replace(/\s+/g, ' ').trim()
  if (!cleaned) return ''

  // If the backend returns an HTML error page (e.g. Flask 500), don't show it verbatim.
  if (/<!doctype\s+html|<html\b/i.test(cleaned)) return ''

  return cleaned
}

const prettifyValidationMessage = (message: string) => {
  const trimmed = message.trim()

  if (trimmed === 'Missing data for required field.') return 'This field is required.'
  if (trimmed === 'Not a valid email address.') return 'Please enter a valid email address.'

  const minLengthMatch = trimmed.match(/^Shorter than minimum length (\d+)\.$/)
  if (minLengthMatch) return `Must be at least ${minLengthMatch[1]} characters.`

  return trimmed
}

const translateBackendMsg = (msg: string) => {
  const normalized = msg.trim().toLowerCase()
  if (normalized === 'missing json in request') return 'Something went wrong. Please try again.'
  if (normalized === 'insufficient permissions') return "You don't have permission to do that."
  return msg
}

const stringifyErrorValue = (value: unknown): string | null => {
  if (typeof value === 'string') return prettifyValidationMessage(value)
  if (Array.isArray(value)) {
    const parts = value
      .map((v) => (typeof v === 'string' ? prettifyValidationMessage(v) : null))
      .filter((v): v is string => Boolean(v))
    return parts.length ? parts.join('; ') : null
  }
  return null
}

const isGenericValidationMsg = (msg: string) => {
  const normalized = msg.trim().toLowerCase()
  return normalized === 'validation error' || normalized === 'validation failed'
}

const prettyFieldName = (key: string) => {
  if (!key) return key
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

const formatErrorDetails = (errors: unknown): string | null => {
  if (!errors) return null

  if (Array.isArray(errors)) {
    const parts = errors
      .map((v) => (typeof v === 'string' ? v : null))
      .filter((v): v is string => Boolean(v))
    return parts.length ? parts.join('; ') : null
  }

  if (isRecord(errors)) {
    const parts: string[] = []
    for (const [key, value] of Object.entries(errors)) {
      const rendered = stringifyErrorValue(value)
      if (rendered) parts.push(`${prettyFieldName(key)}: ${rendered}`)
    }
    return parts.length ? parts.join('; ') : null
  }

  return null
}

const getMsgFromErrorPayload = (payload: unknown): string | null => {
  if (!isRecord(payload)) return null

  const details = formatErrorDetails(payload.errors)

  const msg = payload.msg
  if (typeof msg === 'string' && msg.trim()) {
    if (isGenericValidationMsg(msg) && details) return details
    return translateBackendMsg(msg)
  }

  const message = payload.message
  if (typeof message === 'string' && message.trim()) return message

  if (details) return details

  return null
}

const defaultFriendlyErrorForStatus = (status: number) => {
  if (status === 400) return 'Please check what you entered and try again.'
  if (status === 401) return 'Please log in and try again.'
  if (status === 403) return "You don't have permission to do that."
  if (status === 404) return "We couldn't find what you were looking for."
  return 'Something went wrong. Please try again.'
}

export const getErrorMessageFromResponse = async (
  response: Response,
  fallbackPrefix: string = 'Request failed'
): Promise<string> => {
  const copyForJson = response.clone()
  const parsed: unknown = await copyForJson.json().catch(() => null)
  const parsedMsg = getMsgFromErrorPayload(parsed)
  if (parsedMsg) return parsedMsg

  const copyForText = response.clone()
  const text = await copyForText.text().catch(() => '')
  const cleaned = normalizeErrorText(text)
  if (cleaned) return cleaned

  if (fallbackPrefix && fallbackPrefix !== 'Request failed') {
    return `${fallbackPrefix}. ${defaultFriendlyErrorForStatus(response.status)}`
  }

  return defaultFriendlyErrorForStatus(response.status)
}

export const maybeHandleExpire = (response: Response) => {
  if (didExpire(response)) {
    removeToken()
    window.location.href = '/'
  }
}

