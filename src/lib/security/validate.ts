/**
 * Input validation helpers for API routes.
 */

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const PHONE_REGEX = /^\+[1-9]\d{1,14}$/
const MAX_MESSAGE_LENGTH = 50000
const MAX_MESSAGES_PER_REQUEST = 100

export function isValidUUID(id: string): boolean {
  return typeof id === 'string' && UUID_REGEX.test(id)
}

export function isValidPhoneNumber(phone: string): boolean {
  return typeof phone === 'string' && PHONE_REGEX.test(phone)
}

export function isValidMode(mode: string | null): boolean {
  if (mode === null) return true
  return ['alab', 'work', 'jobsearch', 'school', 'personal', 'dev'].includes(mode)
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export function validateChatMessages(messages: unknown): ChatMessage[] | null {
  if (!Array.isArray(messages)) return null
  if (messages.length === 0 || messages.length > MAX_MESSAGES_PER_REQUEST) return null

  for (const msg of messages) {
    if (typeof msg !== 'object' || msg === null) return null
    if (msg.role !== 'user' && msg.role !== 'assistant') return null
    if (typeof msg.content !== 'string') return null
    if (msg.content.length === 0 || msg.content.length > MAX_MESSAGE_LENGTH) return null
  }

  return messages as ChatMessage[]
}

export function validatePriorities(priorities: unknown): string[] | null {
  if (!Array.isArray(priorities)) return null
  if (priorities.length > 10) return null

  for (const p of priorities) {
    if (typeof p !== 'string') return null
    if (p.trim().length === 0 || p.length > 500) return null
  }

  return priorities as string[]
}

export function sanitizeString(str: string, maxLength = 1000): string {
  return str.slice(0, maxLength).trim()
}
