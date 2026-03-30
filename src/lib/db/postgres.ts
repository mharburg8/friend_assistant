/**
 * Direct PostgreSQL client for self-hosted mode.
 * Used when AUTH_MODE=self-hosted (AWS HIPAA deployment).
 * Falls back to Supabase client when running on Vercel.
 */

// Dynamic import to avoid bundling pg when not needed
let pool: any = null

async function getPool() {
  if (!pool) {
    const { Pool } = await import('pg')
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
      max: 10,
    })
  }
  return pool
}

export async function query(text: string, params?: any[]) {
  const p = await getPool()
  return p.query(text, params)
}

export async function queryOne(text: string, params?: any[]) {
  const result = await query(text, params)
  return result.rows[0] || null
}

export async function queryAll(text: string, params?: any[]) {
  const result = await query(text, params)
  return result.rows
}

/**
 * Execute a query as a specific user (sets RLS context).
 */
export async function queryAsUser(userId: string, text: string, params?: any[]) {
  const p = await getPool()
  const client = await p.connect()
  try {
    await client.query(`SET LOCAL app.current_user_id = '${userId}'`)
    const result = await client.query(text, params)
    return result.rows
  } finally {
    client.release()
  }
}

export function isSelfHosted(): boolean {
  return process.env.AUTH_MODE === 'self-hosted'
}
