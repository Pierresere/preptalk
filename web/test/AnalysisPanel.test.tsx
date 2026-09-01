import { render, screen } from '@testing-library/react'
import { I18nProvider } from '../src/i18n'
import { AnalysisPanel } from '../src/components/AnalysisPanel'
import type { Analysis } from '../src/types'

const analysis: Analysis = {
  summary: 'Overall summary',
  requirements: [
    { index: 1, text: 'Requirement A', keywords: [], status: 'covered', evidence: 'Evidence A' },
    { index: 2, text: 'Requirement B', keywords: [], status: 'partial', evidence: 'Evidence B' },
    { index: 3, text: 'Requirement C', keywords: [], status: 'missing', evidence: 'Evidence C' },
  ],
}

it('renders one chip per requirement with the matching status class', () => {
  render(
    <I18nProvider>
      <AnalysisPanel analysis={analysis} busy={null} onRun={() => {}} />
    </I18nProvider>
  )

  const chips = document.querySelectorAll('.chip')
  expect(chips).toHaveLength(3)
  expect(document.querySelector('.chip-covered')).not.toBeNull()
  expect(document.querySelector('.chip-partial')).not.toBeNull()
  expect(document.querySelector('.chip-missing')).not.toBeNull()
  expect(screen.getByText('Requirement A')).toBeInTheDocument()
})
