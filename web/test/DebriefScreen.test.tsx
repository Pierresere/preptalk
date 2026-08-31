import { render, screen, waitFor } from '@testing-library/react'
import { I18nProvider } from '../src/i18n'
import * as api from '../src/services/api.js'
import { DebriefScreen } from '../src/components/DebriefScreen'
import type { Session } from '../src/types'

it('renders the debrief text and two session rows', async () => {
  const sessions: Session[] = [
    {
      id: 's1',
      dossierId: 'd1',
      provider: 'openai',
      model: 'gpt',
      startedAt: '2026-01-01T00:00:00.000Z',
      messages: [{ role: 'user', text: 'Bonjour' }],
      debrief: 'Great job overall.',
    },
    {
      id: 's2',
      dossierId: 'd1',
      provider: 'openai',
      model: 'gpt',
      startedAt: '2026-01-02T00:00:00.000Z',
      messages: [],
      debrief: null,
    },
  ]
  vi.spyOn(api, 'listSessions').mockResolvedValue(sessions)

  render(
    <I18nProvider>
      <DebriefScreen id="d1" />
    </I18nProvider>
  )

  await waitFor(() => expect(screen.getByText('Great job overall.')).toBeInTheDocument())

  const rows = screen.getAllByRole('button', { name: /messages/i })
  expect(rows.length).toBe(2)
})
