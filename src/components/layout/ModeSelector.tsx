'use client'

import type { Mode } from '@/types/database'
import {
  Briefcase,
  GraduationCap,
  Heart,
  Code,
  Search,
  Users,
} from 'lucide-react'

const MODES: { value: Mode; label: string; icon: React.ReactNode; color: string }[] = [
  { value: 'dev', label: 'Dev', icon: <Code className="h-3.5 w-3.5" />, color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' },
  { value: 'work', label: 'Work', icon: <Briefcase className="h-3.5 w-3.5" />, color: 'bg-blue-500/10 text-blue-400 border-blue-500/30' },
  { value: 'jobsearch', label: 'Jobs', icon: <Search className="h-3.5 w-3.5" />, color: 'bg-amber-500/10 text-amber-400 border-amber-500/30' },
  { value: 'school', label: 'School', icon: <GraduationCap className="h-3.5 w-3.5" />, color: 'bg-purple-500/10 text-purple-400 border-purple-500/30' },
  { value: 'personal', label: 'Personal', icon: <Heart className="h-3.5 w-3.5" />, color: 'bg-pink-500/10 text-pink-400 border-pink-500/30' },
  { value: 'alab', label: 'A:LAB', icon: <Users className="h-3.5 w-3.5" />, color: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30' },
]

interface ModeSelectorProps {
  currentMode: Mode | null
  onModeChange: (mode: Mode | null) => void
}

export function ModeSelector({ currentMode, onModeChange }: ModeSelectorProps) {
  return (
    <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
      {MODES.map(mode => {
        const isActive = currentMode === mode.value
        return (
          <button
            key={mode.value}
            onClick={() => onModeChange(isActive ? null : mode.value)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all whitespace-nowrap ${
              isActive
                ? mode.color
                : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            {mode.icon}
            {mode.label}
          </button>
        )
      })}
    </div>
  )
}
