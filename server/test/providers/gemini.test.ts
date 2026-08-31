import { describe, expect, it } from 'vitest'
import { extractGrounding } from '../../src/providers/gemini.js'

describe('gemini extractGrounding', () => {
  it('collects deduplicated web uris from grounding chunks', () => {
    const metadata = {
      groundingChunks: [
        { web: { uri: 'https://c.example', title: 'C' } },
        { web: {} },
      ],
    }
    expect(extractGrounding(metadata)).toEqual(['https://c.example'])
  })

  it('returns an empty array for undefined metadata', () => {
    expect(extractGrounding(undefined)).toEqual([])
  })
})
