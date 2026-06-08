// Claude API calls — each function is isolated so they can be built/tested one at a time

const CLAUDE_API_KEY = import.meta.env.VITE_CLAUDE_API_KEY

async function callClaude(prompt, systemPrompt) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': CLAUDE_API_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-opus-4-8',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  if (!res.ok) throw new Error(`Claude API error: ${res.status}`)
  const data = await res.json()
  return data.content[0].text
}

export async function generateWeeklyReviewSummary({ shipped, didntShip, energyLevel, oneWin, oneToDrop }) {
  const system = `You are a thoughtful personal assistant helping someone reflect on their week.
Be concise, warm, and honest. No toxic positivity. Write like a trusted friend, not a life coach.`

  const prompt = `Weekly review:
- What shipped: ${shipped}
- What didn't ship and why: ${didntShip}
- Energy level (1-5): ${energyLevel}
- One win: ${oneWin}
- One thing to drop: ${oneToDrop}

Write a 2-3 sentence summary of this week that captures the honest reality, names the pattern if there is one, and offers one grounded observation for next week. No bullet points.`

  return callClaude(prompt, system)
}

export async function analyseInspiration(inspirationItems) {
  const system = `You are a creative strategist and content director. Your job is to analyse someone's saved inspiration and extract signal from it — what they're actually drawn to, what it reveals about their creative direction, and what content ideas it suggests.

The user's content pillars are:
1. Work & Becoming — portfolio careers, freelance, self-direction, building before it pays off
2. Taste & Expression — fashion as self-direction, aesthetic, GRWM, beauty as creative act
3. Life Design — systems, money, 5-9s, designing a life that fits you
4. Creative Direct Your Life — the meta-pillar: being the creative director of your own life

Her tone is: cool, considered, non-performative. She documents the actual journey, not an aspirational version. She doesn't hype, she observes. She's building in public but with taste.

Respond in valid JSON only.`

  const prompt = `Here is my saved inspiration content:

${inspirationItems.map((item, i) => `${i + 1}. Platform: ${item.platform}, URL: ${item.url}, Notes: ${item.notes || 'none'}, Tags: ${item.tags?.join(', ') || 'none'}`).join('\n')}

Analyse this and return a JSON object with:
{
  "dominantThemes": ["theme1", "theme2", ...],  // 3-5 themes you see recurring
  "toneAndSentiment": "2-3 sentences on the emotional register and aesthetic sensibility of what she saves",
  "contentGaps": "2-3 sentences on what she saves vs what she likely posts — where the gap is",
  "contentIdeas": [
    {
      "title": "specific idea title",
      "pillar": "one of the four pillars",
      "format": "Talking head | Video anchor | Carousel | Simple text over clip",
      "hook": "specific opening line or visual hook",
      "rationale": "1 sentence on why this idea fits her tone and saved content"
    }
  ]  // exactly 5 ideas
}`

  const text = await callClaude(prompt, system)
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('No JSON in Claude response')
  return JSON.parse(jsonMatch[0])
}

export async function smartBatchIdeas(ideas) {
  const system = `You are a production coordinator helping a content creator batch their filming days efficiently.
Your goal is to group ideas by filming setup so she can shoot multiple pieces in one session.
Respond in valid JSON only.`

  const prompt = `Here are my content ideas to batch into filming days:

${ideas.map((idea, i) => `${i + 1}. Title: "${idea.title}", Format: ${idea.format}, Pillar: ${idea.pillar}, Status: ${idea.status}`).join('\n')}

Group these into 2-4 filming day clusters. Consider:
- Talking head videos can all film in one setup (same background, same look)
- Video anchors need specific setups — group by location/vibe
- Simple text over clip = B-roll or archive, can batch by theme
- Carousels = no filming needed, separate from video work

Return JSON:
{
  "clusters": [
    {
      "name": "short name for this filming day",
      "rationale": "1 sentence on why these are grouped — what they share",
      "ideas": [1, 2, 3],  // 1-based indices from the list above
      "estimatedTime": "e.g. 2 hours"
    }
  ]
}`

  const text = await callClaude(prompt, system)
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('No JSON in Claude response')
  return JSON.parse(jsonMatch[0])
}

export async function extractEventFromImage(base64Image, mimeType = 'image/jpeg') {
  const system = `You extract event details from screenshots or images of invites, posts, or announcements. Be precise. If a field is unclear, return null for it. Respond in valid JSON only.`

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': CLAUDE_API_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-opus-4-8',
      max_tokens: 512,
      system,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mimeType, data: base64Image },
            },
            {
              type: 'text',
              text: 'Extract the event details from this image. Return JSON: { "summary": "event name", "date": "YYYY-MM-DD or null", "startTime": "HH:MM or null", "endTime": "HH:MM or null", "location": "location string or null", "notes": "any other relevant info or null" }',
            },
          ],
        },
      ],
    }),
  })
  if (!res.ok) throw new Error(`Claude API error: ${res.status}`)
  const data = await res.json()
  const text = data.content[0].text
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('No JSON in Claude response')
  return JSON.parse(jsonMatch[0])
}
