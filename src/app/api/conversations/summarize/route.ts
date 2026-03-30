import { createClient } from '@/lib/supabase/server'
import { summarizeConversation } from '@/lib/claude/summarize'
import { rateLimit, rateLimitResponse } from '@/lib/security/rate-limit'
import { isValidUUID } from '@/lib/security/validate'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return new Response('Unauthorized', { status: 401 })
  }

  const rl = rateLimit(user.id, 'summarize')
  if (!rl.allowed) return rateLimitResponse(rl.resetAt)

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return new Response('Invalid JSON', { status: 400 })
  }

  const conversationId = (body as Record<string, unknown>).conversationId as string

  if (!conversationId || !isValidUUID(conversationId)) {
    return new Response('Invalid conversationId', { status: 400 })
  }

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

  return Response.json({ ok: true })
}
