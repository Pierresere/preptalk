import { describe, expect, it } from 'vitest'
import { createApp } from '../src/app.js'
import { readConfig } from '../src/config.js'

describe('app', () => {
  it('answers health', async () => {
    const app = createApp({ config: readConfig({ DATA_DIR: 'tmp' }), providers: new Map() })
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
