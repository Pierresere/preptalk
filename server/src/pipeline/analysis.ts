import type { Analysis, Language } from '../domain/types.js'
import { AnalysisSchema } from '../domain/types.js'
import type { Provider } from '../providers/types.js'
import { ProviderError } from '../providers/types.js'

const MIN_LENGTH = 50

function systemPrompt(language: Language): string {
  return [
    'You compare a job offer against a candidate resume.',
    'Extract every responsibility or requirement from the offer, verbatim, in the order they appear in the offer.',
    'For each requirement, produce: an index (0-based, offer order), the requirement text verbatim, ' +
      'keywords (the 2 to 4 words the offer emphasises for this requirement), a status, and evidence.',
    'Status definitions: "covered" means the resume shows explicit matching experience; ' +
      '"partial" means the resume shows adjacent or unproven experience; ' +
      '"missing" means the resume shows nothing related.',
    `Evidence must be written in ${language} as one sentence. When the status is "covered", quote the resume in the evidence.`,
    `Finally, write a summary of exactly three sentences in ${language} describing the overall match between the offer and the resume.`,
  ].join('\n')
}

function buildPrompt(offer: string, resume: string): string {
  return `<offer>\n${offer}\n</offer>\n<resume>\n${resume}\n</resume>`
}

export interface AnalyzeInput {
  readonly provider: Provider
  readonly model: string
  readonly offer: string
  readonly resume: string
  readonly language: Language
  readonly signal: AbortSignal
}

export async function analyze(input: AnalyzeInput): Promise<Analysis> {
  const { provider, model, offer, resume, language, signal } = input
  if (offer.trim().length < MIN_LENGTH || resume.trim().length < MIN_LENGTH) {
    throw new ProviderError('Offer or resume is empty or too short (min 50 characters)', 400)
  }
  return provider.structured({
    system: systemPrompt(language),
    prompt: buildPrompt(offer, resume),
    schema: AnalysisSchema,
    model,
    signal,
  })
}
