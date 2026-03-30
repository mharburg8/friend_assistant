import { createClient } from '@/lib/supabase/server'

/**
 * POST /api/signal/send
 * Send a Signal message from ORACLE to Mark.
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

  const signalApiUrl = process.env.SIGNAL_API_URL || 'http://signal-api:8080'
  const signalNumber = process.env.SIGNAL_PHONE_NUMBER
  const toNumber = to || process.env.MARK_PHONE_NUMBER

  if (!signalNumber || !toNumber) {
    return Response.json(
      { error: 'Signal not configured. Set SIGNAL_PHONE_NUMBER and MARK_PHONE_NUMBER.' },
      { status: 500 }
    )
  }

  try {
    const result = await fetch(`${signalApiUrl}/v2/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        number: signalNumber,
        recipients: [toNumber],
      }),
    })

    const data = await result.json()

    // Log the outbound message
    await supabase.from('action_log').insert({
      user_id: user.id,
      action: 'signal_sent',
      reasoning: `Sent Signal message to ${toNumber}: ${message.slice(0, 100)}`,
    })

    return Response.json({ ok: true, ...data })
  } catch (err) {
    console.error('Signal send error:', err)
    return Response.json({ error: 'Failed to send Signal message' }, { status: 500 })
  }
}
