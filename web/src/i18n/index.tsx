import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import fr from './fr.json'
import en from './en.json'

export type Lang = 'fr' | 'en'

const DICTS = { fr, en } as Record<Lang, Record<string, string>>

const LANG_STORAGE_KEY = 'preptalk.lang'

type TranslateVars = Record<string, string | number>

function interpolate(template: string, vars?: TranslateVars): string {
  if (!vars) return template
  return template.replace(/\{(\w+)\}/g, (match, key: string) => {
    const value = vars[key]
    return value === undefined ? match : String(value)
  })
}

function readStoredLang(): Lang {
  try {
    const stored = localStorage.getItem(LANG_STORAGE_KEY)
    return stored === 'en' ? 'en' : 'fr'
  } catch {
    return 'fr'
  }
}

interface I18nContextValue {
  lang: Lang
  setLang: (lang: Lang) => void
}

const I18nContext = createContext<I18nContextValue | null>(null)

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(readStoredLang)

  const setLang = useCallback((next: Lang) => {
    setLangState(next)
    try {
      localStorage.setItem(LANG_STORAGE_KEY, next)
    } catch {
      /* ignore: persistence is best-effort */
    }
  }, [])

  const value = useMemo(() => ({ lang, setLang }), [lang, setLang])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

function useI18nContext(): I18nContextValue {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useT/useLang must be used within I18nProvider')
  return ctx
}

export function useT(): (key: string, vars?: TranslateVars) => string {
  const { lang } = useI18nContext()
  return useCallback(
    (key: string, vars?: TranslateVars) => {
      const template = DICTS[lang][key] ?? key
      return interpolate(template, vars)
    },
    [lang]
  )
}

export function useLang(): [Lang, (l: Lang) => void] {
  const { lang, setLang } = useI18nContext()
  return [lang, setLang]
}
