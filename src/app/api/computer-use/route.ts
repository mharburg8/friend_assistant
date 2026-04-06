import { createClient } from '@/lib/supabase/server'
import { rateLimit, rateLimitResponse } from '@/lib/security/rate-limit'

const AGENT_URL = process.env.COMPUTER_AGENT_URL || 'http://3.138.91.167:8585'
const AGENT_API_KEY = process.env.COMPUTER_AGENT_API_KEY || ''

export async function POST(request: Request) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return new Response('Unauthorized', { status: 401 })
  }

  const rl = rateLimit(user.id, 'chat')
  if (!rl.allowed) return rateLimitResponse(rl.resetAt)

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return new Response('Invalid JSON', { status: 400 })
  }

  const { task, max_steps } = body as { task?: string; max_steps?: number }

  if (!task || typeof task !== 'string' || task.length === 0) {
    return new Response(
      JSON.stringify({ error: 'task is required' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }

  if (task.length > 2000) {
    return new Response(
      JSON.stringify({ error: 'task too long (max 2000 chars)' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (AGENT_API_KEY) {
      headers['Authorization'] = `Bearer ${AGENT_API_KEY}`
    }

    const agentResponse = await fetch(`${AGENT_URL}/task`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        task,
        max_steps: max_steps && max_steps > 0 && max_steps <= 50
          ? max_steps
          : undefined,
      }),
      signal: AbortSignal.timeout(300_000), // 5 minute timeout
    })

    if (!agentResponse.ok) {
      const err = await agentResponse.text()
      return new Response(
        JSON.stringify({ error: 'Agent request failed', detail: err }),
        { status: 502, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const result = await agentResponse.json()

    // Log to action_log
    await supabase.from('action_log').insert({
      user_id: user.id,
      action: 'computer_use',
      reasoning: task,
      status: result.result ? 'completed' : 'failed',
      metadata: {
        steps_taken: result.steps_taken,
        result_summary: result.result?.slice(0, 500),
      },
    })

    return new Response(
      JSON.stringify({
        result: result.result,
        steps_taken: result.steps_taken,
        final_screenshot: result.final_screenshot
          ? `data:image/png;base64,${result.final_screenshot}`
          : null,
      }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    const error = err as Error
    if (error.name === 'TimeoutError') {
      return new Response(
        JSON.stringify({ error: 'Agent timed out' }),
        { status: 504, headers: { 'Content-Type': 'application/json' } }
      )
    }
    return new Response(
      JSON.stringify({ error: 'Failed to reach agent', detail: error.message }),
      { status: 502, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
