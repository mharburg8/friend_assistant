import { createClient } from '@/lib/supabase/server'
import { summarizeConversation } from '@/lib/claude/summarize'

/**
 * POST /api/conversations/summarize
 * Summarize a conversation into memory nodes.
 * Called when user navigates away or conversation goes idle.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { conversationId } = await request.json()

  if (!conversationId) {
    return new Response('Missing conversationId', { status: 400 })
  }

  // Verify ownership
  const { data: convo } = await supabase
    .from('conversations')
    .select('id')
    .eq('id', conversationId)
    .eq('user_id', user.id)
    .single()

  if (!convo) {
    return new Response('Not found', { status: 404 })
  }

  await summarizeConversation(supabase, conversationId, user.id)

  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' },
  })
}
