'use client'

import { useState, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { RefreshCw, Sparkles } from 'lucide-react'

export function BriefingPanel() {
  const [briefing, setBriefing] = useState('')
  const [loading, setLoading] = useState(false)
  const [hasLoaded, setHasLoaded] = useState(false)

  async function loadBriefing() {
    setLoading(true)
    setBriefing('')

    try {
      const response = await fetch('/api/briefing')
      if (!response.ok) throw new Error('Failed to load briefing')

      const reader = response.body?.getReader()
      if (!reader) return

      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        setBriefing(prev => prev + decoder.decode(value, { stream: true }))
      }

      setHasLoaded(true)
    } catch (err) {
      console.error('Briefing error:', err)
      setBriefing('Failed to generate briefing. Check your API key.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Sparkles className="h-4 w-4" />
          Morning Briefing
        </CardTitle>
        <Button
          variant="ghost"
          size="sm"
          onClick={loadBriefing}
          disabled={loading}
          className="h-8"
        >
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
          {hasLoaded ? 'Refresh' : 'Generate'}
        </Button>
      </CardHeader>
      <CardContent>
        {briefing ? (
          <div className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {briefing}
            </ReactMarkdown>
          </div>
        ) : loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
            <div className="w-2 h-2 bg-foreground/50 rounded-full animate-pulse" />
            Generating your briefing...
          </div>
        ) : (
          <p className="text-sm text-muted-foreground py-4">
            Click Generate to get your morning briefing.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
