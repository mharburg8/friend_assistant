/**
 * Simple in-memory rate limiter.
 * For production at scale, use Redis instead.
 */

interface RateLimitEntry {
  count: number
  resetAt: number
}

const store = new Map<string, RateLimitEntry>()

// Clean up expired entries every 5 minutes
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of store) {
    if (entry.resetAt < now) store.delete(key)
  }
}, 5 * 60 * 1000)

export interface RateLimitConfig {
  maxRequests: number
  windowMs: number
}

const DEFAULTS: Record<string, RateLimitConfig> = {
  chat: { maxRequests: 30, windowMs: 60 * 1000 },
  briefing: { maxRequests: 5, windowMs: 60 * 1000 },
  sms: { maxRequests: 10, windowMs: 60 * 1000 },
  voice: { maxRequests: 5, windowMs: 60 * 1000 },
  signal: { maxRequests: 30, windowMs: 60 * 1000 },
  priorities: { maxRequests: 20, windowMs: 60 * 1000 },
  summarize: { maxRequests: 10, windowMs: 60 * 1000 },
  default: { maxRequests: 60, windowMs: 60 * 1000 },
}

export function rateLimit(
  identifier: string,
  endpoint: string
): { allowed: boolean; remaining: number; resetAt: number } {
  const config = DEFAULTS[endpoint] || DEFAULTS.default
  const key = `${endpoint}:${identifier}`
  const now = Date.now()

  const entry = store.get(key)

  if (!entry || entry.resetAt < now) {
    store.set(key, { count: 1, resetAt: now + config.windowMs })
    return { allowed: true, remaining: config.maxRequests - 1, resetAt: now + config.windowMs }
  }

  entry.count++

  if (entry.count > config.maxRequests) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt }
  }

  return { allowed: true, remaining: config.maxRequests - entry.count, resetAt: entry.resetAt }
}

export function rateLimitResponse(resetAt: number): Response {
  return new Response(JSON.stringify({ error: 'Too many requests' }), {
    status: 429,
    headers: {
      'Content-Type': 'application/json',
      'Retry-After': String(Math.ceil((resetAt - Date.now()) / 1000)),
    },
  })
}
