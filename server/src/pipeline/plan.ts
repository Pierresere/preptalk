import { z } from 'zod'
import type { Analysis, Dossier, Plan } from '../domain/types.js'
import { PersonaSchema, PlanSchema } from '../domain/types.js'
import type { PersonalData } from '../domain/privacy.js'
import type { Provider } from '../providers/types.js'
import { ProviderError } from '../providers/types.js'
import { LANGUAGE_SWITCH, SKELETON, type SkeletonPhase } from '../domain/skeleton.js'

const LANGUAGE_SWITCH_RE = /bilingu|bilingual|anglais|english|français|french/i

const PlanDraftSchema = z.object({
  persona: PersonaSchema,
  phases: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      objective: z.string(),
      targeting: z.array(z.string()),
      examples: z.array(z.string()),
    })
  ),
})
type PlanDraft = z.infer<typeof PlanDraftSchema>

export function needsLanguageSwitch(offer: string): boolean {
  return LANGUAGE_SWITCH_RE.test(offer)
}

function phaseList(offer: string): readonly SkeletonPhase[] {
  if (!needsLanguageSwitch(offer)) return SKELETON
  const questionsIndex = SKELETON.findIndex((p) => p.id === 'questions')
  return [...SKELETON.slice(0, questionsIndex), LANGUAGE_SWITCH, ...SKELETON.slice(questionsIndex)]
}

function systemPrompt(language: string): string {
  return [
    'You design an interview plan for a candidate preparing for a job interview.',
    'Keep every phase id exactly as given.',
    `Write titles, objectives, and example questions in ${language}.`,
    'For each phase, write "targeting": 6 to 12 keywords, in the language of the offer, resume, and company profile ' +
      '(the source texts), that the candidate should target in their answers.',
    'For each phase, write 3 to 4 example interview questions in "examples".',
    'Deduce the persona "role" from the offer: who would realistically run this interview. ' +
      'If the interviewer is not named, invent a plausible fictional "name". ' +
      '"concerns" describes what this person struggles with day to day in their role. ' +
      '"tone" is one sentence describing how they speak.',
  ].join('\n')
}

function buildPrompt(
  phases: readonly SkeletonPhase[],
  offer: string,
  resume: string,
  company: string,
  analysis: Analysis | null
): string {
  const phaseLines = phases
    .map((p) => `- id: ${p.id} (${p.questions} questions) — ${p.guidance}`)
    .join('\n')
  const parts = [
    phaseLines,
    `<offer>\n${offer}\n</offer>`,
    `<resume>\n${resume}\n</resume>`,
    `<company>\n${company}\n</company>`,
  ]
  if (analysis) parts.push(`<analysis-summary>\n${analysis.summary}\n</analysis-summary>`)
  return parts.join('\n\n')
}

function mergePhase(skeleton: SkeletonPhase, draft: PlanDraft) {
  const draftPhase = draft.phases.find((p) => p.id === skeleton.id)
  if (!draftPhase) throw new ProviderError(`Plan draft missing phase ${skeleton.id}`, 502)
  return {
    id: skeleton.id,
    title: draftPhase.title,
    questions: skeleton.questions,
    objective: draftPhase.objective,
    targeting: draftPhase.targeting,
    examples: draftPhase.examples,
  }
}

export interface GeneratePlanInput {
  readonly provider: Provider
  readonly model: string
  readonly dossier: Dossier
  readonly offer: string
  readonly resume: string
  readonly company: string
  readonly analysis: Analysis | null
  readonly personal: PersonalData
  readonly signal: AbortSignal
}

export async function generatePlan(input: GeneratePlanInput): Promise<Plan> {
  const { provider, model, dossier, offer, resume, company, analysis, personal, signal } = input
  const phases = phaseList(offer)
  const draft = await provider.structured({
    system: systemPrompt(dossier.language),
    prompt: buildPrompt(phases, offer, resume, company, analysis),
    personal,
    schema: PlanDraftSchema,
    model,
    signal,
  })
  return PlanSchema.parse({
    persona: draft.persona,
    phases: phases.map((phase) => mergePhase(phase, draft)),
  })
}
