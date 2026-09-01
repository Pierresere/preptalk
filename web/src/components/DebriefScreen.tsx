import { useEffect, useState } from 'react'
import { useT } from '../i18n'
import { ApiError, listSessions } from '../services/api.js'
import { toChatHtml } from '../services/markdown.js'
import { MessageList } from './MessageList.js'
import type { Session } from '../types.js'

interface DebriefScreenProps {
  id: string
}

function pickDefault(sessions: Session[]): Session | null {
  return sessions.find((s) => s.debrief !== null) ?? sessions[0] ?? null
}

export function DebriefScreen({ id }: DebriefScreenProps) {
  const t = useT()
  const [sessions, setSessions] = useState<Session[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showTranscript, setShowTranscript] = useState(false)

  useEffect(() => {
    let cancelled = false
    setSessions(null)
    setError(null)
    setSelectedId(null)
    listSessions(id)
      .then((list) => {
        if (cancelled) return
        setSessions(list)
        setSelectedId(pickDefault(list)?.id ?? null)
      })
      .catch((e: unknown) => {
        if (cancelled) return
        setError(e instanceof ApiError ? e.message : t('error.generic'))
      })
    return () => {
      cancelled = true
    }
  }, [id, t])

  if (error !== null) {
    return <p>{error}</p>
  }
  if (sessions === null) {
    return null
  }

  const selected = sessions.find((s) => s.id === selectedId) ?? null

  return (
    <div className="split-grid split-grid--side-first">
      <div className="session-list">
        {sessions.map((session) => (
          <button
            key={session.id}
            type="button"
            className={session.id === selectedId ? 'btn btn-primary' : 'btn'}
            onClick={() => {
              setSelectedId(session.id)
              setShowTranscript(false)
            }}
          >
            {new Date(session.startedAt).toLocaleString()}
            {' — '}
            {t('debrief.messages', { n: session.messages.length })}
            {session.debrief !== null && ' ✓'}
          </button>
        ))}
      </div>
      <div>
        {selected === null ? (
          <p>{t('debrief.empty')}</p>
        ) : (
          <>
            {selected.debrief === null ? (
              <p>{t('debrief.empty')}</p>
            ) : (
              <div dangerouslySetInnerHTML={{ __html: toChatHtml(selected.debrief) }} />
            )}
            <button type="button" className="btn" onClick={() => setShowTranscript((v) => !v)}>
              {showTranscript ? t('debrief.hideTranscript') : t('debrief.showTranscript')}
            </button>
            {showTranscript && (
              <MessageList
                messages={selected.messages}
                draft=""
                streaming={false}
                recruiter={t('interview.recruiter')}
              />
            )}
          </>
        )}
      </div>
    </div>
  )
}
