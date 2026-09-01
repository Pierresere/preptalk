import path from 'node:path'

export interface Config {
  readonly dataDir: string
  readonly port: number
  readonly keys: { readonly openai?: string; readonly anthropic?: string; readonly gemini?: string }
}

function nonEmpty(value: string | undefined): string | undefined {
  return value !== undefined && value.trim().length > 0 ? value.trim() : undefined
}

export function readConfig(env: NodeJS.ProcessEnv): Config {
  const keys: { openai?: string; anthropic?: string; gemini?: string } = {}
  const openai = nonEmpty(env['OPENAI_API_KEY'])
  const anthropic = nonEmpty(env['ANTHROPIC_API_KEY'])
  const gemini = nonEmpty(env['GEMINI_API_KEY'])
  if (openai !== undefined) keys.openai = openai
  if (anthropic !== undefined) keys.anthropic = anthropic
  if (gemini !== undefined) keys.gemini = gemini
  const port = Number(nonEmpty(env['PORT']) ?? '4820')
  return {
    dataDir: path.resolve(nonEmpty(env['DATA_DIR']) ?? path.join(process.cwd(), '..', 'data')),
    port: Number.isFinite(port) ? port : 4820,
    keys,
  }
}
