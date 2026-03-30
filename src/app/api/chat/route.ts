import { createClient } from '@/lib/supabase/server'
import { getClaudeClient, getModelId } from '@/lib/claude/client'
import { buildSystemPrompt } from '@/lib/claude/system-prompt'
import { getRelevantMemories, getCurrentPriorities, getUserProfile } from '@/lib/claude/memory'
import { validateChatMessages, isValidUUID, isValidMode } from '@/lib/security/validate'
import { rateLimit, rateLimitResponse } from '@/lib/security/rate-limit'

export async function POST(request: Request) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return new Response('Unauthorized', { status: 401 })
  }

  // Rate limit
  const rl = rateLimit(user.id, 'chat')
  if (!rl.allowed) return rateLimitResponse(rl.resetAt)

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return new Response('Invalid JSON', { status: 400 })
  }

  const { messages: rawMessages, conversationId, mode } = body as Record<string, unknown>

  // Validate input
  const messages = validateChatMessages(rawMessages)
  if (!messages) {
    return new Response('Invalid messages format', { status: 400 })
  }
  if (conversationId && !isValidUUID(conversationId as string)) {
    return new Response('Invalid conversation ID', { status: 400 })
  }
  if (!isValidMode(mode as string | null)) {
    return new Response('Invalid mode', { status: 400 })
  }

  // Get or create conversation
  let convoId = conversationId as string | undefined
  if (!convoId) {
    const { data: convo, error } = await supabase
      .from('conversations')
      .insert({ user_id: user.id, mode })
      .select('id')
      .single()

    if (error) {
      return new Response(JSON.stringify({ error: 'Failed to create conversation' }), { status: 500 })
    }
    convoId = convo.id
  }

  // Save the user's message
  const lastUserMessage = messages[messages.length - 1]
  if (lastUserMessage?.role === 'user') {
    await supabase.from('messages').insert({
      conversation_id: convoId,
      role: 'user',
      content: lastUserMessage.content,
    })
  }

  // Build context
  const [profile, memories, priorities] = await Promise.all([
    getUserProfile(supabase, user.id),
    getRelevantMemories(supabase, user.id),
    getCurrentPriorities(supabase, user.id),
  ])

  const systemPrompt = buildSystemPrompt({
    profile,
    memories,
    mode: mode as string | null,
    priorities,
  })

  const claude = getClaudeClient()
  const sonnetModel = getModelId('sonnet')

  const stream = await claude.messages.stream({
    model: sonnetModel,
    max_tokens: 4096,
    system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
    messages: messages.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
  })

  const encoder = new TextEncoder()
  let fullResponse = ''

  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            const text = event.delta.text
            fullResponse += text
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text, conversationId: convoId })}\n\n`))
          }
        }

        const finalMessage = await stream.finalMessage()

        await supabase.from('messages').insert({
          conversation_id: convoId,
          role: 'assistant',
          content: fullResponse,
          model_used: sonnetModel,
          tokens_in: finalMessage.usage.input_tokens,
          tokens_out: finalMessage.usage.output_tokens,
        })

        if (!conversationId && fullResponse.length > 0) {
          const titleResponse = await claude.messages.create({
            model: getModelId('haiku'),
            max_tokens: 50,
            messages: [
              {
                role: 'user',
                content: `Generate a very short title (3-6 words, no quotes) for this conversation:\nUser: ${lastUserMessage.content.slice(0, 200)}\nAssistant: ${fullResponse.slice(0, 200)}`,
              },
            ],
          })
          const title = titleResponse.content[0].type === 'text'
            ? titleResponse.content[0].text.trim()
            : 'New conversation'

          await supabase
            .from('conversations')
            .update({ title })
            .eq('id', convoId)
        }

        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, conversationId: convoId })}\n\n`))
        controller.close()
      } catch (err) {
        console.error('Stream error:', (err as Error).message)
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: 'Stream failed' })}\n\n`))
        controller.close()
      }
    },
  })

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-store',
      'Connection': 'keep-alive',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
