'use client'

import { X, Monitor } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ComputerUsePreviewProps {
  screenshot: string
  onClose: () => void
}

export function ComputerUsePreview({ screenshot, onClose }: ComputerUsePreviewProps) {
  return (
    <div className="w-[480px] border-l bg-card flex flex-col shrink-0">
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Monitor className="h-4 w-4 text-emerald-500" />
          <span>Computer Use</span>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex-1 p-3 overflow-auto">
        <div className="rounded-lg overflow-hidden border bg-black">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={screenshot}
            alt="Computer use screenshot"
            className="w-full h-auto"
          />
        </div>
        <p className="text-xs text-muted-foreground mt-2 text-center">
          Live screenshot from remote desktop
        </p>
      </div>
    </div>
  )
}
