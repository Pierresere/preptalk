import { useT } from '../i18n'
import { useDossier } from '../hooks/useDossier.js'
import { useInterview } from '../hooks/useInterview.js'
import { PhaseBar } from './PhaseBar.js'
import { MessageList } from './MessageList.js'
import { Composer } from './Composer.js'
import { SourcesPanel } from './SourcesPanel.js'

interface InterviewScreenProps {
  id: string
}

export function InterviewScreen({ id }: InterviewScreenProps) {
  const t = useT()
  const { bundle } = useDossier(id)
  const plan = bundle?.plan ?? null
  const { session, draft, status, stage, sources, start, send, stop, newSession } = useInterview(id, plan)

  if (plan === null) {
    return <p>{t('plan.empty')}</p>
  }

  const streaming = status === 'streaming'
  const recruiter = plan.persona.name

  return (
    <div>
      <PhaseBar plan={plan} session={session} />
      {streaming && stage.length > 0 && <p>{t(`stage.${stage}`)}</p>}
      {session === null ? (
        <button type="button" className="btn btn-primary" onClick={() => void start(t('interview.opener'))}>
          {t('interview.new')}
        </button>
      ) : (
        <div>
          {!streaming && (
            <button type="button" className="btn" onClick={newSession}>
              {t('interview.reset')}
            </button>
          )}
          <div className="split-grid split-grid--main-first">
            <div>
              <MessageList messages={session.messages} draft={draft} streaming={streaming} recruiter={recruiter} />
              <Composer disabled={streaming} streaming={streaming} onSend={(text) => void send(text)} onStop={stop} />
            </div>
            <SourcesPanel ids={sources} />
          </div>
        </div>
      )}
    </div>
  )
}
