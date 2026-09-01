import { useT } from '../i18n'

interface HomeScreenProps {
  onCandidate: () => void
}

export function HomeScreen({ onCandidate }: HomeScreenProps) {
  const t = useT()
  return (
    <div className="home">
      <div className="home-hero">
        <h1>{t('home.title')}</h1>
        <p>{t('home.subtitle')}</p>
      </div>
      <div className="home-cards">
        <button type="button" className="home-card" onClick={onCandidate}>
          <span className="home-card-emoji" aria-hidden="true">🎯</span>
          <strong>{t('home.candidate')}</strong>
          <p>{t('home.candidateHint')}</p>
        </button>
        <div className="home-card home-card--soon" aria-disabled="true">
          <span className="home-card-emoji" aria-hidden="true">📋</span>
          <strong>{t('home.recruiter')}</strong>
          <p>{t('home.recruiterHint')}</p>
          <span className="home-soon">{t('home.soon')}</span>
        </div>
      </div>
    </div>
  )
}
