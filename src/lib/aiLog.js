// All AI calls must save to ai_log BEFORE returning, never display without saving.
// Requests go through /api/claude (server-side proxy) so the Claude API
// key never reaches the browser bundle.
import { supabase } from './supabase'
import { estimateCost } from './aiPricing'

const MODEL = 'claude-opus-4-8'

async function callClaude(prompt, systemPrompt, maxTokens = 1024) {
  return callClaudeMessages([{ role: 'user', content: prompt }], systemPrompt, maxTokens)
}

async function callClaudeMessages(messages, systemPrompt, maxTokens = 1024) {
  const { data: { session } } = await supabase.auth.getSession()
  const res = await fetch('/api/claude', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session?.access_token || ''}`,
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages,
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `Claude API error: ${res.status}`)
  }
  const data = await res.json()
  return { text: data.content[0].text, usage: data.usage || {} }
}

// Save to ai_log and return the saved record
export async function saveAndReturn(userId, type, title, response, usage = {}) {
  const { data } = await supabase
    .from('ai_log')
    .insert({
      user_id: userId,
      type,
      title,
      response,
      input_tokens: usage.inputTokens ?? null,
      output_tokens: usage.outputTokens ?? null,
      estimated_cost: usage.estimatedCost ?? null,
    })
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

  const { text: response, usage } = await callClaude(prompt, system, 512)
  const title = `Weekly review — ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`
  await saveAndReturn(userId, 'weekly_plan', title, response, {
    inputTokens: usage.input_tokens,
    outputTokens: usage.output_tokens,
    estimatedCost: estimateCost(MODEL, usage.input_tokens, usage.output_tokens),
  })
  return response
}

// Base persona system prompt — applied to every AI call
export const BASE_SYSTEM_PROMPT = `You are a personal planning assistant for her. Be direct, specific, and grounded. Reference her actual goals and tasks. Never give generic productivity advice. Her tone is considered and non-performative — match it.`

// Full chat system prompt — see "LIFE OS -- AI CHAT FULL UPGRADE" spec
const CHAT_SYSTEM_PROMPT = `You are a personal planning assistant. Your job is not to affirm -- surface what the user is avoiding, ask one hard question, and help them prioritise. Challenge gently. Never be generic. Reference their actual data when provided.

You can suggest two kinds of tasks: "weekly" tasks (broader, go in the weekly plan) and "daily" to-dos (specific, actionable, belong on a single day — usually today or tomorrow). Actively consider suggesting daily to-dos, not just weekly tasks — if the user is asking what to do today, how to get unstuck right now, or for something concrete and immediate, suggest "daily" tasks with a due_date (default to today's date unless the context implies otherwise). Use "weekly" only for broader, less time-bound priorities. When suggesting weekly priorities or daily to-dos, always end your response with a JSON block in this exact format and no other JSON anywhere in the response:

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
export async function generatePlan(userId, { goals, tasks, habits, moodAvg, todayTodos, question, personalContext, quarterlyWins, recentReflections, history, aiMemory }) {
  let system = CHAT_SYSTEM_PROMPT

  if (personalContext) {
    system += `\n\nABOUT THIS USER:\n${personalContext}`
  }

  // Cap task data to last 2 weeks to control cost
  const recentTasks = tasks.slice(0, 30)
  const carriedCount = tasks.filter(t => t.carried_forward).length

  system += `\n\nCURRENT CONTEXT:

TODAY'S DATE: ${new Date().toISOString().slice(0, 10)}

THIS QUARTER'S GOALS:
${goals.map(g => `- [${g.category}] ${g.primary_goal} — ${g.status}`).join('\n') || 'None set'}

THIS WEEK'S TASKS (${tasks.filter(t => !t.complete).length} incomplete, ${tasks.filter(t => t.complete).length} done${carriedCount > 0 ? `, ${carriedCount} carried forward` : ''}):
${recentTasks.map(t => `- [${t.area}] ${t.specific_task} — ${t.complete ? '✓ done' : 'incomplete'}${t.carried_forward ? ' (carried forward)' : ''}${t.notes ? ` [note: ${t.notes}]` : ''}`).join('\n') || 'None'}

HABIT STREAKS:
${habits.map(h => `- ${h.name}: ${h.streak} day${h.streak === 1 ? '' : 's'}`).join('\n') || 'None'}

MOOD AVERAGE THIS WEEK: ${moodAvg ? `${moodAvg.toFixed(1)}/5` : 'Not logged'}

TODAY'S TO-DOS (${todayTodos.filter(t => !t.complete).length} remaining):
${todayTodos.slice(0, 8).map(t => `- ${t.text} [${t.category}]${t.complete ? ' ✓' : ''}`).join('\n') || 'None'}

QUARTERLY WINS LOGGED THIS QUARTER:
${(quarterlyWins || []).map(w => `- ${w}`).join('\n') || 'None'}

RECENT DAILY REFLECTIONS (last 7 days):
${(recentReflections || []).length > 0 ? (recentReflections || []).map(r => `- ${r.date}: ${r.content?.slice(0, 120) || ''}${(r.content?.length || 0) > 120 ? '…' : ''}`).join('\n') : 'None logged'}

PAST AI CONVERSATIONS (memory — pinned entries marked ★):
${(aiMemory || []).length > 0
  ? (aiMemory || []).map(e => {
      const date = e.created_at.slice(0, 10)
      const pin = e.pinned ? '★ ' : ''
      const snippet = e.response.replace(/```[\s\S]*?```/g, '').replace(/\n+/g, ' ').trim().slice(0, 200)
      return `- ${pin}[${date}] ${e.title}: ${snippet}${e.response.length > 200 ? '…' : ''}`
    }).join('\n')
  : 'None yet'}`

  // Build messages array — include prior conversation turns for follow-up
  const priorMessages = (history || []).map(m => ({
    role: m.role,
    content: m.text,
  }))
  const allMessages = [...priorMessages, { role: 'user', content: question }]

  const { text: response, usage } = await callClaudeMessages(allMessages, system, 2800)
  const title = `AI plan — ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}: ${question.slice(0, 40)}`
  const record = await saveAndReturn(userId, 'weekly_plan', title, response, {
    inputTokens: usage.input_tokens,
    outputTokens: usage.output_tokens,
    estimatedCost: estimateCost(MODEL, usage.input_tokens, usage.output_tokens),
  })
  return { response, record }
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

  const { text: response, usage } = await callClaude(prompt, system, 400)
  const title = `Finance summary — ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`
  await saveAndReturn(userId, 'finance_summary', title, response, {
    inputTokens: usage.input_tokens,
    outputTokens: usage.output_tokens,
    estimatedCost: estimateCost(MODEL, usage.input_tokens, usage.output_tokens),
  })
  return response
}

// How much can reasonably go toward debt this month — saves to ai_log
export async function generateDebtAllocationRecommendation(userId, { debts, takeHome, totalIncome, totalFixed, totalVariable, recentMonths }) {
  const system = `You are a direct financial advisor. Recommend a specific, reasonable amount the user could put toward debt this month, given their actual disposable income and debts. Prioritise higher-interest debts. Be concrete — give a number and a short reason. Do not recommend an amount that would leave them with no buffer. Max 3 sentences.`

  const debtLines = debts.map(d => `  - ${d.name}: £${d.current_balance.toFixed(0)} balance, ${d.interest_rate ?? '?'}% interest, min payment £${d.minimum_payment ?? '?'}`).join('\n')
  const monthLines = (recentMonths || []).map(m => `  - ${m.label}: spent £${m.total.toFixed(0)}`).join('\n')

  const prompt = `This month's finances:
INCOME: £${totalIncome.toFixed(0)}/mo
FIXED EXPENSES: £${totalFixed.toFixed(0)}/mo
VARIABLE SPEND so far this month: £${totalVariable.toFixed(0)}
TAKE-HOME / DISPOSABLE after fixed costs and savings: £${takeHome.toFixed(0)}

DEBTS:
${debtLines || '  None'}

RECENT MONTHS' VARIABLE SPEND (for context on how reliable this month's disposable income is):
${monthLines || '  No history yet'}

How much can they reasonably allocate to debt this month, and toward which debt(s) first?`

  const { text: response, usage } = await callClaude(prompt, system, 400)
  const title = `Debt allocation recommendation — ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`
  await saveAndReturn(userId, 'debt_recommendation', title, response, {
    inputTokens: usage.input_tokens,
    outputTokens: usage.output_tokens,
    estimatedCost: estimateCost(MODEL, usage.input_tokens, usage.output_tokens),
  })
  return response
}

