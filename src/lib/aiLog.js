// All AI calls must save to ai_log BEFORE returning, never display without saving.
import { supabase } from './supabase'

const CLAUDE_API_KEY = import.meta.env.VITE_CLAUDE_API_KEY

async function callClaude(prompt, systemPrompt, maxTokens = 1024) {
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
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  if (!res.ok) throw new Error(`Claude API error: ${res.status}`)
  const data = await res.json()
  return data.content[0].text
}

// Save to ai_log and return the saved record
export async function saveAndReturn(userId, type, title, response) {
  const { data } = await supabase
    .from('ai_log')
    .insert({ user_id: userId, type, title, response })
    .select()
    .single()
  return data
}

// Weekly review summary — saves to ai_log automatically
export async function generateWeeklyReviewSummary(userId, { shipped, didntShip, energyLevel, oneWin, oneToDrop }) {
  const system = `You are a thoughtful personal assistant helping someone reflect on their week. Be direct, specific, and honest. No toxic positivity. No motivational poster energy. Write like a trusted friend who gives real observations, not a life coach.`

  const prompt = `Weekly review:
- What shipped: ${shipped}
- What didn't ship and why: ${didntShip}
- Energy level (1-5): ${energyLevel}
- One win: ${oneWin}
- One thing to drop: ${oneToDrop}

Write 2-3 sentences. Capture the honest reality, name the pattern if there is one, offer one grounded observation for next week. No bullet points.`

  const response = await callClaude(prompt, system, 512)
  const title = `Weekly review — ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`
  await saveAndReturn(userId, 'weekly_plan', title, response)
  return response
}

// Base persona system prompt — applied to every AI call
export const BASE_SYSTEM_PROMPT = `You are a personal planning assistant for her. Be direct, specific, and grounded. Reference her actual goals and tasks. Never give generic productivity advice. Her tone is considered and non-performative — match it.`

// Full chat system prompt — see "LIFE OS -- AI CHAT FULL UPGRADE" spec
const CHAT_SYSTEM_PROMPT = `You are a personal planning assistant. Your job is not to affirm -- surface what the user is avoiding, ask one hard question, and help them prioritise. Challenge gently. Never be generic. Reference their actual data when provided. When suggesting weekly priorities or daily to-dos, always end your response with a JSON block in this exact format and no other JSON anywhere in the response:

\`\`\`json
{
  "suggested_tasks": [
    {
      "type": "weekly",
      "area": "Career",
      "action": "string",
      "frequency": "Once",
      "specific_task": "string",
      "priority_level": "urgent | high | medium | low | null"
    },
    {
      "type": "daily",
      "title": "string",
      "due_date": "YYYY-MM-DD",
      "priority_level": "urgent | high | medium | low | null"
    }
  ]
}
\`\`\`

For each suggested task, set "priority_level" based on the goal's urgency, deadlines and momentum — "urgent" for time-critical items, "high" for important-but-not-urgent, "medium"/"low" for nice-to-haves, or null if no priority is warranted.

Only include this block when you are actually suggesting tasks. Omit it entirely for conversational responses.`

// AI planning with full user context — saves to ai_log
export async function generatePlan(userId, { goals, tasks, habits, moodAvg, todayTodos, question, personalContext, quarterlyWins }) {
  let system = CHAT_SYSTEM_PROMPT

  if (personalContext) {
    system += `\n\nABOUT THIS USER:\n${personalContext}`
  }

  // Cap task data to last 2 weeks to control cost
  const recentTasks = tasks.slice(0, 30)

  system += `\n\nCURRENT CONTEXT:

THIS QUARTER'S GOALS:
${goals.map(g => `- [${g.category}] ${g.primary_goal} — ${g.status}`).join('\n') || 'None set'}

THIS WEEK'S TASKS (${tasks.filter(t => !t.complete).length} incomplete, ${tasks.filter(t => t.complete).length} done):
${recentTasks.map(t => `- [${t.area}] ${t.specific_task} — ${t.complete ? '✓ done' : 'incomplete'}${t.carried_forward ? ' (carried)' : ''}`).join('\n') || 'None'}

HABIT STREAKS:
${habits.map(h => `- ${h.name}: ${h.streak} day${h.streak === 1 ? '' : 's'}`).join('\n') || 'None'}

MOOD AVERAGE THIS WEEK: ${moodAvg ? `${moodAvg.toFixed(1)}/5` : 'Not logged'}

TODAY'S TO-DOS (${todayTodos.filter(t => !t.complete).length} remaining):
${todayTodos.slice(0, 8).map(t => `- ${t.text} [${t.category}]${t.complete ? ' ✓' : ''}`).join('\n') || 'None'}

QUARTERLY WINS LOGGED THIS QUARTER:
${(quarterlyWins || []).map(w => `- ${w}`).join('\n') || 'None'}`

  const prompt = question

  const response = await callClaude(prompt, system, 800)
  const title = `AI plan — ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}: ${question.slice(0, 40)}`
  const record = await saveAndReturn(userId, 'weekly_plan', title, response)
  return { response, record }
}

