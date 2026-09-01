import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { I18nProvider } from '../src/i18n'
import { HomeScreen } from '../src/components/HomeScreen'

describe('HomeScreen', () => {
  it('shows both audience cards and fires onCandidate', () => {
    const onCandidate = vi.fn()
    render(
      <I18nProvider>
        <HomeScreen onCandidate={onCandidate} />
      </I18nProvider>
    )
    fireEvent.click(screen.getByRole('button', { name: /je prépare un entretien/i }))
    expect(onCandidate).toHaveBeenCalledOnce()
    expect(screen.getByText(/bientôt disponible/i)).toBeInTheDocument()
  })
})
