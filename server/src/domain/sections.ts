import type { Dossier, Language } from './types.js'

export const SECTION_IDS = [
  'sector',
  'products',
  'revenue',
  'headcount',
  'sites',
  'certifications',
  'news',
  'culture',
  'competitors',
] as const

export type SectionId = (typeof SECTION_IDS)[number]

export const SECTION_TITLES: Record<SectionId, { fr: string; en: string }> = {
  sector: { fr: 'Secteur', en: 'Sector' },
  products: { fr: 'Produits et services', en: 'Products and services' },
  revenue: { fr: "Chiffre d'affaires", en: 'Revenue' },
  headcount: { fr: 'Effectif', en: 'Headcount' },
  sites: { fr: 'Sites et établissements', en: 'Sites and locations' },
  certifications: { fr: 'Certifications', en: 'Certifications' },
  news: { fr: 'Actualités', en: 'News' },
  culture: { fr: 'Culture et valeurs', en: 'Culture and values' },
  competitors: { fr: 'Concurrents', en: 'Competitors' },
}

const SECTION_DESCRIPTIONS: Record<SectionId, string> = {
  sector: "the company's industry sector and area of activity",
  products: 'the products and services the company offers',
  revenue: "the company's revenue figures",
  headcount: "the company's headcount and workforce size",
  sites: "the company's sites, plants, and establishments",
  certifications: 'the certifications and quality labels the company holds',
  news: "the company's recent news and notable events",
  culture: "the company's culture and stated values",
  competitors: "the company's main competitors",
}

export function notFoundSentence(language: Language): string {
  return language === 'fr' ? 'Non trouvé — à vérifier.' : 'Not found — to verify.'
}

export function buildQuery(
  section: SectionId,
  dossier: Dossier,
  knownSector: string | null,
  language: Language
): string {
  const sites = dossier.sites.join(', ')
  const sectorClause = knownSector !== null ? ` The company's known sector is: ${knownSector}.` : ''
  return (
    `Research "${dossier.company}" (sites: ${sites}). ` +
    `Report ONLY ${SECTION_DESCRIPTIONS[section]}.${sectorClause} ` +
    `Answer in ${language}, 5 to 15 lines of Markdown, no heading. ` +
    `Never invent a figure: if a fact is not found in a source, write "${notFoundSentence(language)}".`
  )
}
