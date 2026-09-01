import { useT } from '../i18n'
import { phaseForTurn, totalQuestions, turnFromHistory } from '../services/phases.js'
import type { Plan, Session } from '../types.js'

interface PhaseBarProps {
  plan: Plan
  session: Session | null
}

export function PhaseBar({ plan, session }: PhaseBarProps) {
  const t = useT()
  const turn = turnFromHistory(session?.messages ?? [])
  const total = totalQuestions(plan)
  const phase = phaseForTurn(plan, turn)

  return (
    <div className="phasebar">
      {phase === null ? t('phase.debrief') : `${t('phase.counter', { n: turn, total })} · ${phase.title}`}
    </div>
  )
}
