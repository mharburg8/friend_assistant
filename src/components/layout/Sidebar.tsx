'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
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
} from 'lucide-react'

interface SidebarProps {
  conversations: Array<{
    id: string
    title: string | null
    mode: string | null
    updated_at: string
  }>
  userEmail: string
}

export function Sidebar({ conversations, userEmail }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false)
  const pathname = usePathname()
  const supabase = createClient()

  async function handleSignOut() {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  if (collapsed) {
    return (
      <div className="w-14 border-r bg-card flex flex-col items-center py-3 gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCollapsed(false)}
          className="h-8 w-8"
        >
          <PanelLeft className="h-4 w-4" />
        </Button>
        <Link href="/">
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

  return (
    <div className="w-64 border-r bg-card flex flex-col">
      {/* Header */}
      <div className="p-3 flex items-center justify-between">
        <Link href="/" className="font-semibold text-sm tracking-wide">
          ORACLE
        </Link>
        <div className="flex gap-1">
          <Link href="/chat">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MessageSquarePlus className="h-4 w-4" />
            </Button>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCollapsed(true)}
            className="h-8 w-8"
          >
            <PanelLeftClose className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Separator />

      {/* Conversations */}
      <ScrollArea className="flex-1 px-2 py-2">
        <div className="space-y-0.5">
          {conversations.map(convo => {
            const isActive = pathname === `/chat/${convo.id}`
            return (
              <Link
                key={convo.id}
                href={`/chat/${convo.id}`}
                className={`block px-3 py-2 rounded-md text-sm truncate transition-colors ${
                  isActive
                    ? 'bg-muted font-medium'
                    : 'hover:bg-muted/50 text-muted-foreground'
                }`}
              >
                {convo.title || 'Untitled'}
              </Link>
            )
          })}
          {conversations.length === 0 && (
            <p className="px-3 py-6 text-xs text-muted-foreground text-center">
              No conversations yet
            </p>
          )}
        </div>
      </ScrollArea>

      <Separator />

      {/* User */}
      <div className="p-2">
        <DropdownMenu>
          <DropdownMenuTrigger className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-muted transition-colors outline-none">
            <User className="h-4 w-4 shrink-0" />
            <span className="truncate">{userEmail}</span>
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
  )
}
