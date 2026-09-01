import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { I18nProvider } from '../src/i18n'
import { PrivacyReview } from '../src/components/PrivacyReview'
import * as api from '../src/services/api'

vi.mock('../src/services/api')

describe('PrivacyReview', () => {
  beforeEach(() => {
    vi.mocked(api.getPrivacy).mockResolvedValue({
      suggested: [{ value: 'Pierre Séré', kind: 'candidate' }],
      detected: [{ value: 'pierre@example.com', kind: 'email', context: 'écrire à pierre@example.com' }],
      confirmed: null,
    })
    vi.mocked(api.putPrivacy).mockResolvedValue(undefined)
  })

  it('confirms the suggested names and calls onConfirmed', async () => {
    const onConfirmed = vi.fn()
    render(
      <I18nProvider>
        <PrivacyReview id="ben-mor" onConfirmed={onConfirmed} />
      </I18nProvider>
    )
    await screen.findByText('Pierre Séré')
    fireEvent.click(screen.getByRole('button', { name: /continuer/i }))
    await waitFor(() => expect(api.putPrivacy).toHaveBeenCalledWith('ben-mor', [
      { value: 'Pierre Séré', kind: 'candidate' },
    ]))
    expect(onConfirmed).toHaveBeenCalledOnce()
  })

  it('drops an unchecked name from what gets saved', async () => {
    render(
      <I18nProvider>
        <PrivacyReview id="ben-mor" onConfirmed={vi.fn()} />
      </I18nProvider>
    )
    fireEvent.click(await screen.findByRole('checkbox', { name: /Pierre Séré/ }))
    fireEvent.click(screen.getByRole('button', { name: /continuer/i }))
    await waitFor(() => expect(api.putPrivacy).toHaveBeenCalledWith('ben-mor', []))
  })

  it('saves a newly added name alongside a previously confirmed one', async () => {
    vi.mocked(api.getPrivacy).mockResolvedValue({
      suggested: [{ value: 'Pierre Séré', kind: 'candidate' }],
      detected: [{ value: 'pierre@example.com', kind: 'email', context: 'écrire à pierre@example.com' }],
      confirmed: [{ value: 'Pierre Séré', kind: 'candidate' }],
    })
    render(
      <I18nProvider>
        <PrivacyReview id="ben-mor" onConfirmed={vi.fn()} />
      </I18nProvider>
    )
    await screen.findByText('Pierre Séré')
    fireEvent.change(screen.getByLabelText(/ajouter un nom/i), { target: { value: 'Jean Dupont' } })
    fireEvent.click(screen.getByRole('button', { name: /^ajouter$/i }))
    fireEvent.click(screen.getByRole('button', { name: /continuer/i }))
    await waitFor(() => expect(api.putPrivacy).toHaveBeenCalledWith('ben-mor', [
      { value: 'Pierre Séré', kind: 'candidate' },
      { value: 'Jean Dupont', kind: 'person' },
    ]))
  })

  it('lists regex detections without a checkbox', async () => {
    render(
      <I18nProvider>
        <PrivacyReview id="ben-mor" onConfirmed={vi.fn()} />
      </I18nProvider>
    )
    await screen.findByText('pierre@example.com')
    expect(screen.getAllByRole('checkbox')).toHaveLength(1)
  })
})
