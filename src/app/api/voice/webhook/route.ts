import { createServiceClient } from '@/lib/supabase/server'
import { getClaudeClient, getModelId } from '@/lib/claude/client'
import { buildSystemPrompt } from '@/lib/claude/system-prompt'
import { getRelevantMemories, getCurrentPriorities, getUserProfile } from '@/lib/claude/memory'
import { verifyRetellWebhook } from '@/lib/security/webhook'
import { rateLimit, rateLimitResponse } from '@/lib/security/rate-limit'

export async function POST(request: Request) {
  // Verify Retell webhook
  const retellApiKey = request.headers.get('x-retell-api-key')
  if (!verifyRetellWebhook(retellApiKey)) {
    return new Response('Unauthorized', { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return new Response('Invalid JSON', { status: 400 })
  }

  const { event, call } = body

  if (event === 'call_started') {
    return Response.json({ response: "Hey Mark. What's up?" })
  }

  if (event === 'call_ended') {
    if (call && typeof call === 'object' && (call as Record<string, unknown>).transcript) {
      const callData = call as Record<string, unknown>
      const transcript = callData.transcript as Array<{ role: string; content: string }>
      const supabase = await createServiceClient()
      const ownerUserId = process.env.ORACLE_OWNER_USER_ID
      if (ownerUserId && Array.isArray(transcript)) {
        const { data: convo } = await supabase
          .from('conversations')
          .insert({ user_id: ownerUserId, title: 'Voice Call', mode: null })
          .select('id')
          .single()

        if (convo) {
          const messageRows = transcript.map((t) => ({
            conversation_id: convo.id,
            role: t.role === 'agent' ? 'assistant' : 'user',
            content: typeof t.content === 'string' ? t.content.slice(0, 10000) : '',
          }))
          await supabase.from('messages').insert(messageRows)
        }

        await supabase.from('action_log').insert({
          user_id: ownerUserId,
          action: 'voice_call_completed',
          reasoning: `Voice call ended. ${transcript.length} exchanges.`,
        })
      }
    }
    return Response.json({ ok: true })
  }

  // Conversation turn
  if (event === 'call_analyzed' || body.transcript) {
    const transcript = (body.transcript || (call as Record<string, unknown>)?.transcript || []) as Array<{ role: string; content: string }>
    const lastUtterance = transcript[transcript.length - 1]

    if (!lastUtterance || lastUtterance.role === 'agent') {
      return Response.json({ response: '' })
    }

    // Rate limit
    const rl = rateLimit('voice', 'voice')
    if (!rl.allowed) return Response.json({ response: 'Give me a moment.' })

    const supabase = await createServiceClient()
    const ownerUserId = process.env.ORACLE_OWNER_USER_ID

    if (!ownerUserId) {
      return Response.json({ response: "I'm not configured yet." })
    }

    const messages = transcript.map((t) => ({
      role: (t.role === 'agent' ? 'assistant' : 'user') as 'user' | 'assistant',
      content: typeof t.content === 'string' ? t.content.slice(0, 5000) : '',
    }))

    const [profile, memories, priorities] = await Promise.all([
      getUserProfile(supabase, ownerUserId),
      getRelevantMemories(supabase, ownerUserId),
      getCurrentPriorities(supabase, ownerUserId),
    ])

    const systemPrompt = buildSystemPrompt({ profile, memories, mode: null, priorities })
      + '\n\nSpeaking via voice call. 1-3 sentences max. No markdown, no lists. Talk like a real person.'

    const claude = getClaudeClient()
    const response = await claude.messages.create({
      model: getModelId('sonnet'),
      max_tokens: 200,
      system: systemPrompt,
      messages,
    })

    const reply = response.content[0].type === 'text'
      ? response.content[0].text
      : "Sorry, I didn't catch that."

    return Response.json({ response: reply })
  }

  return Response.json({ ok: true })
}
