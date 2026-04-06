'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ChatMessages } from './ChatMessages'
import { ChatInput } from './ChatInput'
import { ComputerUsePreview } from './ComputerUsePreview'
import { ModeSelector } from '@/components/layout/ModeSelector'
import { ProjectSelector } from './ProjectSelector'
import type { Mode, Attachment } from '@/types/database'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  attachments?: Attachment[]
  screenshot?: string
}

interface ChatInterfaceProps {
  conversationId?: string
  initialMessages?: ChatMessage[]
  mode?: string | null
  projectId?: string | null
}

export function ChatInterface({
  conversationId: initialConversationId,
  initialMessages = [],
  mode: initialMode = null,
  projectId: initialProjectId = null,
}: ChatInterfaceProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages)
  const [isStreaming, setIsStreaming] = useState(false)
  const [conversationId, setConversationId] = useState(initialConversationId)
  const [mode, setMode] = useState<Mode | null>(initialMode as Mode | null)
  const [computerScreenshot, setComputerScreenshot] = useState<string | null>(null)
  const router = useRouter()
  const abortControllerRef = useRef<AbortController | null>(null)
  const conversationIdRef = useRef(initialConversationId)

  // Keep ref in sync so cleanup can use latest value
  useEffect(() => {
    conversationIdRef.current = conversationId
  }, [conversationId])

  useEffect(() => {
    return () => {
      const id = conversationIdRef.current
      if (id && messages.length >= 4) {
        fetch('/api/conversations/summarize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ conversationId: id }),
        }).catch(() => {})
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const sendMessage = useCallback(async (content: string, attachmentIds: string[] = []) => {
    if (isStreaming) return

    const userMessage: ChatMessage = { role: 'user', content }
    const newMessages = [...messages, userMessage]
    setMessages(newMessages)
    setIsStreaming(true)

    setMessages(prev => [...prev, { role: 'assistant', content: '' }])

    try {
      abortControllerRef.current = new AbortController()

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
          conversationId,
          mode,
          attachmentIds,
        }),
        signal: abortControllerRef.current.signal,
      })

      if (!response.ok) throw new Error('Chat request failed')

      const reader = response.body?.getReader()
      if (!reader) throw new Error('No response body')

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const jsonStr = line.slice(6)
          try {
            const data = JSON.parse(jsonStr)

            if (data.error) {
              console.error('Stream error:', data.error)
              break
            }

            // Capture conversationId from ANY chunk (not just done)
            if (data.conversationId && data.conversationId !== conversationIdRef.current) {
              setConversationId(data.conversationId)
              conversationIdRef.current = data.conversationId
              router.replace(`/chat/${data.conversationId}`, { scroll: false })
            }

            if (data.done) {
              if (data.generatedAttachments?.length > 0) {
                setMessages(prev => {
                  const updated = [...prev]
                  const last = updated[updated.length - 1]
                  if (last.role === 'assistant') {
                    updated[updated.length - 1] = {
                      ...last,
                      attachments: data.generatedAttachments,
                    }
                  }
                  return updated
                })
              }
              break
            }

            // Handle computer use screenshots
            if (data.screenshot) {
              setComputerScreenshot(data.screenshot)
              // Also attach to the last assistant message
              setMessages(prev => {
                const updated = [...prev]
                const last = updated[updated.length - 1]
                if (last.role === 'assistant') {
                  updated[updated.length - 1] = {
                    ...last,
                    screenshot: data.screenshot,
                  }
                }
                return updated
              })
            }

            if (data.text) {
              setMessages(prev => {
                const updated = [...prev]
                const last = updated[updated.length - 1]
                if (last.role === 'assistant') {
                  updated[updated.length - 1] = {
                    ...last,
                    content: last.content + data.text,
                  }
                }
                return updated
              })
            }
          } catch {
            // Skip malformed JSON
          }
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return
      console.error('Chat error:', err)
      setMessages(prev => {
        const updated = [...prev]
        const last = updated[updated.length - 1]
        if (last.role === 'assistant' && last.content === '') {
          updated[updated.length - 1] = {
            ...last,
            content: 'Something went wrong. Try again.',
          }
        }
        return updated
      })
    } finally {
      setIsStreaming(false)
    }
  }, [messages, isStreaming, conversationId, mode, router])

  function handleStop() {
    abortControllerRef.current?.abort()
    setIsStreaming(false)
  }

  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-4 py-2 flex items-center justify-between">
        <ModeSelector currentMode={mode} onModeChange={setMode} />
        <ProjectSelector conversationId={conversationId} currentProjectId={initialProjectId} />
      </div>
      <div className="flex flex-1 min-h-0">
        <div className={`flex flex-col ${computerScreenshot ? 'flex-1' : 'w-full'}`}>
          <ChatMessages messages={messages} isStreaming={isStreaming} />
          <ChatInput
            onSend={sendMessage}
            onStop={handleStop}
            isStreaming={isStreaming}
            disabled={isStreaming}
            conversationId={conversationId}
          />
        </div>
        {computerScreenshot && (
          <ComputerUsePreview
            screenshot={computerScreenshot}
            onClose={() => setComputerScreenshot(null)}
          />
        )}
      </div>
    </div>
  )
}
