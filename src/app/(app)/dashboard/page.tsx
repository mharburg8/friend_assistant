import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { MessageSquarePlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { BriefingPanel } from '@/components/dashboard/BriefingPanel'
import { PrioritiesPanel } from '@/components/dashboard/PrioritiesPanel'
import { RecentConversations } from '@/components/dashboard/RecentConversations'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: recentConversations } = await supabase
    .from('conversations')
    .select('id, title, mode, updated_at')
    .eq('user_id', user!.id)
    .is('archived_at', null)
    .order('updated_at', { ascending: false })
    .limit(8)

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto p-6 space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight">ORACLE</h1>
          <Link href="/chat">
            <Button className="gap-2">
              <MessageSquarePlus className="w-4 h-4" />
              New Chat
            </Button>
          </Link>
        </div>

        {/* Briefing */}
        <BriefingPanel />

        {/* Two columns: priorities + recent */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <PrioritiesPanel />
          <RecentConversations conversations={recentConversations || []} />
        </div>
      </div>
    </div>
  )
}
