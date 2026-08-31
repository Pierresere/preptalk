import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nProvider } from '../src/i18n'
import { TextPanel } from '../src/components/TextPanel'

it('disables save until the text changes, then calls onSave with the new text', async () => {
  const user = userEvent.setup()
  const onSave = vi.fn()

  render(
    <I18nProvider>
      <TextPanel label="Offer" value="Initial text" onSave={onSave} busy={null} />
    </I18nProvider>
  )

  const save = screen.getByRole('button', { name: /enregistrer|save/i })
  expect(save).toBeDisabled()

  const textarea = screen.getByRole('textbox')
  await user.type(textarea, ' more')

  expect(save).not.toBeDisabled()
  await user.click(save)

  expect(onSave).toHaveBeenCalledWith('Initial text more')
})
