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

const TONE_GUIDANCE = `Her tone is: cool, considered, non-performative. She documents the actual journey, not an aspirational version. She doesn't hype, she observes. She's building in public but with taste.`

function describePillar(pillarDefs, name) {
  const def = pillarDefs.find(p => p.name === name)
  return def ? `${name} — ${def.description}` : name
}

// Free-text prompt + optional pillar -> 3-5 new content ideas, grounded in the user's
// pillars, tone, and (if available) what's actually performing well so far.
export async function generateContentIdeas(userPrompt, pillar, pillarDefs, performanceSummary) {
  const system = `You are a creative strategist and content director helping someone turn a rough idea into specific, postable content.

Her content pillars:
${pillarDefs.map(p => `- ${p.name} — ${p.description}`).join('\n')}

${TONE_GUIDANCE}

${performanceSummary ? `What's worked so far:\n${performanceSummary}\n` : ''}
Respond in valid JSON only.`

  const prompt = `Topic/prompt: ${userPrompt}
${pillar ? `Pillar to focus on: ${describePillar(pillarDefs, pillar)}` : 'No specific pillar chosen — suggest whichever pillar(s) fit best.'}

Return JSON:
{
  "ideas": [
    { "title": "...", "pillar": "one of her pillars", "format": "Talking head | Video anchor | Carousel | Simple text over clip", "hook": "specific opening line or visual hook" }
  ]
}
Return 3-5 ideas.`

  const text = await callClaude(prompt, system)
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('No JSON in Claude response')
  return JSON.parse(jsonMatch[0]).ideas || []
}

// Takes a single saved idea and sharpens it into something filmable: a better hook,
// a caption angle, repurposing suggestions, and format-specific structure beats.
export async function fleshOutIdea(idea, pillarDefs) {
  const system = `You are a creative strategist helping flesh out a single content idea into something ready to film.

${TONE_GUIDANCE}

Respond in valid JSON only.`

  const prompt = `Idea: "${idea.title}"
Pillar: ${idea.pillar ? describePillar(pillarDefs, idea.pillar) : 'not set'}
Format: ${idea.format || 'not set'}
Existing notes: ${idea.notes || 'none'}
Reference URL: ${idea.reference_url || 'none'}

Return JSON:
{
  "sharperHook": "a stronger opening line/visual hook",
  "captionAngle": "1-2 sentences on the caption's angle/POV",
  "repurposing": ["1-3 ways this could be repurposed across formats"],
  "structureBeats": ["3-6 short beats, in order, for actually filming/editing this in this format"]
}`

  const text = await callClaude(prompt, system)
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('No JSON in Claude response')
  return JSON.parse(jsonMatch[0])
}

// Looks across posted ideas with metrics and surfaces what's actually working.
export async function analysePerformance(postedIdeas) {
  const system = `You are a data-literate content strategist. Look at what actually performed, not what should theoretically perform. Be specific and concrete — no generic social media advice.

Respond in valid JSON only.`

  const lines = postedIdeas.map((i, idx) =>
    `${idx + 1}. "${i.title}" — pillar: ${i.pillar || 'none'}, format: ${i.format || 'none'}, hook: "${i.hook || 'none'}" — views: ${i.views ?? '?'}, likes: ${i.likes ?? '?'}, comments: ${i.comments ?? '?'}, saves: ${i.saves ?? '?'}, shares: ${i.shares ?? '?'}`
  ).join('\n')

  const prompt = `Posted content with metrics:
${lines}

Return JSON:
{
  "bestPillar": "the pillar with the strongest engagement, with 1 sentence why",
  "bestFormat": "the format with the strongest engagement, with 1 sentence why",
  "patterns": "2-3 sentences on hook/topic patterns that correlate with higher engagement",
  "recommendation": "1 specific, concrete thing to do differently next batch"
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
