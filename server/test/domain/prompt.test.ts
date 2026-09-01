import { describe, expect, it } from 'vitest'
import { buildInterviewSystem } from '../../src/domain/prompt.js'
import type { Plan } from '../../src/domain/types.js'
import type { ChunkHit } from '../../src/domain/retrieval.js'

const plan: Plan = {
  persona: { name: 'Alex Martin', role: 'Engineering Manager', concerns: 'delivery quality', tone: 'direct but warm' },
  phases: [
    { id: 'welcome', title: 'Welcome', questions: 2, objective: 'Put the candidate at ease.', targeting: [], examples: ['Tell me about yourself.'] },
    { id: 'core', title: 'Core skills', questions: 3, objective: 'Assess technical depth.', targeting: [], examples: ['Describe a hard bug you fixed.'] },
    { id: 'questions', title: 'Your questions', questions: 1, objective: 'Let the candidate ask questions.', targeting: [], examples: [] },
  ],
}

const chunks: readonly ChunkHit[] = [
  { chunk: { id: 'offer', title: 'Job offer', kind: 'offer', body: 'We seek a senior engineer.' }, score: 10, reasons: [] },
]

function build(turn: number, overrides: Partial<Parameters<typeof buildInterviewSystem>[0]> = {}): string {
  return buildInterviewSystem({
    plan,
    turn,
    chunks,
    language: 'en',
    company: 'Acme',
    position: 'Senior Engineer',
    candidate: 'Jordan',
    ...overrides,
  })
}

describe('buildInterviewSystem', () => {
  it('turn 1: persona, question count, phase title, no closed phases', () => {
    const prompt = build(1)
    expect(prompt).toContain('Alex Martin')
    expect(prompt).toContain('Question 1 of 6')
    expect(prompt).toContain('Welcome')
    expect(prompt).not.toContain('ALREADY COVERED')
  })

  it('turn 4: closed phases include the first phase title', () => {
    const prompt = build(4)
    expect(prompt).toContain('ALREADY COVERED')
    expect(prompt).toContain('Welcome')
  })

  it('turn 7: debrief block, no current-phase block', () => {
    const prompt = build(7)
    expect(prompt).toContain('<debrief>')
    expect(prompt).not.toContain('<current-phase>')
  })

  it('renders sources as source tags', () => {
    const prompt = build(1)
    expect(prompt).toContain('<source id="offer"')
  })
})
