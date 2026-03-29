import { createServiceClient } from '@/lib/supabase/server'
import { getClaudeClient, getModelId } from '@/lib/claude/client'
import { buildSystemPrompt } from '@/lib/claude/system-prompt'
import { getRelevantMemories, getCurrentPriorities, getUserProfile } from '@/lib/claude/memory'

/**
 * POST /api/voice/webhook
 * Retell AI sends conversation events here.
 *
 * Retell handles real-time voice (STT + TTS).
 * This webhook receives the user's transcribed speech,
 * sends it to Claude, and returns the response for TTS.
 *
 * Setup: In Retell dashboard, create an agent with:
 * - Webhook URL: https://your-domain.com/api/voice/webhook
 * - Response type: text
 */
export async function POST(request: Request) {
  const body = await request.json()

  // Retell sends different event types
  const { event, call } = body

  // Verify Retell webhook (check API key header)
  const retellApiKey = request.headers.get('x-retell-api-key')
  if (process.env.RETELL_API_KEY && retellApiKey !== process.env.RETELL_API_KEY) {
    return new Response('Unauthorized', { status: 401 })
  }

  if (event === 'call_started') {
    return Response.json({
      response: "Hey Mark. What's up?",
    })
  }

  if (event === 'call_ended') {
    // Save call summary to memory
    if (call?.transcript && call.transcript.length > 0) {
      const supabase = await createServiceClient()
      const ownerUserId = process.env.ORACLE_OWNER_USER_ID
      if (ownerUserId) {
        const transcript = call.transcript
          .map((t: { role: string; content: string }) => `${t.role}: ${t.content}`)
          .join('\n')

        // Save as a conversation
        const { data: convo } = await supabase
          .from('conversations')
          .insert({
            user_id: ownerUserId,
            title: 'Voice Call',
            mode: null,
          })
          .select('id')
          .single()

        if (convo) {
          const messageRows = call.transcript.map((t: { role: string; content: string }) => ({
            conversation_id: convo.id,
            role: t.role === 'agent' ? 'assistant' : 'user',
            content: t.content,
          }))

          await supabase.from('messages').insert(messageRows)
        }

        await supabase.from('action_log').insert({
          user_id: ownerUserId,
          action: 'voice_call_completed',
          reasoning: `Voice call ended. ${call.transcript.length} exchanges.`,
        })
      }
    }

    return Response.json({ ok: true })
  }

  // Main conversation turn — user said something, Claude responds
  if (event === 'call_analyzed' || body.transcript) {
    const transcript = body.transcript || call?.transcript || []
    const lastUtterance = transcript[transcript.length - 1]

    if (!lastUtterance || lastUtterance.role === 'agent') {
      return Response.json({ response: '' })
    }

    const supabase = await createServiceClient()
    const ownerUserId = process.env.ORACLE_OWNER_USER_ID

    if (!ownerUserId) {
      return Response.json({ response: "I'm not configured yet." })
    }

    // Build messages from transcript
    const messages = transcript.map((t: { role: string; content: string }) => ({
      role: t.role === 'agent' ? 'assistant' as const : 'user' as const,
      content: t.content,
    }))

    // Build context
    const [profile, memories, priorities] = await Promise.all([
      getUserProfile(supabase, ownerUserId),
      getRelevantMemories(supabase, ownerUserId),
      getCurrentPriorities(supabase, ownerUserId),
    ])

    const systemPrompt = buildSystemPrompt({ profile, memories, mode: null, priorities })
      + '\n\nYou are speaking via voice call. Keep responses conversational and brief — 1-3 sentences max. No markdown, no lists, no formatting. Talk like a real person.'

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
