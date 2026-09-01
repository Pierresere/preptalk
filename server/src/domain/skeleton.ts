/**
 * The universal interview skeleton. Every interview walks these phases in
 * order; the AI only fills objective, targeting and examples for the dossier.
 * `guidance` tells the plan generator what each phase should draw on.
 */
export interface SkeletonPhase {
  readonly id: string
  readonly questions: number
  readonly guidance: string
}

export const SKELETON: readonly SkeletonPhase[] = [
  { id: 'welcome', questions: 2, guidance: 'Career path coherence and real motivation for this company. Draw on the resume.' },
  { id: 'core', questions: 3, guidance: 'The heart of the job: the first three responsibilities of the offer. Can the candidate do them, or only talk about them?' },
  { id: 'domain', questions: 3, guidance: 'The company domain: products, services, sector, standards. Has the candidate started learning it?' },
  { id: 'situations', questions: 3, guidance: 'Situational dilemmas where process meets pressure, taken from the offer and the sector.' },
  { id: 'behavior', questions: 2, guidance: 'Behavioral: driving change, a failure, prioritizing. Draw on transitions in the resume.' },
  { id: 'sensitive', questions: 2, guidance: 'The uncomfortable topics: requirements the resume covers partially or not at all, gaps, salary.' },
  { id: 'questions', questions: 1, guidance: 'The candidate asks questions. Draw on the company profile for what a good question would reveal.' },
]

export const LANGUAGE_SWITCH: SkeletonPhase = {
  id: 'language-switch',
  questions: 1,
  guidance: 'Switch to the second language the offer requires and stay in it while the candidate answers in it.',
}
