'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Target, Plus, X, Check } from 'lucide-react'

interface Priority {
  id: string
  priority_text: string
  rank: number
  completed: boolean
}

export function PrioritiesPanel() {
  const [priorities, setPriorities] = useState<Priority[]>([])
  const [newPriority, setNewPriority] = useState('')
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    fetch('/api/priorities')
      .then(r => r.json())
      .then(data => setPriorities(data || []))
      .catch(() => {})
  }, [])

  async function addPriority() {
    if (!newPriority.trim()) return

    const updated = [...priorities.map(p => p.priority_text), newPriority.trim()]
    await fetch('/api/priorities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ priorities: updated }),
    })
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setPriorities(data)
      })

    setNewPriority('')
  }

  async function removePriority(index: number) {
    const updated = priorities
      .filter((_, i) => i !== index)
      .map(p => p.priority_text)

    await fetch('/api/priorities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ priorities: updated }),
    })
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setPriorities(data)
      })
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Target className="h-4 w-4" />
          This Week&apos;s Priorities
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {priorities.length === 0 && !editing ? (
          <p className="text-sm text-muted-foreground py-2">
            No priorities set. What matters most this week?
          </p>
        ) : (
          <ol className="space-y-2">
            {priorities.map((p, i) => (
              <li key={p.id} className="flex items-center gap-2 group">
                <span className="text-xs font-medium text-muted-foreground w-4">
                  {i + 1}.
                </span>
                <span className="text-sm flex-1">{p.priority_text}</span>
                <button
                  onClick={() => removePriority(i)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                </button>
              </li>
            ))}
          </ol>
        )}

        <div className="flex gap-2">
          <Input
            value={newPriority}
            onChange={e => setNewPriority(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addPriority()}
            placeholder="Add a priority..."
            className="text-sm h-8"
          />
          <Button
            size="sm"
            variant="outline"
            onClick={addPriority}
            disabled={!newPriority.trim()}
            className="h-8 px-2"
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
