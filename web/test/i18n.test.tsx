import { render, screen } from '@testing-library/react'
import { I18nProvider, useT } from '../src/i18n'
import fr from '../src/i18n/fr.json'
import en from '../src/i18n/en.json'

function Probe() {
  const t = useT()
  return (
    <p>
      {t('app.name')} {t('missing.key')} {t('phase.counter', { n: 2, total: 16 })}
    </p>
  )
}

it('translates, falls back to key, interpolates', () => {
  render(
    <I18nProvider>
      <Probe />
    </I18nProvider>
  )
  expect(screen.getByText(/PrepTalk missing.key Question 2 \/ 16/)).toBeInTheDocument()
})

it('fr and en dictionaries have identical key sets', () => {
  const frKeys = Object.keys(fr).sort()
  const enKeys = Object.keys(en).sort()
  expect(frKeys).toEqual(enKeys)
})
