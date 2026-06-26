// Approximate per-token pricing for the Claude models used in this app.
// Prices are USD per token, derived from Anthropic's published per-million-token rates.
const PRICING = {
  'claude-opus-4-8': { input: 15 / 1_000_000, output: 75 / 1_000_000 },
}

const DEFAULT_PRICING = PRICING['claude-opus-4-8']

export function estimateCost(model, inputTokens, outputTokens) {
  if (!inputTokens && !outputTokens) return null
  const rates = PRICING[model] || DEFAULT_PRICING
  return (inputTokens || 0) * rates.input + (outputTokens || 0) * rates.output
}
