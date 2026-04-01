import { createClient } from '@/lib/supabase/server'
import { getPresignedUploadUrl } from '@/lib/s3/client'
import { validateFile, getExtension, MAX_FILE_SIZE } from '@/lib/s3/file-types'
import { isValidUUID } from '@/lib/security/validate'
import { rateLimit, rateLimitResponse } from '@/lib/security/rate-limit'
import { randomUUID } from 'crypto'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const rl = rateLimit(user.id, 'files-upload')
  if (!rl.allowed) return rateLimitResponse(rl.resetAt)

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return new Response('Invalid JSON', { status: 400 })
  }

  const { fileName, fileType, fileSize, conversationId } = body as Record<string, unknown>

  if (typeof fileName !== 'string' || typeof fileType !== 'string' || typeof fileSize !== 'number') {
    return new Response('Missing required fields', { status: 400 })
  }

  if (conversationId && !isValidUUID(conversationId as string)) {
    return new Response('Invalid conversation ID', { status: 400 })
  }

  const validationError = validateFile(fileName, fileType, fileSize)
  if (validationError) {
    return new Response(JSON.stringify({ error: validationError }), { status: 400 })
  }

  const fileId = randomUUID()
  const ext = getExtension(fileType)
  const s3Key = `${user.id}/${conversationId || 'pending'}/${fileId}${ext}`

  const uploadUrl = await getPresignedUploadUrl(s3Key, fileType, MAX_FILE_SIZE)

  const { data: attachment, error } = await supabase
    .from('attachments')
    .insert({
      id: fileId,
      conversation_id: conversationId || null,
      user_id: user.id,
      file_name: fileName,
      file_type: fileType,
      file_size: fileSize,
      s3_key: s3Key,
    })
    .select('id')
    .single()

  if (error) {
    return new Response(JSON.stringify({ error: 'Failed to create attachment record' }), { status: 500 })
  }

  return Response.json({ attachmentId: attachment.id, uploadUrl, s3Key })
}
