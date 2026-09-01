import { describe, expect, it } from 'vitest'
import { extractSearch } from '../../src/providers/anthropic.js'

describe('anthropic extractSearch', () => {
  it('joins text blocks and collects web result urls', () => {
    const content = [
      { type: 'web_search_tool_result', tool_use_id: 't', content: [
        { type: 'web_search_result', url: 'https://a.example', title: 'A', encrypted_content: '', page_age: null },
      ] },
      { type: 'text', text: 'Acme makes ropes.', citations: null },
    ] as unknown as Parameters<typeof extractSearch>[0]
    expect(extractSearch(content)).toEqual({ text: 'Acme makes ropes.', sources: ['https://a.example'] })
  })
})
