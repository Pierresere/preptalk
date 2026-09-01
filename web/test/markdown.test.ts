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

it('does not let a quote in a bare URL break out of the href attribute', () => {
  const html = toHtml('https://x.com/"onmouseover="alert(1)')
  expect(html).not.toMatch(/href="[^"]*"onmouseover/)
  expect(html).toContain('&quot;')
})
