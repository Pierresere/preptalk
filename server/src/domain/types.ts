import { z } from 'zod'

export const ProviderIdSchema = z.enum(['openai', 'anthropic', 'gemini'])
export type ProviderId = z.infer<typeof ProviderIdSchema>
export const LanguageSchema = z.enum(['fr', 'en'])
export type Language = z.infer<typeof LanguageSchema>

export const DossierSchema = z.object({
  id: z.string().min(1),
  company: z.string().min(1),
  position: z.string().min(1),
  sites: z.array(z.string()),
  language: LanguageSchema,
  provider: ProviderIdSchema,
  model: z.string().min(1),
  createdAt: z.string(),
  updatedAt: z.string(),
})
export type Dossier = z.infer<typeof DossierSchema>

export const ConfirmedNameSchema = z.object({
  value: z.string().min(1),
  kind: z.enum(['candidate', 'person']),
})
export const PrivacySchema = z.object({
  names: z.array(ConfirmedNameSchema),
  reviewedAt: z.string(),
})
export type Privacy = z.infer<typeof PrivacySchema>

export const PersonaSchema = z.object({
  name: z.string(), role: z.string(), concerns: z.string(), tone: z.string(),
})
export type Persona = z.infer<typeof PersonaSchema>

export const PhaseSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  questions: z.number().int().min(1),
  objective: z.string(),
  targeting: z.array(z.string()),
  examples: z.array(z.string()),
})
export type Phase = z.infer<typeof PhaseSchema>

export const PlanSchema = z.object({ persona: PersonaSchema, phases: z.array(PhaseSchema).min(1) })
export type Plan = z.infer<typeof PlanSchema>

export const RequirementSchema = z.object({
  index: z.number().int(),
  text: z.string(),
  keywords: z.array(z.string()),
  status: z.enum(['covered', 'partial', 'missing']),
  evidence: z.string(),
})
export type Requirement = z.infer<typeof RequirementSchema>
export const AnalysisSchema = z.object({ requirements: z.array(RequirementSchema), summary: z.string() })
export type Analysis = z.infer<typeof AnalysisSchema>

export const MessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  text: z.string(),
  sources: z.array(z.string()).optional(),
})
export type Message = z.infer<typeof MessageSchema>

export const SessionSchema = z.object({
  id: z.string(),
  dossierId: z.string(),
  provider: ProviderIdSchema,
  model: z.string(),
  startedAt: z.string(),
  messages: z.array(MessageSchema),
  debrief: z.string().nullable(),
})
export type Session = z.infer<typeof SessionSchema>
