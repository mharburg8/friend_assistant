import { createClient } from '@/lib/supabase/server'
import { getClaudeClient, getModelId } from '@/lib/claude/client'
import { getRelevantMemories, getCurrentPriorities, getUserProfile } from '@/lib/claude/memory'
import { rateLimit, rateLimitResponse } from '@/lib/security/rate-limit'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const rl = rateLimit(user.id, 'briefing')
  if (!rl.allowed) return rateLimitResponse(rl.resetAt)

  const [profile, memories, priorities] = await Promise.all([
    getUserProfile(supabase, user.id),
    getRelevantMemories(supabase, user.id, undefined, 20),
    getCurrentPriorities(supabase, user.id),
  ])

  // Get recent conversations (last 3 days)
  const threeDaysAgo = new Date()
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)

  const { data: recentConvos } = await supabase
    .from('conversations')
    .select('title, mode, updated_at')
    .eq('user_id', user.id)
    .gte('updated_at', threeDaysAgo.toISOString())
    .order('updated_at', { ascending: false })
    .limit(10)

  // Get recent action log
  const { data: recentActions } = await supabase
    .from('action_log')
    .select('action, status, created_at')
    .eq('user_id', user.id)
    .gte('created_at', threeDaysAgo.toISOString())
    .order('created_at', { ascending: false })
    .limit(5)

  const claude = getClaudeClient()

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const stream = await claude.messages.stream({
    model: getModelId('sonnet'),
    max_tokens: 1024,
    system: [
      {
        type: 'text',
        text: `You are Claude, Mark's personal AI. Generate a morning briefing. Be direct, real, and brief. No filler. This is how Mark starts his day — make it count.

Mark's profile: ${JSON.stringify(profile?.profile_json || {})}

Format the briefing as markdown with these sections:
## Good morning, Mark
(One genuine sentence — not generic motivation)

## Priorities
(His current priorities, with any observations you have)

## Recent Activity
(What he's been working on, any patterns you notice)

## Things to Flag
(Anything you'd surface proactively — gaps, opportunities, things he might be forgetting)

Keep it tight. No bullet point inflation.`,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [
      {
        role: 'user',
        content: `Today is ${today}.

Current priorities: ${priorities.length > 0 ? priorities.join(', ') : 'None set this week'}

Recent conversations (last 3 days): ${JSON.stringify(recentConvos || [])}

Recent memories: ${memories.map(m => m.content).join('\n')}

Recent actions: ${JSON.stringify(recentActions || [])}

Generate my morning briefing.`,
      },
    ],
  })

  const encoder = new TextEncoder()

  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            controller.enqueue(encoder.encode(event.delta.text))
          }
        }
        controller.close()
      } catch (err) {
        console.error('Briefing stream error:', err)
        controller.close()
      }
    },
  })

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache',
    },
  })
}
