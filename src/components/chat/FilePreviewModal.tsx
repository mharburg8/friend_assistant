'use client'

import { useEffect, useState } from 'react'
import { X, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getFileCategory } from '@/lib/s3/file-types'
import type { Attachment } from '@/types/database'

interface FilePreviewModalProps {
  attachment: Attachment
  imageUrl?: string
  onClose: () => void
  onDownload: () => void
}

export function FilePreviewModal({ attachment, imageUrl, onClose, onDownload }: FilePreviewModalProps) {
  const [url, setUrl] = useState(imageUrl || '')
  const [textContent, setTextContent] = useState<string | null>(null)
  const category = getFileCategory(attachment.file_type)

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  useEffect(() => {
    if (!url) {
      fetch(`/api/files/${attachment.id}`)
        .then(r => r.json())
        .then(data => setUrl(data.url))
        .catch(() => {})
    }
  }, [attachment.id, url])

  useEffect(() => {
    if (category === 'text' && url) {
      fetch(url)
        .then(r => r.text())
        .then(setTextContent)
        .catch(() => setTextContent('(Could not load file content)'))
    }
  }, [category, url])

  return (
    <div
      className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="relative max-w-4xl max-h-[90vh] w-full"
        onClick={e => e.stopPropagation()}
      >
        <div className="absolute -top-10 left-0 right-0 flex items-center justify-between text-white">
          <span className="text-sm truncate">{attachment.file_name}</span>
          <div className="flex gap-2">
            <Button size="icon" variant="ghost" className="text-white hover:bg-white/20" onClick={onDownload}>
              <Download className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" className="text-white hover:bg-white/20" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {category === 'image' && url && (
          <img
            src={url}
            alt={attachment.file_name}
            className="max-w-full max-h-[85vh] object-contain mx-auto rounded-lg"
          />
        )}

        {category === 'pdf' && url && (
          <iframe
            src={url}
            className="w-full h-[85vh] rounded-lg bg-white"
            title={attachment.file_name}
          />
        )}

        {category === 'text' && (
          <div className="bg-background rounded-lg p-6 max-h-[85vh] overflow-auto">
            <pre className="text-sm whitespace-pre-wrap font-mono">
              {textContent ?? 'Loading...'}
            </pre>
          </div>
        )}

        {category === 'office' && (
          <div className="bg-background rounded-lg p-8 text-center">
            <p className="text-lg mb-4">{attachment.file_name}</p>
            <p className="text-muted-foreground mb-4">
              Office files can be downloaded and opened in Microsoft Office or Google Docs.
            </p>
            <Button onClick={onDownload}>
              <Download className="h-4 w-4 mr-2" /> Download
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
