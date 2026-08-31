import { applyTheme, readTheme, writeTheme } from '../src/services/theme'

beforeEach(() => {
  localStorage.clear()
  delete document.documentElement.dataset.theme
})

it('applyTheme sets data-theme', () => {
  applyTheme('dark')
  expect(document.documentElement.dataset.theme).toBe('dark')
})

it('readTheme returns auto when storage empty', () => {
  expect(readTheme()).toBe('auto')
})

it('writeTheme persists and applies', () => {
  writeTheme('light')
  expect(localStorage.getItem('preptalk.theme')).toBe('light')
  expect(document.documentElement.dataset.theme).toBe('light')
  expect(readTheme()).toBe('light')
})
