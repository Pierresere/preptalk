import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nProvider } from '../src/i18n'
import { PlanEditor } from '../src/components/PlanEditor'
import type { Plan } from '../src/types'

const plan: Plan = {
  persona: { name: 'Alex', role: 'Hiring manager', concerns: 'Time to ramp up', tone: 'Direct' },
  phases: [
    {
      id: 'phase-1',
      title: 'Warm-up',
      questions: 2,
      objective: 'Break the ice',
      targeting: ['communication'],
      examples: ['Tell me about yourself'],
    },
    {
      id: 'phase-2',
      title: 'Deep dive',
      questions: 2,
      objective: 'Assess skills',
      targeting: ['technical'],
      examples: ['Describe a challenge'],
    },
  ],
}

it('edits a phase question count, updates the total, and saves the draft', async () => {
  const user = userEvent.setup()
  const onSave = vi.fn()

  render(
    <I18nProvider>
      <PlanEditor plan={plan} busy={null} onGenerate={() => {}} onSave={onSave} />
    </I18nProvider>
  )

  expect(screen.getByText('Nombre de questions 4')).toBeInTheDocument()

  const questionInputs = screen.getAllByLabelText('Questions') as HTMLInputElement[]
  const firstQuestionInput = questionInputs[0]
  if (!firstQuestionInput) throw new Error('missing questions input')
  fireEvent.change(firstQuestionInput, { target: { value: '3' } })

  expect(screen.getByText('Nombre de questions 5')).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Enregistrer le plan' }))

  expect(onSave).toHaveBeenCalledTimes(1)
  const saved = onSave.mock.calls[0]?.[0] as Plan
  expect(saved.phases[0]?.questions).toBe(3)
})
