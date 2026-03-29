import { createClient } from '@/lib/supabase/server'
import { getClaudeClient, getModelId } from '@/lib/claude/client'
import { buildSystemPrompt } from '@/lib/claude/system-prompt'
import { getRelevantMemories, getCurrentPriorities, getUserProfile } from '@/lib/claude/memory'

export async function POST(request: Request) {
  const supabase = await createClient()

  // Auth check
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { messages, conversationId, mode } = await request.json()

  // Get or create conversation
  let convoId = conversationId
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
    mode,
    priorities,
  })

  // Stream from Claude
  const claude = getClaudeClient()

  const sonnetModel = getModelId('sonnet')

  const stream = await claude.messages.stream({
    model: sonnetModel,
    max_tokens: 4096,
    system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
    messages: messages.map((m: { role: string; content: string }) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
  })

  // Create a ReadableStream that sends chunks as they arrive
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

        // Get final message for token usage
        const finalMessage = await stream.finalMessage()

        // Save assistant message
        await supabase.from('messages').insert({
          conversation_id: convoId,
          role: 'assistant',
          content: fullResponse,
          model_used: sonnetModel,
          tokens_in: finalMessage.usage.input_tokens,
          tokens_out: finalMessage.usage.output_tokens,
        })

        // Auto-title the conversation if it's new
        if (!conversationId && fullResponse.length > 0) {
          const titleResponse = await claude.messages.create({
            model: getModelId('haiku'),
            max_tokens: 50,
            messages: [
              {
                role: 'user',
                content: `Generate a very short title (3-6 words, no quotes) for this conversation:\nUser: ${lastUserMessage.content}\nAssistant: ${fullResponse.slice(0, 200)}`,
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
        console.error('Stream error:', err)
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: 'Stream failed' })}\n\n`))
        controller.close()
      }
    },
  })

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
