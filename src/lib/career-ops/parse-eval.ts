/**
 * Parse [JOB_EVAL] tags from Claude's response.
 * Returns the evaluations and the cleaned response.
 */
export interface JobEvalData {
  company: string
  role: string
  url?: string
  archetype?: string
  score?: number
  status?: string
  notes?: string
}

export function parseJobEvals(response: string): {
  evals: JobEvalData[]
  cleanedResponse: string
} {
  const pattern = /\[JOB_EVAL\]\s*([\s\S]*?)\s*\[\/JOB_EVAL\]/g
  const evals: JobEvalData[] = []
  let match

  while ((match = pattern.exec(response)) !== null) {
    try {
      const data = JSON.parse(match[1].trim())
      if (data.company && data.role) {
        evals.push({
          company: data.company,
          role: data.role,
          url: data.url || null,
          archetype: data.archetype || null,
          score: typeof data.score === 'number' ? data.score : null,
          status: data.status || 'evaluated',
          notes: data.notes || null,
        })
      }
    } catch {
      // Skip malformed JSON
    }
  }

  const cleanedResponse = response
    .replace(pattern, '')
    .trim()

  return { evals, cleanedResponse }
}
