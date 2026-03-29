import twilio from 'twilio'
import { createClient } from '@/lib/supabase/server'

/**
 * POST /api/sms/send
 * Send an SMS from ORACLE to Mark's phone.
 * Used for proactive reach-outs, task completion notifications, etc.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { message, to } = await request.json()

  if (!message) {
    return new Response('Missing message', { status: 400 })
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const fromNumber = process.env.TWILIO_PHONE_NUMBER
  const toNumber = to || process.env.MARK_PHONE_NUMBER

  if (!accountSid || !authToken || !fromNumber || !toNumber) {
    return Response.json(
      { error: 'Twilio not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER, and MARK_PHONE_NUMBER.' },
      { status: 500 }
    )
  }

  const client = twilio(accountSid, authToken)

  try {
    const result = await client.messages.create({
      body: message,
      from: fromNumber,
      to: toNumber,
    })

    // Log the outbound SMS
    await supabase.from('action_log').insert({
      user_id: user.id,
      action: 'sms_sent',
      reasoning: `Sent SMS to ${toNumber}: ${message.slice(0, 100)}`,
      metadata: { sid: result.sid },
    })

    return Response.json({ ok: true, sid: result.sid })
  } catch (err) {
    console.error('SMS send error:', err)
    return Response.json({ error: 'Failed to send SMS' }, { status: 500 })
  }
}
