'use client'

import { useState, useEffect } from 'react'
import { Download, FileText, Image, FileSpreadsheet, Presentation, File, Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getFileCategory } from '@/lib/s3/file-types'
import { FilePreviewModal } from './FilePreviewModal'
import type { Attachment } from '@/types/database'

interface AttachmentDisplayProps {
  attachments: Attachment[]
}

function FileIcon({ mimeType }: { mimeType: string }) {
  const category = getFileCategory(mimeType)
  switch (category) {
    case 'image': return <Image className="h-5 w-5 text-blue-500" />
    case 'pdf': return <FileText className="h-5 w-5 text-red-500" />
    case 'office':
      if (mimeType.includes('spreadsheet') || mimeType.includes('excel'))
        return <FileSpreadsheet className="h-5 w-5 text-green-500" />
      if (mimeType.includes('presentation') || mimeType.includes('powerpoint'))
        return <Presentation className="h-5 w-5 text-orange-500" />
      return <FileText className="h-5 w-5 text-blue-600" />
    default: return <File className="h-5 w-5 text-muted-foreground" />
  }
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function AttachmentDisplay({ attachments }: AttachmentDisplayProps) {
  const [previewAttachment, setPreviewAttachment] = useState<Attachment | null>(null)
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({})

  async function getDownloadUrl(attachment: Attachment): Promise<string> {
    const res = await fetch(`/api/files/${attachment.id}`)
    const data = await res.json()
    return data.url
  }

  async function handleDownload(attachment: Attachment) {
    const url = attachment.inline_data || await getDownloadUrl(attachment)
    const a = document.createElement('a')
    a.href = url
    a.download = attachment.file_name
    a.click()
  }

  async function handlePreview(attachment: Attachment) {
    const category = getFileCategory(attachment.file_type)

    if (category === 'image') {
      if (!imageUrls[attachment.id]) {
        const url = await getDownloadUrl(attachment)
        setImageUrls(prev => ({ ...prev, [attachment.id]: url }))
      }
    }

    setPreviewAttachment(attachment)
  }

  const images = attachments.filter(a => a.file_type.startsWith('image/'))
  const files = attachments.filter(a => !a.file_type.startsWith('image/'))

  return (
    <>
      {images.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {images.map(attachment => (
            <button
              key={attachment.id}
              onClick={() => handlePreview(attachment)}
              className="relative group rounded-lg overflow-hidden border hover:border-primary transition-colors"
            >
              <ImageThumbnail attachment={attachment} />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                <Eye className="h-5 w-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </button>
          ))}
        </div>
      )}

      {files.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {files.map(attachment => (
            <div
              key={attachment.id}
              className="flex items-center gap-2 bg-background/50 border rounded-lg px-3 py-2"
            >
              <FileIcon mimeType={attachment.file_type} />
              <div className="min-w-0">
                <p className="text-xs font-medium truncate max-w-[150px]">{attachment.file_name}</p>
                <p className="text-xs text-muted-foreground">{formatSize(attachment.file_size)}</p>
              </div>
              <div className="flex gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6"
                  onClick={() => handlePreview(attachment)}
                >
                  <Eye className="h-3 w-3" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6"
                  onClick={() => handleDownload(attachment)}
                >
                  <Download className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {previewAttachment && (
        <FilePreviewModal
          attachment={previewAttachment}
          imageUrl={imageUrls[previewAttachment.id]}
          onClose={() => setPreviewAttachment(null)}
          onDownload={() => handleDownload(previewAttachment)}
        />
      )}
    </>
  )
}

function ImageThumbnail({ attachment }: { attachment: Attachment }) {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/files/${attachment.id}`)
      .then(r => r.json())
      .then(data => setUrl(data.url))
      .catch(() => {})
  }, [attachment.id])

  if (!url) {
    return <div className="w-[200px] h-[150px] bg-muted animate-pulse" />
  }

  return (
    <img
      src={url}
      alt={attachment.file_name}
      className="max-w-[300px] max-h-[200px] object-cover"
    />
  )
}
