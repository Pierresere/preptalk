import { describe, expect, it } from 'vitest'
import { suggestNames } from '../../src/domain/suggest.js'

const RESUME = `Pierre Séré
Coordonnateur qualité
pierre.sere@example.com · 514-555-0123

Expérience
Câbles Ben-Mor — Saint-Hyacinthe`

describe('suggestNames', () => {
  it('takes the candidate name from the resume header', () => {
    expect(suggestNames(RESUME, '', ['Câbles Ben-Mor'])).toContainEqual({ value: 'Pierre Séré', kind: 'candidate' })
  })

  it('skips a leading blank line and a section heading', () => {
    expect(suggestNames('\n\nMarie Tremblay\nFormation\n', '', [])).toContainEqual({
      value: 'Marie Tremblay', kind: 'candidate',
    })
  })

  it('never suggests a keep span', () => {
    const found = suggestNames('Câbles Ben-Mor\nmarie@example.com', '', ['Câbles Ben-Mor'])
    expect(found.some((n) => n.value === 'Câbles Ben-Mor')).toBe(false)
  })

  it('suggests a third party after a contact marker', () => {
    const offer = 'Postulez. Contact : Marie Tremblay, responsable RH.'
    expect(suggestNames('', offer, [])).toContainEqual({ value: 'Marie Tremblay', kind: 'person' })
  })

  it('suggests the name on the line above an email in an offer', () => {
    const offer = 'Notre équipe\nJean Gagnon\njean.gagnon@example.com'
    expect(suggestNames('', offer, [])).toContainEqual({ value: 'Jean Gagnon', kind: 'person' })
  })

  it('returns nothing for a resume without a name-shaped header', () => {
    expect(suggestNames('CURRICULUM VITAE 2026\n\nExpérience', '', [])).toEqual([])
  })
})
