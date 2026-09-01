import { describe, expect, it } from 'vitest'
import { closedPhases, phaseForTurn, totalQuestions, turnFromHistory } from '../../src/domain/phases.js'
import type { Plan } from '../../src/domain/types.js'

const plan: Plan = {
  persona: { name: 'A', role: 'B', concerns: 'C', tone: 'D' },
  phases: [
    { id: 'welcome', title: 'Welcome', questions: 2, objective: '', targeting: [], examples: [] },
    { id: 'core', title: 'Core', questions: 3, objective: '', targeting: [], examples: [] },
    { id: 'questions', title: 'Yours', questions: 1, objective: '', targeting: [], examples: [] },
  ],
}

describe('phases', () => {
  it('counts turns from assistant replies', () => {
    expect(turnFromHistory([])).toBe(1)
    expect(turnFromHistory([{ role: 'user', text: 'hi' }, { role: 'assistant', text: 'q1' }, { role: 'user', text: 'a1' }])).toBe(2)
  })
  it('maps turn to phase and returns null past the end', () => {
    expect(totalQuestions(plan)).toBe(6)
    expect(phaseForTurn(plan, 1)?.id).toBe('welcome')
    expect(phaseForTurn(plan, 2)?.id).toBe('welcome')
    expect(phaseForTurn(plan, 3)?.id).toBe('core')
    expect(phaseForTurn(plan, 6)?.id).toBe('questions')
    expect(phaseForTurn(plan, 7)).toBeNull()
  })
  it('lists closed phases', () => {
    expect(closedPhases(plan, 1)).toEqual([])
    expect(closedPhases(plan, 4).map((p) => p.id)).toEqual(['welcome'])
    expect(closedPhases(plan, 99).map((p) => p.id)).toEqual(['welcome', 'core', 'questions'])
  })
})
