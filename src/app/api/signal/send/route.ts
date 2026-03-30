import { createClient } from '@/lib/supabase/server'
import { rateLimit, rateLimitResponse } from '@/lib/security/rate-limit'
import { isValidPhoneNumber, sanitizeString } from '@/lib/security/validate'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const rl = rateLimit(user.id, 'signal')
  if (!rl.allowed) return rateLimitResponse(rl.resetAt)

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return new Response('Invalid JSON', { status: 400 })
  }

  const { message, to } = body as Record<string, unknown>

  if (!message || typeof message !== 'string') {
    return new Response('Missing message', { status: 400 })
  }

  const signalApiUrl = process.env.SIGNAL_API_URL || 'http://signal-api:8080'
  const signalNumber = process.env.SIGNAL_PHONE_NUMBER
  const toNumber = (typeof to === 'string' && to) || process.env.MARK_PHONE_NUMBER

  if (!signalNumber || !toNumber) {
    return Response.json({ error: 'Signal not configured' }, { status: 503 })
  }

  if (!isValidPhoneNumber(toNumber)) {
    return Response.json({ error: 'Invalid phone number' }, { status: 400 })
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000)

    const result = await fetch(`${signalApiUrl}/v2/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: sanitizeString(message, 5000),
        number: signalNumber,
        recipients: [toNumber],
      }),
      signal: controller.signal,
    })

    clearTimeout(timeout)
    const data = await result.json()

    await supabase.from('action_log').insert({
      user_id: user.id,
      action: 'signal_sent',
      reasoning: 'Sent outbound Signal message',
    })

    return Response.json({ ok: true, ...data })
  } catch {
    return Response.json({ error: 'Failed to send Signal message' }, { status: 500 })
  }
}
