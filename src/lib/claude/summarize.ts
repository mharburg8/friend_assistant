import { getClaudeClient, getModelId } from './client'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Summarize a conversation into memory nodes (mid-term memory).
 * Extracts: summary, key facts, and sentiment.
 * Called when a conversation goes idle or is explicitly archived.
 */
export async function summarizeConversation(
  supabase: SupabaseClient,
  conversationId: string,
  userId: string
) {
  // Fetch all messages
  const { data: messages } = await supabase
    .from('messages')
    .select('role, content, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })

  if (!messages || messages.length < 2) return

  const transcript = messages
    .map(m => `${m.role}: ${m.content}`)
    .join('\n\n')

  const claude = getClaudeClient()

  const response = await claude.messages.create({
    model: getModelId('haiku'),
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `Analyze this conversation and extract structured memory. Be concise.

CONVERSATION:
${transcript}

Return JSON with this exact structure:
{
  "summary": "2-3 sentence summary of what was discussed and decided",
  "facts": ["fact 1", "fact 2", ...],
  "sentiment": "how Mark seemed to feel — not just 'good' or 'bad', but the texture of it"
}

Only include facts that would be useful to remember in future conversations. Skip trivial details.`,
      },
    ],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''

  try {
    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return

    const parsed = JSON.parse(jsonMatch[0])

    // Insert summary node
    if (parsed.summary) {
      await supabase.from('memory_nodes').insert({
        user_id: userId,
        type: 'summary',
        content: parsed.summary,
        sentiment: parsed.sentiment || null,
        source_conversation_id: conversationId,
      })
    }

    // Insert fact nodes
    if (parsed.facts && Array.isArray(parsed.facts)) {
      const factRows = parsed.facts.map((fact: string) => ({
        user_id: userId,
        type: 'fact' as const,
        content: fact,
        source_conversation_id: conversationId,
      }))

      if (factRows.length > 0) {
        await supabase.from('memory_nodes').insert(factRows)
      }
    }

    // Insert sentiment node if present
    if (parsed.sentiment) {
      await supabase.from('memory_nodes').insert({
        user_id: userId,
        type: 'sentiment',
        content: parsed.sentiment,
        source_conversation_id: conversationId,
      })
    }
  } catch (err) {
    console.error('Failed to parse conversation summary:', err)
  }
}
