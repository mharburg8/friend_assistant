'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Folder, MessageSquare, GripVertical } from 'lucide-react'

interface Conversation {
  id: string
  title: string | null
  mode: string | null
  updated_at: string
  project_id: string | null
}

interface Project {
  id: string
  name: string
  color: string
}

interface ProjectBoardProps {
  conversations: Conversation[]
  projects: Project[]
}

const MODE_COLORS: Record<string, string> = {
  dev: 'bg-emerald-500',
  work: 'bg-blue-500',
  jobsearch: 'bg-amber-500',
  school: 'bg-purple-500',
  personal: 'bg-pink-500',
  alab: 'bg-cyan-500',
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export function ProjectBoard({ conversations: initialConversations, projects }: ProjectBoardProps) {
  const [conversations, setConversations] = useState(initialConversations)
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dragOverTarget, setDragOverTarget] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  async function moveToProject(convoId: string, projectId: string | null) {
    // Optimistic update
    setConversations(prev =>
      prev.map(c => c.id === convoId ? { ...c, project_id: projectId } : c)
    )
    await supabase
      .from('conversations')
      .update({ project_id: projectId })
      .eq('id', convoId)
    router.refresh()
  }

  function handleDragStart(e: React.DragEvent, convoId: string) {
    setDraggedId(convoId)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', convoId)
  }

  function handleDragOver(e: React.DragEvent, targetId: string) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverTarget(targetId)
  }

  function handleDragLeave() {
    setDragOverTarget(null)
  }

  function handleDrop(e: React.DragEvent, projectId: string | null) {
    e.preventDefault()
    const convoId = e.dataTransfer.getData('text/plain')
    if (convoId) {
      moveToProject(convoId, projectId)
    }
    setDraggedId(null)
    setDragOverTarget(null)
  }

  function handleDragEnd() {
    setDraggedId(null)
    setDragOverTarget(null)
  }

  // Group conversations
  const unassigned = conversations.filter(c => !c.project_id)
  const byProject = new Map<string, Conversation[]>()
  projects.forEach(p => byProject.set(p.id, []))
  conversations.forEach(c => {
    if (c.project_id && byProject.has(c.project_id)) {
      byProject.get(c.project_id)!.push(c)
    }
  })

  function ConvoItem({ convo }: { convo: Conversation }) {
    return (
      <div
        draggable
        onDragStart={e => handleDragStart(e, convo.id)}
        onDragEnd={handleDragEnd}
        className={`flex items-center gap-2 p-2 rounded-md hover:bg-muted/50 transition-colors cursor-grab active:cursor-grabbing ${
          draggedId === convo.id ? 'opacity-40' : ''
        }`}
      >
        <GripVertical className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
        {convo.mode && (
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${MODE_COLORS[convo.mode] || 'bg-muted-foreground'}`} />
        )}
        <Link href={`/chat/${convo.id}`} className="flex-1 min-w-0">
          <span className="text-sm truncate block">{convo.title || 'Untitled'}</span>
        </Link>
        <span className="text-[10px] text-muted-foreground shrink-0">{timeAgo(convo.updated_at)}</span>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold flex items-center gap-2">
        <MessageSquare className="h-4 w-4" />
        Conversations
      </h2>

      {/* Project columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {projects.map(project => {
          const convos = byProject.get(project.id) || []
          const isOver = dragOverTarget === project.id
          return (
            <Card
              key={project.id}
              onDragOver={e => handleDragOver(e, project.id)}
              onDragLeave={handleDragLeave}
              onDrop={e => handleDrop(e, project.id)}
              className={`transition-colors ${isOver ? 'ring-2 ring-primary bg-primary/5' : ''}`}
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Folder className="h-4 w-4" style={{ color: project.color }} />
                  {project.name}
                  <span className="text-xs text-muted-foreground ml-auto">{convos.length}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                {convos.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-3 text-center">
                    {draggedId ? 'Drop here' : 'Drag chats here'}
                  </p>
                ) : (
                  <div className="space-y-0.5">
                    {convos.map(c => <ConvoItem key={c.id} convo={c} />)}
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}

        {/* Unassigned */}
        <Card
          onDragOver={e => handleDragOver(e, 'unassigned')}
          onDragLeave={handleDragLeave}
          onDrop={e => handleDrop(e, null)}
          className={`transition-colors ${dragOverTarget === 'unassigned' ? 'ring-2 ring-primary bg-primary/5' : ''}`}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Recent Chats
              <span className="text-xs text-muted-foreground ml-auto">{unassigned.length}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {unassigned.length === 0 ? (
              <p className="text-xs text-muted-foreground py-3 text-center">No conversations yet</p>
            ) : (
              <div className="space-y-0.5">
                {unassigned.map(c => <ConvoItem key={c.id} convo={c} />)}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
