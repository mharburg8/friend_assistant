'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { ArrowUp, Square, Mic, MicOff, Paperclip } from 'lucide-react'
import { FileChip } from './FileChip'
import type { StagedFile } from './FileChip'
import { ALLOWED_TYPES, MAX_FILE_SIZE, validateFile } from '@/lib/s3/file-types'

export type { StagedFile } from './FileChip'

interface ChatInputProps {
  onSend: (message: string, attachmentIds: string[]) => void
  onStop: () => void
  isStreaming: boolean
  disabled: boolean
  conversationId?: string
}

let nextFileId = 0

export function ChatInput({ onSend, onStop, isStreaming, disabled, conversationId }: ChatInputProps) {
  const [input, setInput] = useState('')
  const [isListening, setIsListening] = useState(false)
  const [stagedFiles, setStagedFiles] = useState<StagedFile[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!isStreaming && !isListening) {
      textareaRef.current?.focus()
    }
  }, [isStreaming, isListening])

  useEffect(() => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px'
    }
  }, [input])

  const uploadFile = useCallback(async (file: File, clientId: string) => {
    try {
      const res = await fetch('/api/files/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
          conversationId: conversationId || undefined,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Upload failed' }))
        throw new Error(err.error || 'Upload failed')
      }

      const { attachmentId, uploadUrl } = await res.json()

      await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      })

      setStagedFiles(prev =>
        prev.map(f =>
          f.id === clientId ? { ...f, attachmentId, isUploading: false } : f
        )
      )
    } catch (err) {
      setStagedFiles(prev =>
        prev.map(f =>
          f.id === clientId
            ? { ...f, isUploading: false, error: (err as Error).message }
            : f
        )
      )
    }
  }, [conversationId])

  const handleFilesAdded = useCallback((files: File[]) => {
    const newStagedFiles: StagedFile[] = files.map(file => {
      const id = `file-${nextFileId++}`
      const previewUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined
      return { id, file, previewUrl, isUploading: true }
    })

    setStagedFiles(prev => [...prev, ...newStagedFiles])

    for (const staged of newStagedFiles) {
      uploadFile(staged.file, staged.id)
    }
  }, [uploadFile])

  const handleFileRemoved = useCallback((id: string) => {
    setStagedFiles(prev => {
      const file = prev.find(f => f.id === id)
      if (file?.previewUrl) URL.revokeObjectURL(file.previewUrl)
      return prev.filter(f => f.id !== id)
    })
  }, [])

  const addFilesFromInput = useCallback((fileList: FileList | null) => {
    if (!fileList) return
    const valid: File[] = []
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i]
      const error = validateFile(file.name, file.type, file.size)
      if (!error) valid.push(file)
    }
    if (valid.length > 0) handleFilesAdded(valid)
  }, [handleFilesAdded])

  function handleSubmit() {
    const trimmed = input.trim()
    const hasFiles = stagedFiles.some(f => f.attachmentId && !f.error)
    if ((!trimmed && !hasFiles) || disabled) return

    const attachmentIds = stagedFiles
      .filter(f => f.attachmentId && !f.error)
      .map(f => f.attachmentId!)

    onSend(trimmed || '(attached files)', attachmentIds)
    setInput('')
    setStagedFiles([])
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(true)
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
    addFilesFromInput(e.dataTransfer.files)
  }

  function toggleVoice() {
    if (isListening) {
      recognitionRef.current?.stop()
      setIsListening(false)
      return
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) return

    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'

    let finalTranscript = input

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript
        if (event.results[i].isFinal) {
          finalTranscript += (finalTranscript ? ' ' : '') + transcript
        } else {
          interim = transcript
        }
      }
      setInput(finalTranscript + (interim ? ' ' + interim : ''))
    }

    recognition.onerror = () => setIsListening(false)
    recognition.onend = () => setIsListening(false)

    recognitionRef.current = recognition
    recognition.start()
    setIsListening(true)
  }

  const hasSpeechRecognition = typeof window !== 'undefined' &&
    (window.SpeechRecognition || window.webkitSpeechRecognition)

  const hasUploadingFiles = stagedFiles.some(f => f.isUploading)
  const acceptTypes = Object.keys(ALLOWED_TYPES).join(',')

  return (
    <div
      className="border-t bg-background p-4 relative"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isDragging && (
        <div className="absolute inset-0 bg-primary/10 border-2 border-dashed border-primary rounded-lg flex items-center justify-center z-10 pointer-events-none">
          <p className="text-sm font-medium text-primary">Drop files here</p>
        </div>
      )}

      <div className="max-w-3xl mx-auto">
        {stagedFiles.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {stagedFiles.map(file => (
              <FileChip
                key={file.id}
                fileName={file.file.name}
                fileType={file.file.type}
                fileSize={file.file.size}
                previewUrl={file.previewUrl}
                isUploading={file.isUploading}
                onRemove={() => handleFileRemoved(file.id)}
              />
            ))}
          </div>
        )}

        <div className="flex gap-2 items-end">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={acceptTypes}
            className="hidden"
            onChange={e => {
              addFilesFromInput(e.target.files)
              e.target.value = ''
            }}
          />
          <Button
            onClick={() => fileInputRef.current?.click()}
            size="icon"
            variant="ghost"
            className="h-[44px] w-[44px] shrink-0"
            disabled={isStreaming}
          >
            <Paperclip className="h-4 w-4" />
          </Button>

          {hasSpeechRecognition && (
            <Button
              onClick={toggleVoice}
              size="icon"
              variant={isListening ? 'default' : 'ghost'}
              className={`h-[44px] w-[44px] shrink-0 ${isListening ? 'bg-red-500 hover:bg-red-600 animate-pulse' : ''}`}
              disabled={isStreaming}
            >
              {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </Button>
          )}

          <Textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isListening ? 'Listening...' : 'Message ORACLE...'}
            className="min-h-[44px] max-h-[200px] resize-none"
            rows={1}
            disabled={isStreaming}
          />

          {isStreaming ? (
            <Button
              onClick={onStop}
              size="icon"
              variant="outline"
              className="h-[44px] w-[44px] shrink-0"
            >
              <Square className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              size="icon"
              disabled={(!input.trim() && stagedFiles.length === 0) || hasUploadingFiles}
              className="h-[44px] w-[44px] shrink-0"
            >
              <ArrowUp className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
