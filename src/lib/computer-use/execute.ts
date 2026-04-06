const AGENT_URL = process.env.COMPUTER_AGENT_URL || 'http://3.138.91.167:8585'
const AGENT_API_KEY = process.env.COMPUTER_AGENT_API_KEY || ''

export interface ComputerTaskResult {
  result: string
  steps_taken: number
  final_screenshot: string | null
}

/**
 * Parse [COMPUTER_TASK]...[/COMPUTER_TASK] tags from Claude's response.
 * Returns the tasks found and the response with tags replaced by placeholders.
 */
export function parseComputerTasks(response: string): {
  tasks: string[]
  cleanedResponse: string
} {
  const pattern = /\[COMPUTER_TASK\]\s*([\s\S]*?)\s*\[\/COMPUTER_TASK\]/g
  const tasks: string[] = []
  let match

  while ((match = pattern.exec(response)) !== null) {
    tasks.push(match[1].trim())
  }

  const cleanedResponse = response
    .replace(pattern, '[Executing computer task...]')
    .trim()

  return { tasks, cleanedResponse }
}

/**
 * Execute a computer use task on the remote agent server.
 */
export async function executeComputerTask(
  task: string,
  maxSteps?: number
): Promise<ComputerTaskResult> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (AGENT_API_KEY) {
    headers['Authorization'] = `Bearer ${AGENT_API_KEY}`
  }

  const resp = await fetch(`${AGENT_URL}/task`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      task,
      max_steps: maxSteps,
    }),
    signal: AbortSignal.timeout(300_000),
  })

  if (!resp.ok) {
    const err = await resp.text()
    throw new Error(`Agent error (${resp.status}): ${err}`)
  }

  const data = await resp.json()

  return {
    result: data.result || '',
    steps_taken: data.steps_taken || 0,
    final_screenshot: data.final_screenshot || null,
  }
}
