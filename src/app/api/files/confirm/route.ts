import { createClient } from '@/lib/supabase/server'
import { isValidUUID } from '@/lib/security/validate'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return new Response('Invalid JSON', { status: 400 })
  }

  const { attachmentIds, messageId } = body as Record<string, unknown>

  if (!Array.isArray(attachmentIds) || !attachmentIds.every(id => isValidUUID(id))) {
    return new Response('Invalid attachment IDs', { status: 400 })
  }
  if (typeof messageId !== 'string' || !isValidUUID(messageId)) {
    return new Response('Invalid message ID', { status: 400 })
  }

  const { error } = await supabase
    .from('attachments')
    .update({ message_id: messageId })
    .in('id', attachmentIds)
    .eq('user_id', user.id)

  if (error) {
    return new Response(JSON.stringify({ error: 'Failed to confirm attachments' }), { status: 500 })
  }

  return Response.json({ ok: true })
}
