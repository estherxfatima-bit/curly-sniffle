// Lightweight markdown-ish renderer for AI responses: turns **bold**, "- " bullets
// and "1. " numbered items into real formatting instead of a literal wall of text.
// The model doesn't always insert real line breaks before list markers, so we force
// one in before rendering — otherwise list items run on mid-sentence (see AI Log).
function renderInline(line) {
  const parts = line.split(/(\*\*[^*]+\*\*)/g).filter(Boolean)
  return parts.map((part, i) =>
    part.startsWith('**') && part.endsWith('**')
      ? <strong key={i}>{part.slice(2, -2)}</strong>
      : <span key={i}>{part}</span>
  )
}

export default function FormattedAiText({ text }) {
  const normalized = text
    .replace(/\s+(?=-\s\*\*)/g, '\n')
    .replace(/\s+(?=\d+\.\s*\*\*)/g, '\n')

  const lines = normalized.split('\n').map(l => l.trim()).filter(Boolean)

  const blocks = []
  let listItems = null
  let listType = null

  function flushList() {
    if (listItems) blocks.push({ type: listType, items: listItems })
    listItems = null
    listType = null
  }

  for (const line of lines) {
    const bulletMatch = line.match(/^-\s+(.*)/)
    const numberedMatch = line.match(/^\d+\.\s+(.*)/)
    if (bulletMatch) {
      if (listType !== 'ul') flushList()
      listType = 'ul'
      listItems = listItems || []
      listItems.push(bulletMatch[1])
    } else if (numberedMatch) {
      if (listType !== 'ol') flushList()
      listType = 'ol'
      listItems = listItems || []
      listItems.push(numberedMatch[1])
    } else {
      flushList()
      blocks.push({ type: 'p', text: line })
    }
  }
  flushList()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {blocks.map((block, i) => {
        if (block.type === 'p') {
          return <p key={i} style={{ margin: 0 }}>{renderInline(block.text)}</p>
        }
        const Tag = block.type
        return (
          <Tag key={i} style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {block.items.map((item, j) => <li key={j}>{renderInline(item)}</li>)}
          </Tag>
        )
      })}
    </div>
  )
}
