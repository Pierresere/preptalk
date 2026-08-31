import { describe, expect, it } from 'vitest'
import { selectChunks, tokenize, type Chunk } from '../../src/domain/retrieval.js'

const chunks: Chunk[] = [
  { id: 'offer', title: 'Job offer', kind: 'offer', body: 'Plan and lead internal audits. Track corrective actions.' },
  { id: 'company/products', title: 'Products and services', kind: 'company', body: 'Steel wire rope, slings, lifting solutions.' },
  { id: 'resume', title: 'Resume', kind: 'resume', body: 'Quality coordinator, ISO 9001 audits, supplier claims.' },
]

describe('retrieval', () => {
  it('tokenizes with accent folding and stop words removed', () => {
    expect(tokenize('Les élingues et le câble')).toEqual(['elingues', 'cable'])
  })
  it('ranks by title then body and rotates with the query', () => {
    const audit = selectChunks(chunks, 'internal audit corrective')
    expect(audit[0]?.chunk.id).toBe('offer')
    const product = selectChunks(chunks, 'wire rope slings products')
    expect(product[0]?.chunk.id).toBe('company/products')
  })
  it('returns nothing for an empty query', () => {
    expect(selectChunks(chunks, 'le la et')).toEqual([])
  })
})
