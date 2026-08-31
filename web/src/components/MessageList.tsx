import { useEffect, useRef } from 'react'
import { useT } from '../i18n'
import { toHtml } from '../services/markdown.js'
import type { Message } from '../types.js'

interface MessageListProps {
  messages: readonly Message[]
  draft: string
  streaming: boolean
  recruiter: string
}

function renderHtml(text: string): string {
  return toHtml(text).replace(/<blockquote>/g, '<blockquote class="coaching">')
}

function Bubble({ role, text, label }: { role: 'user' | 'assistant'; text: string; label: string }) {
  return (
    <div className={role === 'user' ? 'message-user' : 'message-assistant'}>
      <div className="bubble">
        <strong>{label}</strong>
        <div dangerouslySetInnerHTML={{ __html: renderHtml(text) }} />
      </div>
    </div>
  )
}

export function MessageList({ messages, draft, streaming, recruiter }: MessageListProps) {
  const t = useT()
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: 'end' })
  }, [messages, draft])

  return (
    <div className="messages">
      {messages.map((m, i) => (
        <Bubble key={i} role={m.role} text={m.text} label={m.role === 'user' ? t('interview.you') : recruiter} />
      ))}
      {streaming && draft.length > 0 && <Bubble role="assistant" text={draft} label={recruiter} />}
      <div ref={endRef} />
    </div>
  )
}
