// Open Library search — no API key required
export async function searchBooks(query) {
  const q = query.trim()
  if (!q) return []
  const res = await fetch(`https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=12&fields=key,title,author_name,cover_i`)
  if (!res.ok) return []
  const data = await res.json()
  return (data.docs || []).map(d => ({
    ol_key: d.key,
    title: d.title,
    author: d.author_name?.[0] || 'Unknown author',
    cover_url: d.cover_i ? `https://covers.openlibrary.org/b/id/${d.cover_i}-M.jpg` : null,
  }))
}
