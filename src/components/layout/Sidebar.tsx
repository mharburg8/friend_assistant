'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  MessageSquarePlus,
  PanelLeftClose,
  PanelLeft,
  LogOut,
  User,
  Home,
  FolderPlus,
  Folder,
  ChevronDown,
  ChevronRight,
  Search,
  MoreHorizontal,
  Trash2,
  FolderInput,
} from 'lucide-react'

interface Project {
  id: string
  name: string
  color: string
}

interface Conversation {
  id: string
  title: string | null
  mode: string | null
  updated_at: string
  project_id: string | null
}

interface SidebarProps {
  conversations: Conversation[]
  projects?: Project[]
  userEmail: string
}

const MODE_COLORS: Record<string, string> = {
  dev: 'bg-emerald-500',
  work: 'bg-blue-500',
  jobsearch: 'bg-amber-500',
  school: 'bg-purple-500',
  personal: 'bg-pink-500',
  alab: 'bg-cyan-500',
}

export function Sidebar({ conversations, projects = [], userEmail }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(true)
  const [isMobile, setIsMobile] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set(['unassigned']))
  const [creatingProject, setCreatingProject] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  // Detect mobile and auto-collapse
  useEffect(() => {
    const check = () => {
      const mobile = window.innerWidth < 768
      setIsMobile(mobile)
      if (mobile) setCollapsed(true)
      else setCollapsed(false)
    }
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // Auto-close sidebar on mobile when navigating
  useEffect(() => {
    if (isMobile) setCollapsed(true)
  }, [pathname, isMobile])

  const closeMobile = useCallback(() => {
    if (isMobile) setCollapsed(true)
  }, [isMobile])

  async function handleSignOut() {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  function toggleProject(id: string) {
    setExpandedProjects(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function createProject() {
    if (!newProjectName.trim()) return
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newProjectName.trim() }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        console.error('Failed to create project:', err)
        return
      }
      setNewProjectName('')
      setCreatingProject(false)
      router.refresh()
    } catch (err) {
      console.error('Error creating project:', err)
    }
  }

  async function deleteConversation(id: string, e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    await supabase.from('conversations').update({ archived_at: new Date().toISOString() }).eq('id', id)
    router.refresh()
  }

  async function moveToProject(convoId: string, projectId: string | null) {
    await supabase.from('conversations').update({ project_id: projectId }).eq('id', convoId)
    router.refresh()
  }

  // Filter conversations by search
  const filtered = searchQuery
    ? conversations.filter(c => c.title?.toLowerCase().includes(searchQuery.toLowerCase()))
    : conversations

  // Group by project
  const projectConvos = new Map<string, Conversation[]>()
  projectConvos.set('unassigned', [])
  projects.forEach(p => projectConvos.set(p.id, []))

  filtered.forEach(c => {
    const key = c.project_id || 'unassigned'
    const list = projectConvos.get(key)
    if (list) list.push(c)
    else projectConvos.get('unassigned')!.push(c)
  })

  if (collapsed) {
    return (
      <div className="w-14 border-r bg-card flex flex-col items-center py-3 gap-2">
        <Button variant="ghost" size="icon" onClick={() => setCollapsed(false)} className="h-8 w-8">
          <PanelLeft className="h-4 w-4" />
        </Button>
        <Link href="/dashboard">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Home className="h-4 w-4" />
          </Button>
        </Link>
        <Link href="/chat">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MessageSquarePlus className="h-4 w-4" />
          </Button>
        </Link>
      </div>
    )
  }

  function renderConversation(convo: Conversation) {
    const isActive = pathname === `/chat/${convo.id}`
    return (
      <div
        key={convo.id}
        className={`group flex items-center gap-1 rounded-md transition-colors ${
          isActive ? 'bg-muted' : 'hover:bg-muted/50'
        }`}
      >
        <Link
          href={`/chat/${convo.id}`}
          onClick={closeMobile}
          className="flex-1 flex items-center gap-2 px-2 py-1.5 min-w-0"
        >
          {convo.mode && (
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${MODE_COLORS[convo.mode] || 'bg-muted-foreground'}`} />
          )}
          <span className={`text-sm truncate ${isActive ? 'font-medium' : 'text-muted-foreground'}`}>
            {convo.title || 'Untitled'}
          </span>
        </Link>
        <DropdownMenu>
          <DropdownMenuTrigger className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-muted transition-opacity outline-none">
            <MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="right" className="w-48">
            {projects.map(p => (
              <DropdownMenuItem key={p.id} onClick={() => moveToProject(convo.id, p.id)}>
                <FolderInput className="h-3.5 w-3.5 mr-2" />
                Move to {p.name}
              </DropdownMenuItem>
            ))}
            {convo.project_id && (
              <DropdownMenuItem onClick={() => moveToProject(convo.id, null)}>
                <FolderInput className="h-3.5 w-3.5 mr-2" />
                Remove from project
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={(e) => deleteConversation(convo.id, e as unknown as React.MouseEvent)} className="text-destructive">
              <Trash2 className="h-3.5 w-3.5 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    )
  }

  return (
    <>
      {/* Mobile backdrop */}
      {isMobile && !collapsed && (
        <div
          className="fixed inset-0 bg-black/50 z-40"
          onClick={() => setCollapsed(true)}
        />
      )}
      <div className={`${isMobile ? 'fixed inset-y-0 left-0 z-50' : ''} w-72 border-r bg-card flex flex-col`}>
      {/* Header */}
      <div className="p-3 flex items-center justify-between">
        <Link href="/dashboard" onClick={closeMobile} className="font-semibold text-sm tracking-wide">
          ORACLE
        </Link>
        <div className="flex gap-1">
          <Link href="/chat" onClick={closeMobile}>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MessageSquarePlus className="h-4 w-4" />
            </Button>
          </Link>
          <Button variant="ghost" size="icon" onClick={() => setCollapsed(true)} className="h-8 w-8">
            <PanelLeftClose className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="px-3 pb-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search chats..."
            className="h-8 pl-8 text-xs"
          />
        </div>
      </div>

      <Separator />

      {/* Conversations grouped by project */}
      <ScrollArea className="flex-1 px-2 py-2">
        {/* Projects */}
        {projects.map(project => {
          const convos = projectConvos.get(project.id) || []
          const isExpanded = expandedProjects.has(project.id)

          return (
            <div key={project.id} className="mb-2">
              <button
                onClick={() => toggleProject(project.id)}
                className="flex items-center gap-1.5 w-full px-2 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-muted/50"
              >
                {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                <Folder className="h-3.5 w-3.5" style={{ color: project.color }} />
                <span className="truncate">{project.name}</span>
                <span className="ml-auto text-[10px] text-muted-foreground/60">{convos.length}</span>
              </button>
              {isExpanded && (
                <div className="ml-3 space-y-0.5">
                  {convos.map(renderConversation)}
                  {convos.length === 0 && (
                    <p className="px-2 py-1 text-[10px] text-muted-foreground/50">No chats</p>
                  )}
                </div>
              )}
            </div>
          )
        })}

        {/* Unassigned conversations */}
        {(() => {
          const unassigned = projectConvos.get('unassigned') || []
          if (unassigned.length === 0 && projects.length === 0) {
            return (
              <p className="px-3 py-6 text-xs text-muted-foreground text-center">
                No conversations yet
              </p>
            )
          }

          if (projects.length > 0 && unassigned.length > 0) {
            const isExpanded = expandedProjects.has('unassigned')
            return (
              <div className="mb-2">
                <button
                  onClick={() => toggleProject('unassigned')}
                  className="flex items-center gap-1.5 w-full px-2 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-muted/50"
                >
                  {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                  <span className="truncate">Recent</span>
                  <span className="ml-auto text-[10px] text-muted-foreground/60">{unassigned.length}</span>
                </button>
                {isExpanded && (
                  <div className="ml-3 space-y-0.5">
                    {unassigned.map(renderConversation)}
                  </div>
                )}
              </div>
            )
          }

          // No projects — just show flat list
          return (
            <div className="space-y-0.5">
              {unassigned.map(renderConversation)}
            </div>
          )
        })()}

        {/* Create project */}
        <Separator className="my-2" />
        {creatingProject ? (
          <div className="px-2 space-y-1.5">
            <Input
              value={newProjectName}
              onChange={e => setNewProjectName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') createProject()
                if (e.key === 'Escape') { setCreatingProject(false); setNewProjectName('') }
              }}
              placeholder="Project name..."
              className="h-7 text-xs"
              autoFocus
            />
            <div className="flex gap-1">
              <Button size="sm" className="h-6 text-[10px] flex-1" onClick={createProject}>Create</Button>
              <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => { setCreatingProject(false); setNewProjectName('') }}>Cancel</Button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setCreatingProject(true)}
            className="flex items-center gap-1.5 w-full px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-muted/50"
          >
            <FolderPlus className="h-3.5 w-3.5" />
            New Project
          </button>
        )}
      </ScrollArea>

      <Separator />

      {/* User */}
      <div className="p-2">
        <DropdownMenu>
          <DropdownMenuTrigger className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-muted transition-colors outline-none">
            <User className="h-4 w-4 shrink-0" />
            <span className="truncate text-xs">{userEmail}</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuItem onClick={handleSignOut}>
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
    </>
  )
}
