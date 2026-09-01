import { useState } from 'react'
import { useT } from '../i18n'

const NAME_PATTERN = /^[\w.-]+\.(md|txt)$/

function isValidName(name: string): boolean {
  return NAME_PATTERN.test(name) && !name.includes('..')
}

interface DocumentsPanelProps {
  documents: { name: string; chars: number }[]
  onAdd: (name: string, text: string) => void | Promise<void>
  onRemove: (name: string) => void | Promise<void>
  busy: string | null
}

export function DocumentsPanel({ documents, onAdd, onRemove, busy }: DocumentsPanelProps) {
  const t = useT()
  const [name, setName] = useState('')
  const [text, setText] = useState('')

  const canAdd = isValidName(name) && text.trim().length > 0 && busy === null

  const handleAdd = async () => {
    await onAdd(name, text)
    setName('')
    setText('')
  }

  return (
    <div className="panel">
      <ul>
        {documents.map((doc) => (
          <li key={doc.name}>
            {doc.name} ({doc.chars})
            <button
              type="button"
              className="btn"
              disabled={busy !== null}
              onClick={() => void onRemove(doc.name)}
              style={{ marginLeft: 'var(--gap)' }}
            >
              {t('documents.remove')}
            </button>
          </li>
        ))}
      </ul>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)' }}>
        <label>
          {t('documents.name')}
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} style={{ display: 'block', width: '100%' }} />
        </label>
        <label>
          {t('documents.text')}
          <textarea rows={8} value={text} onChange={(e) => setText(e.target.value)} style={{ display: 'block', width: '100%' }} />
        </label>
        <button type="button" className="btn btn-primary" disabled={!canAdd} onClick={() => void handleAdd()}>
          {t('documents.add')}
        </button>
      </div>
    </div>
  )
}
