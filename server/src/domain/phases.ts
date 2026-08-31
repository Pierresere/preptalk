import type { Message, Phase, Plan } from './types.js'

/** Each recruiter reply already given counts as one question asked. */
export function turnFromHistory(messages: readonly Message[]): number {
  return messages.filter((m) => m.role === 'assistant').length + 1
}

export function totalQuestions(plan: Plan): number {
  return plan.phases.reduce((sum, phase) => sum + phase.questions, 0)
}

/** `null` once the plan is exhausted: that is the debrief signal. */
export function phaseForTurn(plan: Plan, turn: number): Phase | null {
  let bound = 0
  for (const phase of plan.phases) {
    bound += phase.questions
    if (turn <= bound) return phase
  }
  return null
}

/** Phases already walked: the model must not reopen them. */
export function closedPhases(plan: Plan, turn: number): readonly Phase[] {
  const current = phaseForTurn(plan, turn)
  if (current === null) return plan.phases
  return plan.phases.slice(0, plan.phases.indexOf(current))
}
