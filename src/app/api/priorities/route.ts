import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

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

  const { priorities } = await request.json()

  if (!Array.isArray(priorities)) {
    return new Response('priorities must be an array', { status: 400 })
  }

  const now = new Date()
  const weekStart = new Date(now)
  weekStart.setDate(now.getDate() - now.getDay())
  const weekOf = weekStart.toISOString().split('T')[0]

  // Clear existing priorities for this week
  await supabase
    .from('priorities')
    .delete()
    .eq('user_id', user.id)
    .eq('week_of', weekOf)

  // Insert new ones
  const rows = priorities.map((text: string, i: number) => ({
    user_id: user.id,
    week_of: weekOf,
    priority_text: text,
    rank: i + 1,
  }))

  const { data, error } = await supabase
    .from('priorities')
    .insert(rows)
    .select()

  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json(data)
}
