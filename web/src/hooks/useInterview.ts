import { useCallback, useRef, useState } from 'react'
import { ApiError, createSession, sendTurn } from '../services/api.js'
import { readSse } from '../services/sse.js'
import type { Session } from '../types.js'

export type InterviewStatus = 'idle' | 'streaming' | 'error'

interface UseInterviewResult {
  session: Session | null
  draft: string
  status: InterviewStatus
  stage: string
  sources: string[]
  error: string | null
  start(openerText: string): Promise<void>
  send(text: string): Promise<void>
  stop(): void
  newSession(): void
}

export function useInterview(dossierId: string, _plan: unknown): UseInterviewResult {
  const [session, setSession] = useState<Session | null>(null)
  const [draft, setDraft] = useState('')
  const [status, setStatus] = useState<InterviewStatus>('idle')
  const [stage, setStage] = useState('')
  const [sources, setSources] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const controllerRef = useRef<AbortController | null>(null)

  const send = useCallback(
    async (text: string, sid?: string) => {
      const activeId = sid ?? session?.id
      if (activeId === undefined) return

      const controller = new AbortController()
      controllerRef.current = controller
      setStatus('streaming')
      setStage('')
      setSources([])
      setDraft('')
      setError(null)

      try {
        const response = await sendTurn(dossierId, activeId, text, controller.signal)
        let accumulated = ''
        await readSse(response, {
          stage: (s) => setStage(s),
          sources: (ids) => setSources(ids),
          chunk: (delta) => {
            accumulated += delta
            setDraft(accumulated)
          },
          done: (finished) => {
            setSession(finished)
            setDraft('')
            setStatus('idle')
          },
          error: (message) => {
            setError(message)
            setStatus('error')
          },
        })
      } catch (e) {
        if (controller.signal.aborted) {
          setStatus('idle')
          return
        }
        setError(e instanceof ApiError ? e.message : 'error.generic')
        setStatus('error')
      } finally {
        controllerRef.current = null
      }
    },
    [dossierId, session]
  )

  const start = useCallback(
    async (openerText: string) => {
      setError(null)
      try {
        const created = await createSession(dossierId)
        setSession(created)
        await send(openerText, created.id)
      } catch (e) {
        setError(e instanceof ApiError ? e.message : 'error.generic')
        setStatus('error')
      }
    },
    [dossierId, send]
  )

  const stop = useCallback(() => {
    controllerRef.current?.abort()
    controllerRef.current = null
    setStatus('idle')
  }, [])

  const newSession = useCallback(() => {
    controllerRef.current?.abort()
    controllerRef.current = null
    setSession(null)
    setDraft('')
    setError(null)
    setStage('')
    setSources([])
    setStatus('idle')
  }, [])

  return { session, draft, status, stage, sources, error, start, send, stop, newSession }
}
