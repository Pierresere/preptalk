import { act, renderHook, waitFor } from '@testing-library/react'
import * as api from '../src/services/api.js'
import { useInterview } from '../src/hooks/useInterview.js'
import type { Session } from '../src/types'

it('creates a session, sends the opener, and streams a reply', async () => {
  const created: Session = {
    id: 's1',
    dossierId: 'd1',
    provider: 'openai',
    model: 'gpt',
    startedAt: '2026-01-01T00:00:00.000Z',
    messages: [],
    debrief: null,
  }
  const afterTurn: Session = {
    ...created,
    messages: [
      { role: 'user', text: 'Bonjour, je suis prêt.' },
      { role: 'assistant', text: 'Bonjour ! Parlez-moi de vous.' },
    ],
  }

  vi.spyOn(api, 'createSession').mockResolvedValue(created)
  const sseBody =
    'event: stage\ndata: {"stage":"thinking"}\n\n' +
    'event: chunk\ndata: {"delta":"Bonjour"}\n\n' +
    'event: chunk\ndata: {"delta":" !"}\n\n' +
    `event: done\ndata: {"session":${JSON.stringify(afterTurn)}}\n\n`
  vi.spyOn(api, 'sendTurn').mockResolvedValue(new Response(sseBody))

  const { result } = renderHook(() => useInterview('d1', null))

  await act(async () => {
    await result.current.start('Bonjour, je suis prêt.')
  })

  await waitFor(() => expect(result.current.status).toBe('idle'))

  expect(result.current.session?.messages.length).toBe(2)
  expect(result.current.status).toBe('idle')
  expect(result.current.draft).toBe('')
})
