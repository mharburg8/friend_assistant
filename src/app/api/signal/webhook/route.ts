import { getClaudeClient, getModelId } from '@/lib/claude/client'
import { buildSystemPrompt } from '@/lib/claude/system-prompt'
import { createServiceClient } from '@/lib/supabase/server'
import { getRelevantMemories, getCurrentPriorities, getUserProfile } from '@/lib/claude/memory'
import { verifySignalWebhook } from '@/lib/security/webhook'
import { rateLimit, rateLimitResponse } from '@/lib/security/rate-limit'
import { sanitizeString, isValidPhoneNumber } from '@/lib/security/validate'

export async function POST(request: Request) {
  // Verify request origin
  if (!verifySignalWebhook(request)) {
    return new Response('Unauthorized', { status: 403 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return new Response('Invalid JSON', { status: 400 })
  }

  const envelope = body.envelope as Record<string, unknown> | undefined
  if (!envelope?.dataMessage || !(envelope.dataMessage as Record<string, unknown>)?.message) {
    return Response.json({ ok: true })
  }

  const from = envelope.source as string
  const messageText = (envelope.dataMessage as Record<string, unknown>).message as string
  const markPhone = process.env.MARK_PHONE_NUMBER

  // Only respond to Mark's messages
  if (!markPhone || from !== markPhone) {
    return Response.json({ ok: true })
  }

  // Rate limit
  const rl = rateLimit(from, 'signal')
  if (!rl.allowed) return rateLimitResponse(rl.resetAt)

  const ownerUserId = process.env.ORACLE_OWNER_USER_ID
  if (!ownerUserId) {
    await sendSignalMessage(markPhone, 'ORACLE is not configured yet.')
    return Response.json({ ok: true })
  }

  const supabase = await createServiceClient()
  const sanitizedMessage = sanitizeString(messageText, 5000)

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
    await sendSignalMessage(markPhone, 'Something went wrong.')
    return Response.json({ ok: true })
  }

  await supabase.from('messages').insert({
    conversation_id: convo.id,
    role: 'user',
    content: sanitizedMessage,
  })

  const { data: recentMessages } = await supabase
    .from('messages')
    .select('role, content')
    .eq('conversation_id', convo.id)
    .order('created_at', { ascending: false })
    .limit(20)

  const messagesForClaude = (recentMessages || [])
    .reverse()
    .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))

  const [profile, memories, priorities] = await Promise.all([
    getUserProfile(supabase, ownerUserId),
    getRelevantMemories(supabase, ownerUserId),
    getCurrentPriorities(supabase, ownerUserId),
  ])

  const systemPrompt = buildSystemPrompt({ profile, memories, mode: null, priorities })
    + '\n\nResponding via Signal messenger. Concise but more room than SMS. Light markdown is fine. Be conversational and direct.'

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

  await supabase.from('messages').insert({
    conversation_id: convo.id,
    role: 'assistant',
    content: reply,
    model_used: getModelId('sonnet'),
    tokens_in: response.usage.input_tokens,
    tokens_out: response.usage.output_tokens,
  })

  await supabase.from('action_log').insert({
    user_id: ownerUserId,
    action: 'signal_response',
    reasoning: 'Responded to Signal message',
  })

  await sendSignalMessage(markPhone, reply)

  return Response.json({ ok: true })
}

async function sendSignalMessage(to: string, message: string) {
  const signalApiUrl = process.env.SIGNAL_API_URL || 'http://signal-api:8080'
  const signalNumber = process.env.SIGNAL_PHONE_NUMBER

  if (!signalNumber) return

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000)

    await fetch(`${signalApiUrl}/v2/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: message.slice(0, 5000),
        number: signalNumber,
        recipients: [to],
      }),
      signal: controller.signal,
    })

    clearTimeout(timeout)
  } catch {
    // Silently fail — logged elsewhere
  }
}
