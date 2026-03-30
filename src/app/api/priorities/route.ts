import { createClient } from '@/lib/supabase/server'
import { rateLimit, rateLimitResponse } from '@/lib/security/rate-limit'
import { validatePriorities } from '@/lib/security/validate'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const rl = rateLimit(user.id, 'priorities')
  if (!rl.allowed) return rateLimitResponse(rl.resetAt)

  const now = new Date()
  const weekStart = new Date(now)
  weekStart.setDate(now.getDate() - now.getDay())

  const { data } = await supabase
    .from('priorities')
    .select('*')
    .eq('user_id', user.id)
    .gte('week_of', weekStart.toISOString().split('T')[0])
    .order('rank', { ascending: true })

  return Response.json(data || [])
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const rl = rateLimit(user.id, 'priorities')
  if (!rl.allowed) return rateLimitResponse(rl.resetAt)

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return new Response('Invalid JSON', { status: 400 })
  }

  const priorities = validatePriorities((body as Record<string, unknown>).priorities)
  if (!priorities) {
    return new Response('Invalid priorities format', { status: 400 })
  }

  const now = new Date()
  const weekStart = new Date(now)
  weekStart.setDate(now.getDate() - now.getDay())
  const weekOf = weekStart.toISOString().split('T')[0]

  await supabase
    .from('priorities')
    .delete()
    .eq('user_id', user.id)
    .eq('week_of', weekOf)

  const rows = priorities.map((text, i) => ({
    user_id: user.id,
    week_of: weekOf,
    priority_text: text.trim(),
    rank: i + 1,
  }))

  const { data, error } = await supabase
    .from('priorities')
    .insert(rows)
    .select()

  if (error) return Response.json({ error: 'Failed to save priorities' }, { status: 500 })

  return Response.json(data)
}
