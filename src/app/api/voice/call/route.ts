import { createClient } from '@/lib/supabase/server'

/**
 * POST /api/voice/call
 * Trigger an outbound call from ORACLE to Mark via Retell AI.
 * Used for proactive reach-outs.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const retellApiKey = process.env.RETELL_API_KEY
  const agentId = process.env.RETELL_AGENT_ID
  const phoneNumber = process.env.MARK_PHONE_NUMBER

  if (!retellApiKey || !agentId || !phoneNumber) {
    return Response.json(
      { error: 'Retell AI not configured. Set RETELL_API_KEY, RETELL_AGENT_ID, and MARK_PHONE_NUMBER.' },
      { status: 500 }
    )
  }

  try {
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
    })

    const result = await response.json()

    await supabase.from('action_log').insert({
      user_id: user.id,
      action: 'voice_call_initiated',
      reasoning: 'Outbound call triggered to Mark',
      metadata: result,
    })

    return Response.json({ ok: true, ...result })
  } catch (err) {
    console.error('Retell call error:', err)
    return Response.json({ error: 'Failed to initiate call' }, { status: 500 })
  }
}
