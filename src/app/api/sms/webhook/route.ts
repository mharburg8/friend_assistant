import twilio from 'twilio'
import { getClaudeClient, getModelId } from '@/lib/claude/client'
import { buildSystemPrompt } from '@/lib/claude/system-prompt'
import { createServiceClient } from '@/lib/supabase/server'
import { getRelevantMemories, getCurrentPriorities, getUserProfile } from '@/lib/claude/memory'
import { verifyTwilioSignature } from '@/lib/security/webhook'
import { rateLimit, rateLimitResponse } from '@/lib/security/rate-limit'
import { sanitizeString } from '@/lib/security/validate'

const { MessagingResponse } = twilio.twiml

export async function POST(request: Request) {
  const formData = await request.formData()
  const from = formData.get('From') as string
  const body = formData.get('Body') as string

  if (!from || !body) {
    return new Response('Missing From or Body', { status: 400 })
  }

  // Always verify Twilio signature
  const authToken = process.env.TWILIO_AUTH_TOKEN
  if (!authToken) {
    return new Response('Twilio not configured', { status: 503 })
  }

  const signature = request.headers.get('x-twilio-signature') || ''
  const url = process.env.NEXT_PUBLIC_APP_URL + '/api/sms/webhook'
  const params: Record<string, string> = {}
  formData.forEach((value, key) => { params[key] = value as string })

  if (!verifyTwilioSignature(authToken, signature, url, params)) {
    return new Response('Invalid signature', { status: 403 })
  }

  // Rate limit by phone number
  const rl = rateLimit(from, 'sms')
  if (!rl.allowed) return rateLimitResponse(rl.resetAt)

  const supabase = await createServiceClient()
  const ownerUserId = process.env.ORACLE_OWNER_USER_ID

  if (!ownerUserId) {
    const twiml = new MessagingResponse()
    twiml.message('ORACLE is not configured yet.')
    return new Response(twiml.toString(), { headers: { 'Content-Type': 'text/xml' } })
  }

  const sanitizedBody = sanitizeString(body, 1600)

  let { data: convo } = await supabase
    .from('conversations')
    .select('id')
    .eq('user_id', ownerUserId)
    .eq('title', 'SMS')
    .is('archived_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!convo) {
    const { data: newConvo } = await supabase
      .from('conversations')
      .insert({ user_id: ownerUserId, title: 'SMS', mode: null })
      .select('id')
      .single()
    convo = newConvo
  }

  if (!convo) {
    const twiml = new MessagingResponse()
    twiml.message('Something went wrong.')
    return new Response(twiml.toString(), { headers: { 'Content-Type': 'text/xml' } })
  }

  await supabase.from('messages').insert({
    conversation_id: convo.id,
    role: 'user',
    content: sanitizedBody,
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
    + '\n\nResponding via SMS. Under 300 characters when possible. No markdown. Direct and conversational.'

  const claude = getClaudeClient()
  const response = await claude.messages.create({
    model: getModelId('sonnet'),
    max_tokens: 300,
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
    action: 'sms_response',
    reasoning: 'Responded to incoming SMS',
  })

  const twiml = new MessagingResponse()
  twiml.message(reply)

  return new Response(twiml.toString(), { headers: { 'Content-Type': 'text/xml' } })
}
