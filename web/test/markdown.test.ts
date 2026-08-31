import { toHtml } from '../src/services/markdown'

it('renders blockquote and bold markup', () => {
  const html = toHtml('> **Out of role**')
  expect(html).toContain('<blockquote>')
  expect(html).toContain('<strong>')
})

it('escapes raw HTML', () => {
  const html = toHtml('<b>')
  expect(html).toContain('&lt;b&gt;')
})
