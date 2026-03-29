import type { MemoryNode } from '@/types/database'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Retrieve relevant memory nodes for context injection.
 * Phase 1: Returns recent memories by recency.
 * Phase 3 upgrade: Will use pgvector semantic search.
 */
export async function getRelevantMemories(
  supabase: SupabaseClient,
  userId: string,
  _query?: string,
  limit = 10
): Promise<MemoryNode[]> {
  // Phase 1: Simple recency-based retrieval
  const { data, error } = await supabase
    .from('memory_nodes')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('Failed to fetch memories:', error)
    return []
  }

  return data || []
}

/**
 * Get the user's current priorities for this week.
 */
export async function getCurrentPriorities(
  supabase: SupabaseClient,
  userId: string
): Promise<string[]> {
  const now = new Date()
  const weekStart = new Date(now)
  weekStart.setDate(now.getDate() - now.getDay())

  const { data, error } = await supabase
    .from('priorities')
    .select('priority_text')
    .eq('user_id', userId)
    .eq('completed', false)
    .gte('week_of', weekStart.toISOString().split('T')[0])
    .order('rank', { ascending: true })

  if (error) {
    console.error('Failed to fetch priorities:', error)
    return []
  }

  return (data || []).map(p => p.priority_text)
}

/**
 * Get or create the user profile.
 */
export async function getUserProfile(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from('user_profile')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (error && error.code === 'PGRST116') {
    // No profile exists — seed it
    const { data: newProfile } = await supabase.rpc('seed_user_profile', {
      p_user_id: userId,
    })
    // Fetch the newly created profile
    const { data: seeded } = await supabase
      .from('user_profile')
      .select('*')
      .eq('user_id', userId)
      .single()
    return seeded
  }

  return data
}
