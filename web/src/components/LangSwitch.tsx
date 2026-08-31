import { useT, useLang } from '../i18n'

export function LangSwitch() {
  const t = useT()
  const [lang, setLang] = useLang()

  const handleClick = () => {
    setLang(lang === 'fr' ? 'en' : 'fr')
  }

  return (
    <button type="button" className="btn" onClick={handleClick}>
      {lang === 'fr' ? t('lang.fr') : t('lang.en')}
    </button>
  )
}
