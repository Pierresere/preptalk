import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { I18nProvider } from '../src/i18n'
import { PrepareScreen } from '../src/components/PrepareScreen'
import * as api from '../src/services/api'

vi.mock('../src/services/api')

const BUNDLE = {
  dossier: {
    id: 'ben-mor', company: 'Câbles Ben-Mor', position: 'Coordonnateur qualité', sites: [],
    language: 'fr' as const, provider: 'gemini' as const, model: 'm', createdAt: '', updatedAt: '',
  },
  offer: 'offre', resume: 'CV', company: '', documents: [], analysis: null, plan: null,
}

describe('PrepareScreen', () => {
  beforeEach(() => {
    vi.mocked(api.getDossier).mockResolvedValue(BUNDLE)
    vi.mocked(api.getPrivacy).mockResolvedValue({
      suggested: [{ value: 'Pierre Séré', kind: 'candidate' }], detected: [], confirmed: null,
    })
  })

  it('shows the review screen while the dossier has no confirmed list', async () => {
    render(
      <I18nProvider>
        <PrepareScreen id="ben-mor" onInterview={vi.fn()} />
      </I18nProvider>
    )
    expect(await screen.findByText('Ce qui sera masqué')).toBeInTheDocument()
  })

  it('shows the checklist once the list is confirmed', async () => {
    vi.mocked(api.getPrivacy).mockResolvedValue({
      suggested: [], detected: [], confirmed: [{ value: 'Pierre Séré', kind: 'candidate' }],
    })
    render(
      <I18nProvider>
        <PrepareScreen id="ben-mor" onInterview={vi.fn()} />
      </I18nProvider>
    )
    expect(await screen.findByText(/étapes prêtes/)).toBeInTheDocument()
  })

  it('fails closed and shows a retry option when getPrivacy rejects', async () => {
    vi.mocked(api.getPrivacy).mockRejectedValue(new Error('network error'))
    render(
      <I18nProvider>
        <PrepareScreen id="ben-mor" onInterview={vi.fn()} />
      </I18nProvider>
    )
    expect(await screen.findByText('Impossible de vérifier les informations à masquer.')).toBeInTheDocument()
    expect(screen.queryByText(/étapes prêtes/)).not.toBeInTheDocument()
  })
})
