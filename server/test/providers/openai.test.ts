import { describe, expect, it } from 'vitest'
import { extractCitations } from '../../src/providers/openai.js'

describe('openai extractCitations', () => {
  it('collects deduplicated url citations from message output items', () => {
    const output = [
      {
        type: 'message',
        content: [
          {
            type: 'output_text',
            text: 'x',
            annotations: [
              { type: 'url_citation', url: 'https://b.example', title: 'B', start_index: 0, end_index: 1 },
              { type: 'url_citation', url: 'https://b.example', title: 'B', start_index: 2, end_index: 3 },
            ],
          },
        ],
      },
    ] as unknown as Parameters<typeof extractCitations>[0]
    expect(extractCitations(output)).toEqual(['https://b.example'])
  })
})
