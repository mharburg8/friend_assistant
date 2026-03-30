import twilio from 'twilio'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, rateLimitResponse } from '@/lib/security/rate-limit'
import { isValidPhoneNumber, sanitizeString } from '@/lib/security/validate'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const rl = rateLimit(user.id, 'sms')
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

  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const fromNumber = process.env.TWILIO_PHONE_NUMBER
  const toNumber = (typeof to === 'string' && to) || process.env.MARK_PHONE_NUMBER

  if (!accountSid || !authToken || !fromNumber || !toNumber) {
    return Response.json({ error: 'Twilio not configured' }, { status: 503 })
  }

  if (!isValidPhoneNumber(toNumber)) {
    return Response.json({ error: 'Invalid phone number' }, { status: 400 })
  }

  const client = twilio(accountSid, authToken)

  try {
    const result = await client.messages.create({
      body: sanitizeString(message, 1600),
      from: fromNumber,
      to: toNumber,
    })

    await supabase.from('action_log').insert({
      user_id: user.id,
      action: 'sms_sent',
      reasoning: 'Sent outbound SMS',
      metadata: { sid: result.sid },
    })

    return Response.json({ ok: true, sid: result.sid })
  } catch {
    return Response.json({ error: 'Failed to send SMS' }, { status: 500 })
  }
}
