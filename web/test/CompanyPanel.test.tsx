import { render, screen } from '@testing-library/react'
import { I18nProvider } from '../src/i18n'
import { CompanyPanel } from '../src/components/CompanyPanel'

it('keeps text before the first heading as a headingless preamble card', () => {
  const company = 'Some intro text.\n\n## Secteur\nIndustrial goods.'

  render(
    <I18nProvider>
      <CompanyPanel company={company} busy={null} onResearchAll={() => {}} onResearchSection={() => {}} />
    </I18nProvider>
  )

  expect(screen.getByText('Some intro text.')).toBeInTheDocument()
  expect(screen.getByText('Secteur')).toBeInTheDocument()
})
