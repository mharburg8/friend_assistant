import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function RootPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    // Authenticated — go to dashboard (handled by (app) group)
    redirect('/dashboard')
  } else {
    redirect('/login')
  }
}
