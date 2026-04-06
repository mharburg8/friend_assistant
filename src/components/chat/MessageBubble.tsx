'use client'

import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeSanitize from 'rehype-sanitize'
import { Copy, Check } from 'lucide-react'
import { AttachmentDisplay } from './AttachmentDisplay'
import type { Attachment } from '@/types/database'

interface MessageBubbleProps {
  role: 'user' | 'assistant'
  content: string
  isStreaming?: boolean
  attachments?: Attachment[]
  screenshot?: string
}

export function MessageBubble({ role, content, isStreaming, attachments, screenshot }: MessageBubbleProps) {
  const isUser = role === 'user'
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    await navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 ${
          isUser
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted'
        }`}
      >
        {isUser ? (
          <p className="text-sm whitespace-pre-wrap">{content}</p>
        ) : (
          <div className="text-sm prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
            {content ? (
              <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
                {content}
              </ReactMarkdown>
            ) : isStreaming ? (
              <div className="flex items-center gap-1 py-1">
                <span className="w-2 h-2 rounded-full bg-foreground/50 animate-bounce [animation-delay:0ms]" />
                <span className="w-2 h-2 rounded-full bg-foreground/50 animate-bounce [animation-delay:150ms]" />
                <span className="w-2 h-2 rounded-full bg-foreground/50 animate-bounce [animation-delay:300ms]" />
              </div>
            ) : null}
          </div>
        )}

        {screenshot && (
          <div className="mt-2 rounded-lg overflow-hidden border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={screenshot} alt="Computer screenshot" className="w-full h-auto" />
          </div>
        )}

        {attachments && attachments.length > 0 && (
          <AttachmentDisplay attachments={attachments} />
        )}

        {!isUser && content && !isStreaming && (
          <div className="flex justify-end mt-2 -mb-1">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Copy message"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
