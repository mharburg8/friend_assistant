import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Sidebar } from '@/components/layout/Sidebar'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const [{ data: conversations }, { data: projects }] = await Promise.all([
    supabase
      .from('conversations')
      .select('id, title, mode, updated_at, project_id')
      .eq('user_id', user.id)
      .is('archived_at', null)
      .order('updated_at', { ascending: false })
      .limit(50),
    supabase
      .from('projects')
      .select('id, name, color')
      .eq('user_id', user.id)
      .is('archived_at', null)
      .order('name', { ascending: true }),
  ])

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        conversations={conversations || []}
        projects={projects || []}
        userEmail={user.email || ''}
      />
      <main className="flex-1 flex flex-col overflow-hidden">
        {children}
      </main>
    </div>
  )
}
