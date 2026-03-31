'use client'

import { useState, useRef, useEffect } from 'react'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { ArrowUp, Square, Mic, MicOff } from 'lucide-react'

interface ChatInputProps {
  onSend: (message: string) => void
  onStop: () => void
  isStreaming: boolean
  disabled: boolean
}

export function ChatInput({ onSend, onStop, isStreaming, disabled }: ChatInputProps) {
  const [input, setInput] = useState('')
  const [isListening, setIsListening] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const recognitionRef = useRef<SpeechRecognition | null>(null)

  useEffect(() => {
    if (!isStreaming && !isListening) {
      textareaRef.current?.focus()
    }
  }, [isStreaming, isListening])

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px'
    }
  }, [input])

  function handleSubmit() {
    const trimmed = input.trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    setInput('')
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
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

    recognition.onerror = () => {
      setIsListening(false)
    }

    recognition.onend = () => {
      setIsListening(false)
    }

    recognitionRef.current = recognition
    recognition.start()
    setIsListening(true)
  }

  const hasSpeechRecognition = typeof window !== 'undefined' &&
    (window.SpeechRecognition || window.webkitSpeechRecognition)

  return (
    <div className="border-t bg-background p-4">
      <div className="max-w-3xl mx-auto flex gap-2 items-end">
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
            disabled={!input.trim()}
            className="h-[44px] w-[44px] shrink-0"
          >
            <ArrowUp className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  )
}
