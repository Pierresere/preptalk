import { render } from '@testing-library/react'
import { I18nProvider } from '../src/i18n'
import { MessageList } from '../src/components/MessageList'
import type { Message } from '../src/types'

it('renders a coaching blockquote with class coaching', () => {
  const messages: Message[] = [
    { role: 'assistant', text: 'Question text\n\n> **Coaching**\n> stay concise' },
  ]

  const { container } = render(
    <I18nProvider>
      <MessageList messages={messages} draft="" streaming={false} recruiter="Alex" />
    </I18nProvider>
  )

  const blockquote = container.querySelector('blockquote')
  expect(blockquote).not.toBeNull()
  expect(blockquote?.classList.contains('coaching')).toBe(true)
})
