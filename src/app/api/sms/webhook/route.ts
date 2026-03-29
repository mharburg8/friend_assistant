import { NextResponse } from 'next/server'
import twilio from 'twilio'
import { getClaudeClient, getModelId } from '@/lib/claude/client'
import { buildSystemPrompt } from '@/lib/claude/system-prompt'
import { createServiceClient } from '@/lib/supabase/server'
import { getRelevantMemories, getCurrentPriorities, getUserProfile } from '@/lib/claude/memory'

const { MessagingResponse } = twilio.twiml

/**
 * POST /api/sms/webhook
 * Twilio sends incoming SMS here. Claude responds via SMS.
 *
 * Setup: In Twilio console, set your phone number's webhook URL to:
 * https://your-domain.com/api/sms/webhook (POST)
 */
export async function POST(request: Request) {
  const formData = await request.formData()
  const from = formData.get('From') as string
  const body = formData.get('Body') as string

  if (!from || !body) {
    return new Response('Missing From or Body', { status: 400 })
  }

  // Validate Twilio signature in production
  if (process.env.TWILIO_AUTH_TOKEN && process.env.NODE_ENV === 'production') {
    const signature = request.headers.get('x-twilio-signature') || ''
    const url = process.env.NEXT_PUBLIC_APP_URL + '/api/sms/webhook'
    const params: Record<string, string> = {}
    formData.forEach((value, key) => {
      params[key] = value as string
    })

    const isValid = twilio.validateRequest(
      process.env.TWILIO_AUTH_TOKEN,
      signature,
      url,
      params
    )

    if (!isValid) {
      return new Response('Invalid signature', { status: 403 })
    }
  }

  // Look up user by phone number (Mark's number stored in env)
  const supabase = await createServiceClient()

  // For now, we associate SMS with the owner's account
  // In production, look up user by phone number in a users_phone table
  const ownerUserId = process.env.ORACLE_OWNER_USER_ID

  if (!ownerUserId) {
    const twiml = new MessagingResponse()
    twiml.message('ORACLE is not configured yet. Set ORACLE_OWNER_USER_ID.')
    return new Response(twiml.toString(), {
      headers: { 'Content-Type': 'text/xml' },
    })
  }

  // Find or create an SMS conversation
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
    twiml.message('Something went wrong creating the conversation.')
    return new Response(twiml.toString(), {
      headers: { 'Content-Type': 'text/xml' },
    })
  }

  // Save incoming message
  await supabase.from('messages').insert({
    conversation_id: convo.id,
    role: 'user',
    content: body,
  })

  // Load recent SMS messages for context
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
    + '\n\nYou are responding via SMS. Keep responses concise — under 300 characters when possible. No markdown formatting. Direct and conversational.'

  // Get Claude's response
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

  // Save assistant response
  await supabase.from('messages').insert({
    conversation_id: convo.id,
    role: 'assistant',
    content: reply,
    model_used: getModelId('sonnet'),
    tokens_in: response.usage.input_tokens,
    tokens_out: response.usage.output_tokens,
  })

  // Log the action
  await supabase.from('action_log').insert({
    user_id: ownerUserId,
    action: 'sms_response',
    reasoning: `Responded to SMS from ${from}`,
  })

  // Respond via Twilio TwiML
  const twiml = new MessagingResponse()
  twiml.message(reply)

  return new Response(twiml.toString(), {
    headers: { 'Content-Type': 'text/xml' },
  })
}
