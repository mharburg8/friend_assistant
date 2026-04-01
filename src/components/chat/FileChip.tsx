'use client'

import { X, FileText, Image, FileSpreadsheet, Presentation, File } from 'lucide-react'
import { getFileCategory } from '@/lib/s3/file-types'

export interface StagedFile {
  id: string
  file: File
  previewUrl?: string
  attachmentId?: string
  isUploading: boolean
  error?: string
}

interface FileChipProps {
  fileName: string
  fileType: string
  fileSize: number
  previewUrl?: string
  isUploading?: boolean
  onRemove: () => void
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function FileIcon({ mimeType }: { mimeType: string }) {
  const category = getFileCategory(mimeType)
  switch (category) {
    case 'image': return <Image className="h-4 w-4 text-blue-500" />
    case 'pdf': return <FileText className="h-4 w-4 text-red-500" />
    case 'office':
      if (mimeType.includes('spreadsheet') || mimeType.includes('excel'))
        return <FileSpreadsheet className="h-4 w-4 text-green-500" />
      if (mimeType.includes('presentation') || mimeType.includes('powerpoint'))
        return <Presentation className="h-4 w-4 text-orange-500" />
      return <FileText className="h-4 w-4 text-blue-600" />
    default: return <File className="h-4 w-4 text-muted-foreground" />
  }
}

export function FileChip({ fileName, fileType, fileSize, previewUrl, isUploading, onRemove }: FileChipProps) {
  const isImage = fileType.startsWith('image/')

  return (
    <div className="relative group flex items-center gap-2 bg-muted rounded-lg px-3 py-2 max-w-[200px]">
      {isImage && previewUrl ? (
        <img src={previewUrl} alt={fileName} className="h-8 w-8 rounded object-cover" />
      ) : (
        <FileIcon mimeType={fileType} />
      )}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium truncate">{fileName}</p>
        <p className="text-xs text-muted-foreground">
          {isUploading ? 'Uploading...' : formatSize(fileSize)}
        </p>
      </div>
      {isUploading && (
        <div className="absolute inset-0 bg-background/50 rounded-lg flex items-center justify-center">
          <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      <button
        onClick={onRemove}
        className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-foreground/80 text-background flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  )
}
