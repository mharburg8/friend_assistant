'use client'

import { useState } from 'react'
import type { Mode } from '@/types/database'
import {
  Briefcase,
  GraduationCap,
  Heart,
  Code,
  Search,
  Users,
} from 'lucide-react'

const MODES: { value: Mode; label: string; icon: React.ReactNode }[] = [
  { value: 'dev', label: 'Dev', icon: <Code className="h-3.5 w-3.5" /> },
  { value: 'work', label: 'Work', icon: <Briefcase className="h-3.5 w-3.5" /> },
  { value: 'jobsearch', label: 'Job Search', icon: <Search className="h-3.5 w-3.5" /> },
  { value: 'school', label: 'School', icon: <GraduationCap className="h-3.5 w-3.5" /> },
  { value: 'personal', label: 'Personal', icon: <Heart className="h-3.5 w-3.5" /> },
  { value: 'alab', label: 'A:LAB', icon: <Users className="h-3.5 w-3.5" /> },
]

interface ModeSelectorProps {
  currentMode: Mode | null
  onModeChange: (mode: Mode | null) => void
}

export function ModeSelector({ currentMode, onModeChange }: ModeSelectorProps) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {expanded ? (
        <>
          {MODES.map(mode => (
            <button
              key={mode.value}
              onClick={() => {
                onModeChange(currentMode === mode.value ? null : mode.value)
                setExpanded(false)
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs transition-colors ${
                currentMode === mode.value
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              {mode.icon}
              {mode.label}
            </button>
          ))}
          <button
            onClick={() => setExpanded(false)}
            className="px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
          >
            collapse
          </button>
        </>
      ) : (
        <button
          onClick={() => setExpanded(true)}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs transition-colors ${
            currentMode
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground hover:text-foreground'
          }`}
        >
          {currentMode
            ? MODES.find(m => m.value === currentMode)?.icon
            : null}
          {currentMode
            ? MODES.find(m => m.value === currentMode)?.label
            : 'Set mode'}
        </button>
      )}
    </div>
  )
}
