import { useEffect, useRef, useState } from 'react'
import { useT } from '../i18n'

interface TextPanelProps {
  label: string
  value: string
  onSave: (text: string) => void | Promise<void>
  busy: string | null
}

export function TextPanel({ label, value, onSave, busy }: TextPanelProps) {
  const t = useT()
  const [draft, setDraft] = useState(value)
  const [saved, setSaved] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setDraft(value)
  }, [value])

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  const dirty = draft !== value

  const handleSave = async () => {
    await onSave(draft)
    setSaved(true)
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="panel">
      <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>{label}</label>
      <textarea
        rows={16}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        style={{ width: '100%', fontFamily: 'var(--font)' }}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--gap)', marginTop: 'var(--gap)' }}>
        <button
          type="button"
          className="btn btn-primary"
          disabled={!dirty || busy !== null}
          onClick={() => void handleSave()}
        >
          {t('prepare.save')}
        </button>
        {saved && <span>{t('prepare.saved')}</span>}
      </div>
    </div>
  )
}
