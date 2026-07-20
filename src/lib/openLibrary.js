// Open Library search with Google Books cover fallback
export async function searchBooks(query) {
  const q = query.trim()
  if (!q) return []

  // Fetch Open Library results and Google Books results in parallel
  const [olRes, gbRes] = await Promise.allSettled([
    fetch(`https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=12&fields=key,title,author_name,cover_i,isbn`).then(r => r.ok ? r.json() : { docs: [] }),
    fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=12&fields=items(volumeInfo/title,volumeInfo/authors,volumeInfo/imageLinks,volumeInfo/industryIdentifiers)`).then(r => r.ok ? r.json() : { items: [] }),
  ])

  const olDocs = olRes.status === 'fulfilled' ? (olRes.value.docs || []) : []
  const gbItems = gbRes.status === 'fulfilled' ? (gbRes.value.items || []) : []

  // Build a map of title→cover from Google Books for fallback
  const gbCoverMap = {}
  for (const item of gbItems) {
    const vi = item.volumeInfo || {}
    const title = vi.title?.toLowerCase().trim()
    const cover = vi.imageLinks?.thumbnail || vi.imageLinks?.smallThumbnail
    if (title && cover) gbCoverMap[title] = cover.replace('http://', 'https://')
  }

  return olDocs.map(d => {
    const olCover = d.cover_i ? `https://covers.openlibrary.org/b/id/${d.cover_i}-M.jpg` : null
    const gbCover = gbCoverMap[d.title?.toLowerCase().trim()] || null
    return {
      ol_key: d.key,
      title: d.title,
      author: d.author_name?.[0] || 'Unknown author',
      cover_url: olCover || gbCover,
    }
  })
}
