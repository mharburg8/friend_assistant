import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { MessageSquare } from 'lucide-react'

interface RecentConversationsProps {
  conversations: Array<{
    id: string
    title: string | null
    mode: string | null
    updated_at: string
  }>
}

export function RecentConversations({ conversations }: RecentConversationsProps) {
  function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 60) return `${mins}m ago`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    return `${days}d ago`
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <MessageSquare className="h-4 w-4" />
          Recent Conversations
        </CardTitle>
      </CardHeader>
      <CardContent>
        {conversations.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">
            No conversations yet. Start one.
          </p>
        ) : (
          <div className="space-y-1">
            {conversations.map(convo => (
              <Link
                key={convo.id}
                href={`/chat/${convo.id}`}
                className="flex items-center justify-between p-2 rounded-md hover:bg-muted transition-colors"
              >
                <span className="text-sm truncate flex-1">
                  {convo.title || 'Untitled'}
                </span>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  {convo.mode && (
                    <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                      {convo.mode}
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {timeAgo(convo.updated_at)}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
