'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Folder, FolderPlus, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface Project {
  id: string
  name: string
  color: string
}

interface ProjectSelectorProps {
  conversationId?: string
  currentProjectId?: string | null
}

export function ProjectSelector({ conversationId, currentProjectId }: ProjectSelectorProps) {
  const [projects, setProjects] = useState<Project[]>([])
  const [projectId, setProjectId] = useState(currentProjectId)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    fetch('/api/projects')
      .then(r => r.json())
      .then(setProjects)
      .catch(() => {})
  }, [])

  async function assignProject(newProjectId: string | null) {
    if (!conversationId) return
    await supabase
      .from('conversations')
      .update({ project_id: newProjectId })
      .eq('id', conversationId)
    setProjectId(newProjectId)
    router.refresh()
  }

  const currentProject = projects.find(p => p.id === projectId)

  if (!conversationId) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-1.5 h-7 px-2 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors outline-none">
        <Folder className="h-3.5 w-3.5" style={currentProject ? { color: currentProject.color } : undefined} />
        {currentProject ? currentProject.name : 'Add to project'}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        {projects.map(p => (
          <DropdownMenuItem key={p.id} onClick={() => assignProject(p.id)}>
            <Folder className="h-3.5 w-3.5 mr-2" style={{ color: p.color }} />
            {p.name}
            {p.id === projectId && <Check className="h-3.5 w-3.5 ml-auto" />}
          </DropdownMenuItem>
        ))}
        {projectId && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => assignProject(null)}>
              <X className="h-3.5 w-3.5 mr-2" />
              Remove from project
            </DropdownMenuItem>
          </>
        )}
        {projects.length === 0 && (
          <DropdownMenuItem disabled>
            <FolderPlus className="h-3.5 w-3.5 mr-2" />
            No projects yet
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
