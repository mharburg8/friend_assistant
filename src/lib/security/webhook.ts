import { timingSafeEqual, createHmac } from 'crypto'

/**
 * Timing-safe string comparison to prevent timing attacks.
 */
export function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  try {
    return timingSafeEqual(Buffer.from(a), Buffer.from(b))
  } catch {
    return false
  }
}

/**
 * Verify Twilio webhook signature.
 */
export function verifyTwilioSignature(
  authToken: string,
  signature: string,
  url: string,
  params: Record<string, string>
): boolean {
  const sortedKeys = Object.keys(params).sort()
  let data = url
  for (const key of sortedKeys) {
    data += key + params[key]
  }
  const expected = createHmac('sha1', authToken).update(data).digest('base64')
  return safeCompare(signature, expected)
}

/**
 * Verify Retell AI webhook by API key comparison.
 */
export function verifyRetellWebhook(headerKey: string | null): boolean {
  const expectedKey = process.env.RETELL_API_KEY
  if (!expectedKey) {
    // In production, always require the key
    return process.env.NODE_ENV !== 'production'
  }
  if (!headerKey) return false
  return safeCompare(headerKey, expectedKey)
}

/**
 * Verify Signal webhook origin (only allow from internal Docker network).
 */
export function verifySignalWebhook(request: Request): boolean {
  const signalSecret = process.env.SIGNAL_WEBHOOK_SECRET
  if (!signalSecret) {
    // If no secret configured, only allow from localhost/Docker network
    const forwardedFor = request.headers.get('x-forwarded-for') || ''
    const realIp = request.headers.get('x-real-ip') || ''
    const isInternal = forwardedFor.startsWith('172.') || forwardedFor.startsWith('10.') ||
                       realIp.startsWith('172.') || realIp.startsWith('10.') ||
                       forwardedFor === '127.0.0.1' || realIp === '127.0.0.1'
    return isInternal
  }
  const headerSecret = request.headers.get('x-webhook-secret')
  if (!headerSecret) return false
  return safeCompare(headerSecret, signalSecret)
}
