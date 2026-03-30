/**
 * Self-hosted auth for AWS HIPAA deployment.
 * Simple session-based auth with bcrypt passwords.
 * Used when AUTH_MODE=self-hosted.
 */
import { cookies } from 'next/headers'
import { query, queryOne } from './postgres'

// Simple JWT-like token using HMAC
async function createToken(userId: string): Promise<string> {
  const crypto = await import('crypto')
  const secret = process.env.AUTH_SECRET!
  const payload = JSON.stringify({ userId, exp: Date.now() + 7 * 24 * 60 * 60 * 1000 })
  const encoded = Buffer.from(payload).toString('base64url')
  const sig = crypto.createHmac('sha256', secret).update(encoded).digest('base64url')
  return `${encoded}.${sig}`
}

async function verifyToken(token: string): Promise<{ userId: string } | null> {
  const crypto = await import('crypto')
  const secret = process.env.AUTH_SECRET!
  const [encoded, sig] = token.split('.')
  if (!encoded || !sig) return null

  const expectedSig = crypto.createHmac('sha256', secret).update(encoded).digest('base64url')
  if (sig !== expectedSig) return null

  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString())
    if (payload.exp < Date.now()) return null
    return { userId: payload.userId }
  } catch {
    return null
  }
}

export async function signUp(email: string, password: string) {
  const bcrypt = await import('bcryptjs')
  const hash = await bcrypt.hash(password, 12)

  try {
    const result = await queryOne(
      'INSERT INTO auth.users (email, encrypted_password) VALUES ($1, $2) RETURNING id, email',
      [email, hash]
    )
    return { user: result, error: null }
  } catch (err: any) {
    if (err.code === '23505') {
      return { user: null, error: 'Email already registered' }
    }
    return { user: null, error: 'Failed to create account' }
  }
}

export async function signIn(email: string, password: string) {
  const bcrypt = await import('bcryptjs')
  const user = await queryOne('SELECT id, email, encrypted_password FROM auth.users WHERE email = $1', [email])

  if (!user) return { user: null, error: 'Invalid email or password' }

  const valid = await bcrypt.compare(password, user.encrypted_password)
  if (!valid) return { user: null, error: 'Invalid email or password' }

  const token = await createToken(user.id)
  const cookieStore = await cookies()
  cookieStore.set('oracle-session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60,
    path: '/',
  })

  return { user: { id: user.id, email: user.email }, error: null }
}

export async function signOut() {
  const cookieStore = await cookies()
  cookieStore.delete('oracle-session')
}

export async function getUser() {
  const cookieStore = await cookies()
  const token = cookieStore.get('oracle-session')?.value
  if (!token) return null

  const payload = await verifyToken(token)
  if (!payload) return null

  const user = await queryOne('SELECT id, email FROM auth.users WHERE id = $1', [payload.userId])
  return user
}
