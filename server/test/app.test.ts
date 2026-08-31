import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { createApp } from '../src/app.js'
import { readConfig } from '../src/config.js'
import { DossierStore } from '../src/storage/dossiers.js'
import { SessionStore } from '../src/storage/sessions.js'

describe('app', () => {
  it('answers health', async () => {
    const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'preptalk-app-'))
    const app = createApp({
      config: readConfig({ DATA_DIR: dataDir }),
      providers: new Map(),
      dossiers: new DossierStore(dataDir),
      sessions: new SessionStore(dataDir),
    })
    const res = await app.request('/api/health')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
  })

  it('reads config with defaults', () => {
    const config = readConfig({})
    expect(config.port).toBe(4820)
    expect(config.dataDir.endsWith('data')).toBe(true)
    expect(config.keys).toEqual({})
  })
})
