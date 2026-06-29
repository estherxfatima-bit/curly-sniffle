// Safari/WebKit raises a bare "TypeError: Load failed" for any failed fetch
// (timeout, dropped connection, flaky mobile signal) — not a real server error.
// Retry once after a short delay before giving up, and surface a clearer message.
const TRANSIENT_PATTERN = /load failed|network|fetch/i

export async function withNetworkRetry(fn, attempts = 2) {
  let result
  for (let i = 0; i < attempts; i++) {
    result = await fn()
    if (!result.error) return result
    if (i === attempts - 1 || !TRANSIENT_PATTERN.test(String(result.error.message || ''))) return result
    await new Promise(r => setTimeout(r, 700))
  }
  return result
}

export function friendlyErrorMessage(error) {
  return TRANSIENT_PATTERN.test(String(error?.message || ''))
    ? 'Connection issue — check your network and try again.'
    : error?.message
}
