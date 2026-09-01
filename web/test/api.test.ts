import { describe, it, expect, afterEach, vi } from 'vitest'
import { ApiError, createDossier, listDossiers } from '../src/services/api.js'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('api client', () => {
  it('posts JSON and returns the parsed body on success', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: 'd1' }), { status: 201 }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await createDossier({
      company: 'Acme',
      position: 'Engineer',
      sites: [],
      language: 'en',
      provider: 'openai',
      model: 'gpt',
    })

    expect(result).toEqual({ id: 'd1' })
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/dossiers',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
      })
    )
  })

  it('throws ApiError with status and message from body.error on failure', async () => {
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify({ error: 'bad' }), { status: 400 })
    )
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      createDossier({
        company: 'Acme',
        position: 'Engineer',
        sites: [],
        language: 'en',
        provider: 'openai',
        model: 'gpt',
      })
    ).rejects.toMatchObject({ status: 400, message: 'bad' })
  })

  it('stringifies an object error body', async () => {
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify({ error: { issue: 'nope' } }), { status: 422 })
    )
    vi.stubGlobal('fetch', fetchMock)

    try {
      await listDossiers()
      expect.unreachable()
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError)
      const apiError = error as ApiError
      expect(apiError.status).toBe(422)
      expect(apiError.message).toContain('issue')
    }
  })

  it('returns undefined for 204 responses', async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)
    const result = await listDossiers()
    expect(result).toBeUndefined()
  })
})
