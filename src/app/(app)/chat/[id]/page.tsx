import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { ChatInterface } from '@/components/chat/ChatInterface'
import type { Message } from '@/types/database'

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: conversation } = await supabase
    .from('conversations')
    .select('*')
    .eq('id', id)
    .single()

  if (!conversation) {
    notFound()
  }

  const { data: messages } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', id)
    .order('created_at', { ascending: true })

  const formattedMessages = (messages || []).map((m: Message) => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }))

  return (
    <ChatInterface
      conversationId={id}
      initialMessages={formattedMessages}
      mode={conversation.mode}
    />
  )
}
