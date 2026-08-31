import { useState, type KeyboardEvent } from 'react'
import { useT } from '../i18n'

interface ComposerProps {
  disabled: boolean
  streaming: boolean
  onSend: (text: string) => void
  onStop: () => void
}

export function Composer({ disabled, streaming, onSend, onStop }: ComposerProps) {
  const t = useT()
  const [text, setText] = useState('')

  const submit = () => {
    const trimmed = text.trim()
    if (trimmed.length === 0) return
    onSend(trimmed)
    setText('')
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  return (
    <div className="composer">
      <textarea
        value={text}
        placeholder={t('interview.placeholder')}
        disabled={disabled}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        style={{ flex: 1 }}
      />
      {streaming ? (
        <button type="button" className="btn" onClick={onStop}>
          {t('interview.stop')}
        </button>
      ) : (
        <button type="button" className="btn btn-primary" disabled={disabled} onClick={submit}>
          {t('interview.start')}
        </button>
      )}
    </div>
  )
}
