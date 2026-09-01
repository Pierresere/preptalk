import { describe, expect, it } from 'vitest'
import { detect, mask, unmask, personalDataOf } from '../../src/domain/privacy.js'
import type { ConfirmedName, PersonalData } from '../../src/domain/privacy.js'
import type { Dossier } from '../../src/domain/types.js'

const NAMES: ConfirmedName[] = [
  { value: 'Pierre Séré', kind: 'candidate' },
  { value: 'Séré', kind: 'candidate' },
  { value: 'Marie Tremblay', kind: 'person' },
]
const personal: PersonalData = { names: NAMES, keep: ['Câbles Ben-Mor', 'Coordonnateur qualité'] }

describe('mask', () => {
  it('masks emails, phones, postal codes and LinkedIn profiles', () => {
    const text = [
      'pierre.sere@example.com',
      '514-555-0123',
      '06 12 34 56 78',
      'H2X 1Y4',
      'https://www.linkedin.com/in/pierre-sere',
    ].join('\n')
    const out = mask(text, personal)
    expect(out.text).toBe('[COURRIEL_1]\n[TEL_1]\n[TEL_2]\n[CODEPOSTAL_1]\n[PROFIL_1]')
    expect(unmask(out.text, out.map)).toBe(text)
  })

  it('masks names case- and accent-insensitively with distinct tokens per value', () => {
    const out = mask('PIERRE SERE a écrit. Sere a signé. Marie Tremblay recrute.', personal)
    expect(out.text).toBe('[CANDIDAT_1] a écrit. [CANDIDAT_2] a signé. [PERSONNE_1] recrute.')
    expect(out.map.get('[CANDIDAT_1]')).toBe('PIERRE SERE')
    expect(out.map.get('[CANDIDAT_2]')).toBe('Sere')
  })

  it('never masks a name inside a keep span', () => {
    const out = mask('Câbles Ben-Mor cherche. Séré postule.', {
      names: [{ value: 'Ben-Mor', kind: 'candidate' }, { value: 'Séré', kind: 'candidate' }],
      keep: ['Câbles Ben-Mor'],
    })
    expect(out.text).toBe('Câbles Ben-Mor cherche. [CANDIDAT_1] postule.')
  })

  it('masks an email before the name it contains', () => {
    const out = mask('Écrire à pierre.sere@example.com pour joindre Pierre Séré.', personal)
    expect(out.text).toBe('Écrire à [COURRIEL_1] pour joindre [CANDIDAT_1].')
  })

  it('is idempotent on already-masked text', () => {
    const once = mask('Pierre Séré', personal)
    expect(mask(once.text, personal).text).toBe(once.text)
  })

  it('leaves text without personal data untouched', () => {
    const out = mask('Coordonnateur qualité chez Câbles Ben-Mor.', personal)
    expect(out.text).toBe('Coordonnateur qualité chez Câbles Ben-Mor.')
    expect(out.map.size).toBe(0)
  })
})

describe('detect', () => {
  it('reports the same values mask replaces, with context', () => {
    const text = 'Contact : Marie Tremblay, marie@example.com'
    const found = detect(text, personal)
    expect(found.map((d) => d.kind).sort()).toEqual(['email', 'person'])
    expect(found.every((d) => text.includes(d.value))).toBe(true)
    expect(found.every((d) => d.context.includes(d.value))).toBe(true)
  })
})

describe('personalDataOf', () => {
  it('keeps the company and position spans', () => {
    const dossier = {
      id: 'ben-mor', company: 'Câbles Ben-Mor', position: 'Coordonnateur qualité',
      sites: [], language: 'fr', provider: 'gemini', model: 'm',
      createdAt: '', updatedAt: '',
    } as Dossier
    expect(personalDataOf(dossier, NAMES)).toEqual({ names: NAMES, keep: ['Câbles Ben-Mor', 'Coordonnateur qualité'] })
  })
})
