import { closedPhases, phaseForTurn, totalQuestions } from './phases.js'
import type { Language, Plan } from './types.js'
import type { ChunkHit } from './retrieval.js'

interface PromptInput {
  readonly plan: Plan
  readonly turn: number
  readonly chunks: readonly ChunkHit[]
  readonly language: Language
  readonly company: string
  readonly position: string
  readonly candidate: string
}

const LANGUAGE_NAME: Record<Language, string> = { fr: 'French', en: 'English' }

function personaBlock(input: PromptInput): string {
  const { persona } = input.plan
  const candidate = input.candidate.trim().length > 0 ? input.candidate : 'the candidate'
  return [
    `You are ${persona.name}, ${persona.role}, interviewing ${candidate} for the position of ` +
      `${input.position} at ${input.company}.`,
    `What concerns you daily: ${persona.concerns}.`,
    `Tone: ${persona.tone}.`,
    'You are cordial and professional, never complacent; you listen and dig when an answer stays general.',
    'If the candidate has not said anything substantive yet, greet them and ask the first question.',
  ].join('\n')
}

function conductBlock(): string {
  return [
    'CONDUCT:',
    '- Ask exactly one question per turn.',
    '- React in one or two sentences before asking, reusing a word the candidate used.',
    '- If the answer is solid, dig one level deeper rather than change topic.',
    '- Write as one speaks; no bullet-point recap.',
  ].join('\n')
}

function coachingBlock(): string {
  return [
    'COACHING:',
    '- Only when the candidate really stumbles (vague or off-topic answer, fewer than two sentences,',
    '  "I don\'t know", or a factual error about the company or its domain), step out of role with a block',
    '  starting exactly with:',
    '  > **Out of role — what I would have liked to hear:**',
    '  followed by 2 to 4 concrete sentences grounded in the sources, then resume the interview.',
    '- Never coach on an answer that is merely improvable.',
  ].join('\n')
}

function honestyBlock(language: Language): string {
  return [
    'HONESTY:',
    '- Never invent a fact about the company (revenue, headcount, certification, client, salary),',
    '  and never invent a standard figure.',
    `- Conduct the interview in ${LANGUAGE_NAME[language]}, except during a phase whose id is` +
      ' "language-switch", where you must switch fully to the other language.',
    '- No LaTeX.',
  ].join('\n')
}

function phaseBlock(input: PromptInput): string {
  const phase = phaseForTurn(input.plan, input.turn)
  if (phase === null) return debriefBlock(input)
  const closed = closedPhases(input.plan, input.turn)
  const examples = phase.examples.map((example) => `- ${example}`).join('\n')
  const lines = [
    '<current-phase>',
    `Question ${input.turn} of ${totalQuestions(input.plan)}. Phase: ${phase.title}.`,
    `Objective: ${phase.objective}.`,
    'Reference questions (inspire, do not copy):',
    examples,
  ]
  if (closed.length > 0) {
    lines.push(`ALREADY COVERED — do not ask again: ${closed.map((p) => p.title).join(' · ')}`)
  }
  lines.push('</current-phase>')
  return lines.join('\n')
}

function debriefBlock(input: PromptInput): string {
  const perPhase = input.plan.phases
    .map((phase) => `- ${phase.title}: what worked, what was missing, one thing to fix.`)
    .join('\n')
  return [
    '<debrief>',
    'The interview is over. Leave the role for good and deliver the debrief.',
    'For each phase, cover what worked, what was missing, and the one thing to fix:',
    perPhase,
    'End with three ranked priorities. Be frank.',
    '</debrief>',
  ].join('\n')
}

function sourcesBlock(chunks: readonly ChunkHit[]): string {
  const body = chunks.length === 0
    ? 'No relevant source.'
    : chunks
        .map((hit) => `<source id="${hit.chunk.id}" title="${hit.chunk.title}" kind="${hit.chunk.kind}">${hit.chunk.body}</source>`)
        .join('\n')
  return [
    '<sources>',
    body,
    '</sources>',
    'These sources anchor your questions and coaching; do not cite them like a documentation assistant.',
  ].join('\n')
}

export function buildInterviewSystem(input: PromptInput): string {
  return [
    personaBlock(input),
    conductBlock(),
    coachingBlock(),
    honestyBlock(input.language),
    phaseBlock(input),
    sourcesBlock(input.chunks),
  ].join('\n\n')
}
