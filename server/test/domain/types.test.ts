import { describe, expect, it } from 'vitest'
import { PlanSchema, DossierSchema } from '../../src/domain/types.js'
import { SKELETON, LANGUAGE_SWITCH } from '../../src/domain/skeleton.js'

describe('schemas', () => {
  it('rejects a plan without phases', () => {
    const result = PlanSchema.safeParse({ persona: { name: 'A', role: 'B', concerns: 'C', tone: 'D' }, phases: [] })
    expect(result.success).toBe(false)
  })
  it('accepts a minimal dossier', () => {
    const result = DossierSchema.safeParse({
      id: 'acme', company: 'Acme', position: 'QA lead', sites: [], language: 'fr',
      provider: 'gemini', model: 'gemini-3.7-flash',
      createdAt: '2026-08-31T00:00:00.000Z', updatedAt: '2026-08-31T00:00:00.000Z',
    })
    expect(result.success).toBe(true)
  })
})

describe('skeleton', () => {
  it('has seven phases totalling 16 questions', () => {
    expect(SKELETON.map((p) => p.id)).toEqual(['welcome','core','domain','situations','behavior','sensitive','questions'])
    expect(SKELETON.reduce((n, p) => n + p.questions, 0)).toBe(16)
    expect(LANGUAGE_SWITCH.questions).toBe(1)
  })
})
