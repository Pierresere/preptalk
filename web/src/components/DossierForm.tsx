import { useMemo, useState } from 'react'
import { useT } from '../i18n'
import type { CreateDossierInput } from '../services/api.js'
import type { Language, ProviderId, ProviderInfo } from '../types.js'

interface DossierFormProps {
  providers: ProviderInfo[]
  onSubmit: (input: CreateDossierInput) => void
  onCancel: () => void
}

export function DossierForm({ providers, onSubmit, onCancel }: DossierFormProps) {
  const t = useT()
  const [company, setCompany] = useState('')
  const [position, setPosition] = useState('')
  const [sites, setSites] = useState('')
  const [language, setLanguage] = useState<Language>('fr')
  const [provider, setProvider] = useState<ProviderId | ''>(providers[0]?.id ?? '')
  const [model, setModel] = useState(providers[0]?.models[0] ?? '')

  const currentProvider = useMemo(() => providers.find((p) => p.id === provider), [providers, provider])

  const handleProviderChange = (next: string) => {
    const found = providers.find((p) => p.id === next)
    setProvider((found?.id ?? '') as ProviderId | '')
    setModel(found?.models[0] ?? '')
  }

  const canSubmit = company.trim() !== '' && position.trim() !== '' && provider !== '' && model !== ''

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    const parsedSites = sites
      .split('\n')
      .map((s) => s.trim())
      .filter((s) => s !== '')
    onSubmit({
      company: company.trim(),
      position: position.trim(),
      sites: parsedSites,
      language,
      provider: provider as ProviderId,
      model,
    })
  }

  if (providers.length === 0) {
    return (
      <div className="panel">
        <p>{t('error.missingKey')}</p>
        <p>OPENAI_API_KEY / ANTHROPIC_API_KEY / GEMINI_API_KEY</p>
        <button type="button" className="btn" onClick={onCancel}>
          {t('form.cancel')}
        </button>
      </div>
    )
  }

  return (
    <form className="panel form-card" onSubmit={handleSubmit}>
      <h2>{t('form.title')}</h2>
      <p className="form-hint">{t('form.intro')}</p>

      <label htmlFor="dossier-company">{t('form.company')}</label>
      <input
        id="dossier-company"
        placeholder={t('form.companyHint')}
        value={company}
        onChange={(e) => setCompany(e.target.value)}
      />

      <label htmlFor="dossier-position">{t('form.position')}</label>
      <input
        id="dossier-position"
        placeholder={t('form.positionHint')}
        value={position}
        onChange={(e) => setPosition(e.target.value)}
      />

      <label htmlFor="dossier-sites">{t('form.sites')}</label>
      <textarea
        id="dossier-sites"
        placeholder={t('form.sitesHint')}
        value={sites}
        onChange={(e) => setSites(e.target.value)}
      />

      <details className="form-advanced">
        <summary>{t('form.advanced')}</summary>

        <label htmlFor="dossier-language">{t('form.language')}</label>
        <select id="dossier-language" value={language} onChange={(e) => setLanguage(e.target.value as Language)}>
          <option value="fr">FR</option>
          <option value="en">EN</option>
        </select>

        <label htmlFor="dossier-provider">{t('form.provider')}</label>
        <select id="dossier-provider" value={provider} onChange={(e) => handleProviderChange(e.target.value)}>
          {providers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.id}
            </option>
          ))}
        </select>

        <label htmlFor="dossier-model">{t('form.model')}</label>
        <select id="dossier-model" value={model} onChange={(e) => setModel(e.target.value)}>
          {(currentProvider?.models ?? []).map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </details>

      <div style={{ display: 'flex', gap: 'var(--gap)', marginTop: 'var(--gap)' }}>
        <button type="submit" className="btn btn-primary" disabled={!canSubmit}>
          {t('form.create')}
        </button>
        <button type="button" className="btn" onClick={onCancel}>
          {t('form.cancel')}
        </button>
      </div>
    </form>
  )
}
