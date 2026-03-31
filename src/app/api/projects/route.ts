import { createClient } from '@/lib/supabase/server'
import { rateLimit, rateLimitResponse } from '@/lib/security/rate-limit'
import { sanitizeString } from '@/lib/security/validate'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { data } = await supabase
    .from('projects')
    .select('*')
    .eq('user_id', user.id)
    .is('archived_at', null)
    .order('name', { ascending: true })

  return Response.json(data || [])
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const rl = rateLimit(user.id, 'default')
  if (!rl.allowed) return rateLimitResponse(rl.resetAt)

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return new Response('Invalid JSON', { status: 400 })
  }

  const { name, description, color } = body as Record<string, unknown>

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return new Response('Name is required', { status: 400 })
  }

  const { data, error } = await supabase
    .from('projects')
    .insert({
      user_id: user.id,
      name: sanitizeString(name, 100),
      description: description ? sanitizeString(description as string, 500) : null,
      color: typeof color === 'string' ? color.slice(0, 7) : '#6366f1',
    })
    .select()
    .single()

  if (error) return Response.json({ error: 'Failed to create project' }, { status: 500 })

  return Response.json(data)
}
