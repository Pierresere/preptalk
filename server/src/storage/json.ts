import fs from 'node:fs/promises'
import { z } from 'zod'
import { CorruptFileError } from './errors.js'

export async function readJsonFile<T>(filePath: string, schema: z.ZodType<T>): Promise<T | null> {
  let raw: string
  try {
    raw = await fs.readFile(filePath, 'utf-8')
  } catch {
    return null
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (cause) {
    throw new CorruptFileError(filePath, cause)
  }
  const result = schema.safeParse(parsed)
  if (!result.success) {
    throw new CorruptFileError(filePath, result.error.issues)
  }
  return result.data
}

export async function writeJsonFile<T>(filePath: string, value: T): Promise<void> {
  await fs.writeFile(filePath, JSON.stringify(value, null, 2), 'utf-8')
}
