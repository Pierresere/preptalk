import { render, screen } from '@testing-library/react'
import { I18nProvider } from '../src/i18n'
import { PhaseBar } from '../src/components/PhaseBar'
import type { Plan, Session } from '../src/types'

const plan: Plan = {
  persona: { name: 'Alex', role: 'Hiring manager', concerns: 'Time to ramp up', tone: 'Direct' },
  phases: [
    { id: 'p1', title: 'Warm-up', questions: 3, objective: '', targeting: [], examples: [] },
    { id: 'p2', title: 'Deep dive', questions: 3, objective: '', targeting: [], examples: [] },
  ],
}

function sessionWithAssistantCount(n: number): Session {
  const messages = Array.from({ length: n }, () => ({ role: 'assistant' as const, text: 'x' }))
  return {
    id: 's1',
    dossierId: 'd1',
    provider: 'openai',
    model: 'gpt',
    startedAt: '2026-01-01T00:00:00.000Z',
    messages,
    debrief: null,
  }
}

it('shows Question 4 / 6 after 3 assistant messages', () => {
  render(
    <I18nProvider>
      <PhaseBar plan={plan} session={sessionWithAssistantCount(3)} />
    </I18nProvider>
  )
  expect(screen.getByText(/Question 4 \/ 6/)).toBeInTheDocument()
})

it('shows debrief text once past the last question', () => {
  render(
    <I18nProvider>
      <PhaseBar plan={plan} session={sessionWithAssistantCount(6)} />
    </I18nProvider>
  )
  expect(screen.getByText('Debrief')).toBeInTheDocument()
})
