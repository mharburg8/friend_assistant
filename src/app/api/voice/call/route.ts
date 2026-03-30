import { createClient } from '@/lib/supabase/server'
import { rateLimit, rateLimitResponse } from '@/lib/security/rate-limit'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const rl = rateLimit(user.id, 'voice')
  if (!rl.allowed) return rateLimitResponse(rl.resetAt)

  const retellApiKey = process.env.RETELL_API_KEY
  const agentId = process.env.RETELL_AGENT_ID
  const phoneNumber = process.env.MARK_PHONE_NUMBER

  if (!retellApiKey || !agentId || !phoneNumber) {
    return Response.json({ error: 'Retell AI not configured' }, { status: 503 })
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15000)

    const response = await fetch('https://api.retellai.com/v2/create-phone-call', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${retellApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from_number: process.env.RETELL_PHONE_NUMBER,
        to_number: phoneNumber,
        agent_id: agentId,
      }),
      signal: controller.signal,
    })

    clearTimeout(timeout)
    const result = await response.json()

    await supabase.from('action_log').insert({
      user_id: user.id,
      action: 'voice_call_initiated',
      reasoning: 'Outbound call triggered',
      metadata: { call_id: result.call_id },
    })

    return Response.json({ ok: true })
  } catch {
    return Response.json({ error: 'Failed to initiate call' }, { status: 500 })
  }
}
