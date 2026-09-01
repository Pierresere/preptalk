import { useEffect, useState } from 'react'
import { useT } from '../i18n'
import { getPrivacy, putPrivacy } from '../services/api.js'
import type { ConfirmedName, Detection, PrivacyReviewData } from '../types.js'

interface PrivacyReviewProps {
  id: string
  onConfirmed: () => void
}

function keyOf(name: ConfirmedName): string {
  return `${name.kind}:${name.value}`
}

/** The excerpt where a name was found, so the user can judge a false positive on sight. */
function contextOf(name: ConfirmedName, detected: readonly Detection[]): string {
  return detected.find((d) => d.value === name.value)?.context ?? ''
}

export function PrivacyReview({ id, onConfirmed }: PrivacyReviewProps) {
  const t = useT()
  const [data, setData] = useState<PrivacyReviewData | null>(null)
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [extra, setExtra] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let alive = true
    void getPrivacy(id).then((loaded) => {
      if (!alive) return
      const names = loaded.confirmed ?? loaded.suggested
      setData(loaded)
      setChecked(new Set(names.map(keyOf)))
    })
    return () => {
      alive = false
    }
  }, [id])

  if (data === null) return null

  const names: ConfirmedName[] = [...(data.confirmed ?? data.suggested)]
  const rules: Detection[] = data.detected.filter((d) => d.kind !== 'candidate' && d.kind !== 'person')

  const toggle = (name: ConfirmedName): void => {
    setChecked((current) => {
      const next = new Set(current)
      const key = keyOf(name)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const addExtra = (): void => {
    const value = extra.trim()
    if (value === '') return
    const name: ConfirmedName = { value, kind: 'person' }
    setData({ ...data, suggested: [...names, name] })
    setChecked((current) => new Set(current).add(keyOf(name)))
    setExtra('')
  }

  const confirm = async (): Promise<void> => {
    setSaving(true)
    try {
      await putPrivacy(id, names.filter((name) => checked.has(keyOf(name))))
      onConfirmed()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="panel privacy-review">
      <h2>{t('privacy.title')}</h2>
      <p className="form-hint">{t('privacy.intro')}</p>

      <h3>{t('privacy.names')}</h3>
      <ul className="privacy-list">
        {names.map((name) => (
          <li key={keyOf(name)}>
            <label>
              <input type="checkbox" checked={checked.has(keyOf(name))} onChange={() => toggle(name)} />
              <span>{name.value}</span>
              <span className="privacy-kind">{t(`privacy.kind.${name.kind}`)}</span>
              <span className="privacy-context">{contextOf(name, data.detected)}</span>
            </label>
          </li>
        ))}
      </ul>

      <label htmlFor="privacy-extra">{t('privacy.add')}</label>
      <div className="privacy-add">
        <input id="privacy-extra" value={extra} onChange={(e) => setExtra(e.target.value)} />
        <button type="button" className="btn" onClick={addExtra}>
          {t('privacy.addAction')}
        </button>
      </div>

      <h3>{t('privacy.always')}</h3>
      <ul className="privacy-list">
        {rules.map((d) => (
          <li key={`${d.kind}:${d.value}`}>
            <span>{d.value}</span>
            <span className="privacy-kind">{t(`privacy.kind.${d.kind}`)}</span>
            <span className="privacy-context">{d.context}</span>
          </li>
        ))}
      </ul>

      <button type="button" className="btn btn-primary btn-big" disabled={saving} onClick={() => void confirm()}>
        {t('privacy.confirm')}
      </button>
    </div>
  )
}
