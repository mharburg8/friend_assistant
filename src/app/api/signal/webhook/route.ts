import { getClaudeClient, getModelId } from '@/lib/claude/client'
import { buildSystemPrompt } from '@/lib/claude/system-prompt'
import { createServiceClient } from '@/lib/supabase/server'
import { getRelevantMemories, getCurrentPriorities, getUserProfile } from '@/lib/claude/memory'
import { isSelfHosted } from '@/lib/db/postgres'

/**
 * POST /api/signal/webhook
 * Receives incoming Signal messages via signal-cli-rest-api.
 *
 * Setup: Configure signal-cli-rest-api to POST to this endpoint
 * when messages are received.
 */
export async function POST(request: Request) {
  const body = await request.json()

  // signal-cli-rest-api sends message events
  const { envelope } = body
  if (!envelope?.dataMessage?.message) {
    return Response.json({ ok: true })
  }

  const from = envelope.source
  const messageText = envelope.dataMessage.message
  const markPhone = process.env.MARK_PHONE_NUMBER

  // Only respond to Mark's messages
  if (from !== markPhone) {
    return Response.json({ ok: true })
  }

  const ownerUserId = process.env.ORACLE_OWNER_USER_ID
  if (!ownerUserId) {
    await sendSignalMessage(markPhone!, 'ORACLE is not configured yet. Set ORACLE_OWNER_USER_ID.')
    return Response.json({ ok: true })
  }

  // Get Supabase client (or use direct DB in self-hosted mode)
  const supabase = await createServiceClient()

  // Find or create Signal conversation
  let { data: convo } = await supabase
    .from('conversations')
    .select('id')
    .eq('user_id', ownerUserId)
    .eq('title', 'Signal')
    .is('archived_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!convo) {
    const { data: newConvo } = await supabase
      .from('conversations')
      .insert({ user_id: ownerUserId, title: 'Signal', mode: null })
      .select('id')
      .single()
    convo = newConvo
  }

  if (!convo) {
    await sendSignalMessage(markPhone!, 'Something went wrong creating the conversation.')
    return Response.json({ ok: true })
  }

  // Save incoming message
  await supabase.from('messages').insert({
    conversation_id: convo.id,
    role: 'user',
    content: messageText,
  })

  // Load recent messages for context
  const { data: recentMessages } = await supabase
    .from('messages')
    .select('role, content')
    .eq('conversation_id', convo.id)
    .order('created_at', { ascending: false })
    .limit(20)

  const messagesForClaude = (recentMessages || [])
    .reverse()
    .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))

  // Build context
  const [profile, memories, priorities] = await Promise.all([
    getUserProfile(supabase, ownerUserId),
    getRelevantMemories(supabase, ownerUserId),
    getCurrentPriorities(supabase, ownerUserId),
  ])

  const systemPrompt = buildSystemPrompt({ profile, memories, mode: null, priorities })
    + '\n\nYou are responding via Signal messenger. Keep responses concise but you have more room than SMS. Light markdown is fine (bold, lists). Be conversational and direct.'

  // Get Claude's response
  const claude = getClaudeClient()
  const response = await claude.messages.create({
    model: getModelId('sonnet'),
    max_tokens: 1000,
    system: systemPrompt,
    messages: messagesForClaude,
  })

  const reply = response.content[0].type === 'text'
    ? response.content[0].text
    : 'I had trouble generating a response.'

  // Save assistant response
  await supabase.from('messages').insert({
    conversation_id: convo.id,
    role: 'assistant',
    content: reply,
    model_used: getModelId('sonnet'),
    tokens_in: response.usage.input_tokens,
    tokens_out: response.usage.output_tokens,
  })

  // Log action
  await supabase.from('action_log').insert({
    user_id: ownerUserId,
    action: 'signal_response',
    reasoning: `Responded to Signal message from ${from}`,
  })

  // Send reply via Signal
  await sendSignalMessage(markPhone!, reply)

  return Response.json({ ok: true })
}

/**
 * Send a message via Signal using the signal-cli REST API.
 */
async function sendSignalMessage(to: string, message: string) {
  const signalApiUrl = process.env.SIGNAL_API_URL || 'http://signal-api:8080'
  const signalNumber = process.env.SIGNAL_PHONE_NUMBER

  if (!signalNumber) {
    console.error('SIGNAL_PHONE_NUMBER not set')
    return
  }

  try {
    await fetch(`${signalApiUrl}/v2/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        number: signalNumber,
        recipients: [to],
      }),
    })
  } catch (err) {
    console.error('Failed to send Signal message:', err)
  }
}