// Re-export existing functions to route through ai_log
export async function analyseInspiration(userId, inspirationItems) {
  const system = `You are a creative strategist and content director. Analyse saved inspiration and extract signal — what they're actually drawn to, what it reveals about their creative direction, and what content ideas it suggests.

The user's content pillars:
1. Work & Becoming — portfolio careers, freelance, self-direction, building before it pays off
2. Taste & Expression — fashion as self-direction, aesthetic, GRWM, beauty as creative act
3. Life Design — systems, money, 5-9s, designing a life that fits you
4. Creative Direct Your Life — the meta-pillar: being the creative director of your own life

Her tone: cool, considered, non-performative. She documents the actual journey, not an aspirational version. She doesn't hype, she observes.

Respond in valid JSON only.`

  const prompt = `Here is my saved inspiration content:
${inspirationItems.map((item, i) => `${i+1}. Platform: ${item.platform}, URL: ${item.url}, Notes: ${item.notes || 'none'}, Tags: ${item.tags?.join(', ') || 'none'}`).join('\n')}

Return JSON:
{
  "dominantThemes": ["theme1", "theme2"],
  "toneAndSentiment": "2-3 sentences",
  "contentGaps": "2-3 sentences",
  "contentIdeas": [
    { "title": "...", "pillar": "...", "format": "...", "hook": "...", "rationale": "..." }
  ]
}`

  const text = await callClaude(prompt, system, 1200)
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('No JSON in Claude response')
  const result = JSON.parse(jsonMatch[0])

  const title = `Content analysis — ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`
  await saveAndReturn(userId, 'content_analysis', title, text)
  return result
}

export async function generateFinanceSummary(userId, { income, fixed, variable, totalIncome, totalFixed, totalVariable, taxPot, takeHome }) {
  const system = `You are a direct financial advisor. Analyse the user's income and expenses plainly. No cheerleading, no generic advice. Look at the actual numbers and give a specific observation about their financial health, what stands out, and one concrete thing to address. Max 3 sentences.`

  const incomeLines = income.map(i => `  - ${i.name}: £${i.amount} ${i.frequency}${i.is_self_employed ? ' (self-employed)' : ''}`).join('\n')
  const fixedLines  = fixed.map(i => `  - ${i.name}: £${i.amount}/mo [${i.category}]`).join('\n')
  const varLines    = variable.slice(0, 15).map(i => `  - ${i.name}: £${i.amount} [${i.category}] ${i.date}`).join('\n')

  const prompt = `Monthly financial snapshot:

INCOME (total £${totalIncome.toFixed(0)}/mo):
${incomeLines || '  None'}

FIXED EXPENSES (£${totalFixed.toFixed(0)}/mo):
${fixedLines || '  None'}

VARIABLE EXPENSES this month (£${totalVariable.toFixed(0)}):
${varLines || '  None'}

TAX POT SET ASIDE: £${taxPot.toFixed(0)}/mo
NET TAKE-HOME AFTER ALL: £${takeHome.toFixed(0)}/mo

Give a direct financial observation in 2-3 sentences.`

  const response = await callClaude(prompt, system, 400)
  const title = `Finance summary — ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`
  await saveAndReturn(userId, 'finance_summary', title, response)
  return response
}

export async function smartBatchIdeas(userId, ideas) {
  const system = `You are a production coordinator helping a content creator batch filming days efficiently. Group ideas by filming setup. Respond in valid JSON only.`

  const prompt = `Here are my content ideas to batch:
${ideas.map((idea, i) => `${i+1}. "${idea.title}", Format: ${idea.format}, Pillar: ${idea.pillar}, Status: ${idea.status}`).join('\n')}

Group into 2-4 filming day clusters. Consider: talking head = same setup batch, video anchors by location/vibe, text over clip = B-roll/archive batch, carousels = no filming.

Return JSON:
{
  "clusters": [
    { "name": "...", "rationale": "1 sentence", "ideas": [1, 2, 3], "estimatedTime": "..." }
  ]
}`

  const text = await callClaude(prompt, system, 800)
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('No JSON in Claude response')
  const result = JSON.parse(jsonMatch[0])

  const title = `Smart batch — ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`
  await saveAndReturn(userId, 'smart_batch', title, text)
  return result
}
