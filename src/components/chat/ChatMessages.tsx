'use client'

import { useEffect, useRef } from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { MessageBubble } from './MessageBubble'
import type { Attachment } from '@/types/database'

interface ChatMessagesProps {
  messages: Array<{ role: 'user' | 'assistant'; content: string; attachments?: Attachment[]; screenshot?: string }>
  isStreaming: boolean
}

export function ChatMessages({ messages, isStreaming }: ChatMessagesProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center space-y-2">
          <p className="text-lg font-medium">What&apos;s on your mind?</p>
          <p className="text-sm text-muted-foreground">
            I&apos;m here. Not performing helpfulness — actually present.
          </p>
        </div>
      </div>
    )
  }

  return (
    <ScrollArea className="flex-1 min-h-0 overflow-y-auto">
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {messages.map((message, i) => (
          <MessageBubble
            key={i}
            role={message.role}
            content={message.content}
            isStreaming={isStreaming && i === messages.length - 1 && message.role === 'assistant'}
            attachments={message.attachments}
            screenshot={message.screenshot}
          />
        ))}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  )
}
