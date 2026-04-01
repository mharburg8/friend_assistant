import { createClient } from '@/lib/supabase/server'
import { getClaudeClient, getModelId } from '@/lib/claude/client'
import { buildSystemPrompt } from '@/lib/claude/system-prompt'
import { getRelevantMemories, getCurrentPriorities, getUserProfile } from '@/lib/claude/memory'
import { validateChatMessages, isValidUUID, isValidMode } from '@/lib/security/validate'
import { rateLimit, rateLimitResponse } from '@/lib/security/rate-limit'
import { getObjectBuffer, getPresignedUploadUrl } from '@/lib/s3/client'
import { getFileCategory } from '@/lib/s3/file-types'
import { extractTextFromFile } from '@/lib/s3/extract-text'
import { parseDocumentTags, getDocumentFormat } from '@/lib/documents/parse-tags'
import { generateDocument } from '@/lib/documents/generate'
import { randomUUID } from 'crypto'
import type { Attachment } from '@/types/database'

export async function POST(request: Request) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return new Response('Unauthorized', { status: 401 })
  }

  const rl = rateLimit(user.id, 'chat')
  if (!rl.allowed) return rateLimitResponse(rl.resetAt)

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return new Response('Invalid JSON', { status: 400 })
  }

  const { messages: rawMessages, conversationId, mode, attachmentIds } = body as Record<string, unknown>

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

  // Validate attachmentIds
  const validAttachmentIds: string[] = []
  if (Array.isArray(attachmentIds)) {
    for (const id of attachmentIds) {
      if (typeof id === 'string' && isValidUUID(id)) {
        validAttachmentIds.push(id)
      }
    }
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
  let userMessageId: string | undefined
  if (lastUserMessage?.role === 'user') {
    const { data: savedMsg } = await supabase.from('messages').insert({
      conversation_id: convoId,
      role: 'user',
      content: lastUserMessage.content,
    }).select('id').single()
    userMessageId = savedMsg?.id

    // Confirm attachments belong to this message
    if (validAttachmentIds.length > 0 && userMessageId) {
      await supabase
        .from('attachments')
        .update({ message_id: userMessageId, conversation_id: convoId })
        .in('id', validAttachmentIds)
        .eq('user_id', user.id)
    }
  }

  // Build Claude content blocks from attachments
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const contentBlocks: any[] = []

  if (validAttachmentIds.length > 0) {
    const { data: attachments } = await supabase
      .from('attachments')
      .select('*')
      .in('id', validAttachmentIds)
      .eq('user_id', user.id)

    if (attachments) {
      for (const att of attachments as Attachment[]) {
        const category = getFileCategory(att.file_type)

        try {
          const buffer = await getObjectBuffer(att.s3_key)

          if (category === 'image') {
            const base64 = buffer.toString('base64')
            contentBlocks.push({
              type: 'image',
              source: {
                type: 'base64',
                media_type: att.file_type,
                data: base64,
              },
            })
          } else if (category === 'pdf') {
            const base64 = buffer.toString('base64')
            contentBlocks.push({
              type: 'document',
              source: {
                type: 'base64',
                media_type: 'application/pdf',
                data: base64,
              },
            })
          } else {
            // Text and Office files — extract text
            const text = await extractTextFromFile(buffer, att.file_type, att.file_name)
            if (text) {
              contentBlocks.push({
                type: 'text',
                text: `[Attached file: ${att.file_name}]\n${text}`,
              })
            }
          }
        } catch (err) {
          console.error(`Failed to process attachment ${att.id}:`, err)
          contentBlocks.push({
            type: 'text',
            text: `[Attached file: ${att.file_name}] (could not read file)`,
          })
        }
      }
    }
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

  // Build messages with content blocks for the last user message
  const claudeMessages = messages.map((m, i) => {
    if (i === messages.length - 1 && m.role === 'user' && contentBlocks.length > 0) {
      return {
        role: 'user' as const,
        content: [
          ...contentBlocks,
          { type: 'text', text: m.content },
        ],
      }
    }
    return {
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }
  })

  const stream = await claude.messages.stream({
    model: sonnetModel,
    max_tokens: 4096,
    system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    messages: claudeMessages as any,
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

        // Check for document generation tags
        const { documents, cleanedResponse } = parseDocumentTags(fullResponse)
        const generatedAttachments: Attachment[] = []

        if (documents.length > 0) {
          for (const doc of documents) {
            try {
              const format = getDocumentFormat(doc.fileName)
              const { buffer, mimeType } = await generateDocument(doc.content, format)

              const fileId = randomUUID()
              const s3Key = `${user.id}/${convoId}/generated/${fileId}-${doc.fileName}`

              // Upload to S3 via presigned URL
              const uploadUrl = await getPresignedUploadUrl(s3Key, mimeType, buffer.length)
              await fetch(uploadUrl, {
                method: 'PUT',
                headers: { 'Content-Type': mimeType },
                body: new Uint8Array(buffer),
              })

              // Save attachment record (use service-level insert since RLS requires auth.uid())
              const { data: att } = await supabase
                .from('attachments')
                .insert({
                  id: fileId,
                  conversation_id: convoId,
                  user_id: user.id,
                  file_name: doc.fileName,
                  file_type: mimeType,
                  file_size: buffer.length,
                  s3_key: s3Key,
                })
                .select('*')
                .single()

              if (att) generatedAttachments.push(att as Attachment)
            } catch (err) {
              console.error(`Failed to generate document ${doc.fileName}:`, err)
            }
          }

          fullResponse = cleanedResponse
        }

        // Save assistant message
        const { data: assistantMsg } = await supabase.from('messages').insert({
          conversation_id: convoId,
          role: 'assistant',
          content: fullResponse,
          model_used: sonnetModel,
          tokens_in: finalMessage.usage.input_tokens,
          tokens_out: finalMessage.usage.output_tokens,
        }).select('id').single()

        // Link generated attachments to assistant message
        if (generatedAttachments.length > 0 && assistantMsg) {
          await supabase
            .from('attachments')
            .update({ message_id: assistantMsg.id })
            .in('id', generatedAttachments.map(a => a.id))
        }

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

        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          done: true,
          conversationId: convoId,
          generatedAttachments: generatedAttachments.length > 0 ? generatedAttachments : undefined,
        })}\n\n`))
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
