import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nProvider } from '../src/i18n'
import { DossierForm } from '../src/components/DossierForm'
import type { ProviderInfo } from '../src/types'

const providers: ProviderInfo[] = [
  { id: 'gemini', models: ['gemini-3.7-pro', 'gemini-3.7-flash'] },
]

it('disables submit until company and position are filled, then submits with expected payload', async () => {
  const user = userEvent.setup()
  const onSubmit = vi.fn()

  render(
    <I18nProvider>
      <DossierForm providers={providers} onSubmit={onSubmit} onCancel={() => {}} />
    </I18nProvider>
  )

  const submit = screen.getByRole('button', { name: /créer|create/i })
  expect(submit).toBeDisabled()

  await user.type(screen.getByLabelText(/entreprise|company/i), 'Acme')
  await user.type(screen.getByLabelText(/poste|position/i), 'Engineer')
  await user.type(screen.getByLabelText(/sites/i), 'A{enter}B')
  await user.selectOptions(screen.getByLabelText(/modèle|model/i), 'gemini-3.7-flash')

  expect(submit).not.toBeDisabled()
  await user.click(submit)

  expect(onSubmit).toHaveBeenCalledWith({
    company: 'Acme',
    position: 'Engineer',
    sites: ['A', 'B'],
    language: 'fr',
    provider: 'gemini',
    model: 'gemini-3.7-flash',
  })
})
