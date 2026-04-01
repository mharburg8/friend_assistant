import { createClient } from '@/lib/supabase/server'
import { getPresignedDownloadUrl, deleteObject } from '@/lib/s3/client'
import { isValidUUID } from '@/lib/security/validate'
import { rateLimit, rateLimitResponse } from '@/lib/security/rate-limit'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const rl = rateLimit(user.id, 'files-download')
  if (!rl.allowed) return rateLimitResponse(rl.resetAt)

  if (!isValidUUID(id)) {
    return new Response('Invalid file ID', { status: 400 })
  }

  const { data: attachment, error } = await supabase
    .from('attachments')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (error || !attachment) {
    return new Response('File not found', { status: 404 })
  }

  const url = await getPresignedDownloadUrl(attachment.s3_key)

  return Response.json({
    url,
    fileName: attachment.file_name,
    fileType: attachment.file_type,
    fileSize: attachment.file_size,
  })
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  if (!isValidUUID(id)) {
    return new Response('Invalid file ID', { status: 400 })
  }

  const { data: attachment, error } = await supabase
    .from('attachments')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (error || !attachment) {
    return new Response('File not found', { status: 404 })
  }

  await deleteObject(attachment.s3_key)

  await supabase.from('attachments').delete().eq('id', id)

  return Response.json({ ok: true })
}
