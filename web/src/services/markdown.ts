function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function renderInline(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/(https?:\/\/[^\s<>"']+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>')
}

type Block = { kind: 'html'; content: string } | { kind: 'li'; content: string } | { kind: 'quote'; content: string }

function renderLine(rawLine: string): Block | null {
  const line = rawLine.trim()
  if (line.length === 0) return null

  const escaped = escapeHtml(line)

  if (escaped.startsWith('### ')) return { kind: 'html', content: `<h4>${renderInline(escaped.slice(4))}</h4>` }
  if (escaped.startsWith('## ')) return { kind: 'html', content: `<h3>${renderInline(escaped.slice(3))}</h3>` }
  if (escaped.startsWith('# ')) return { kind: 'html', content: `<h3>${renderInline(escaped.slice(2))}</h3>` }
  if (escaped.startsWith('- ') || escaped.startsWith('* ')) {
    return { kind: 'li', content: `<li>${renderInline(escaped.slice(2))}</li>` }
  }
  if (escaped.startsWith('&gt; ')) return { kind: 'quote', content: renderInline(escaped.slice(5)) }
  if (escaped === '&gt;') return { kind: 'quote', content: '' }

  return { kind: 'html', content: `<p>${renderInline(escaped)}</p>` }
}

export function toHtml(text: string): string {
  const blocks = text.split('\n').map(renderLine).filter((b): b is Block => b !== null)

  const html: string[] = []
  let i = 0
  while (i < blocks.length) {
    const block = blocks[i] as Block
    if (block.kind === 'li') {
      const items: string[] = []
      let next = blocks[i]
      while (next !== undefined && next.kind === 'li') {
        items.push(next.content)
        i += 1
        next = blocks[i]
      }
      html.push(`<ul>${items.join('')}</ul>`)
      continue
    }
    if (block.kind === 'quote') {
      const lines: string[] = []
      let next = blocks[i]
      while (next !== undefined && next.kind === 'quote') {
        lines.push(next.content)
        i += 1
        next = blocks[i]
      }
      html.push(`<blockquote>${lines.join('<br/>')}</blockquote>`)
      continue
    }
    html.push(block.content)
    i += 1
  }

  return html.join('')
}

export function toChatHtml(text: string): string {
  return toHtml(text).replace(/<blockquote>/g, '<blockquote class="coaching">')
}
