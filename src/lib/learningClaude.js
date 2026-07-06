import { supabase } from './supabase'

const MODEL = 'claude-opus-4-8'

async function proxy(body) {
  const { data: { session } } = await supabase.auth.getSession()
  const res = await fetch('/api/claude', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session?.access_token || ''}`,
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `Claude error ${res.status}`)
  }
  return res.json()
}

// Low-level call: returns plain text. skip_user_context=false so api.claude.js injects profile.
export async function callClaudeRaw(prompt, system, maxTokens = 1024, skipContext = false) {
  const data = await proxy({
    model: MODEL,
    max_tokens: maxTokens,
    system,
    messages: [{ role: 'user', content: prompt }],
    skip_user_context: skipContext,
  })
  return data.content[0].text
}

async function logAI(userId, type, title, inputTokens, outputTokens) {
  try {
    await supabase.from('ai_log').insert({
      user_id: userId, type, title,
      input_tokens: inputTokens, output_tokens: outputTokens,
    })
  } catch (_) { /* non-fatal */ }
}

// Generate curriculum for a learning track
export async function generateCurriculum({ track, resources, userId }) {
  const system = `You are a learning curriculum designer. Based on the user's background above, do not suggest beginner fundamentals they are likely to already know. Pitch all resources and curriculum steps at the appropriate level for their experience.`

  const resourceList = resources.length
    ? resources.map(r => `- ${r.title} (${r.type}, ${r.platform || 'no platform'})`).join('\n')
    : 'None yet'

  const freeformFormat = `Numbered steps in logical order. Use exactly this format for each step:

[n]. [Title]
Estimated hours: [X]
What to do: [specific action 1] | [specific action 2] | [specific action 3 — e.g. "Complete this exercise: take a creative brief and rewrite the positioning line using the framework you just learned"]
What you'll be able to do after: [one sentence outcome — e.g. "You'll be able to write a strategic brief that holds up under client questioning"]`

  const structuredFormat = `Modules with nested lessons. Use exactly this format:

Module: [Title] — [one-line description of what this module covers]
  Lesson: [Title]
  Estimated hours: [X]
  What to do: [specific action 1] | [specific action 2] | [specific action 3]
  What you'll be able to do after: [one sentence outcome]`

  const prompt = `Learning track: ${track.name}
Category: ${track.category}
Why they want to learn this: ${track.why_text || 'Not specified'}
Curriculum mode: ${track.curriculum_mode}
Resources already added:
${resourceList}

Return your response in exactly this format:

APPROACH NOTE:
[One paragraph on the best way to approach learning this given their background.]

CURRICULUM:
${track.curriculum_mode === 'structured' ? structuredFormat : freeformFormat}

RESOURCES:
3-5 specific resources. Use exactly this format for each:

Title: [title]
Type: [Course/Book/Article/Video/Podcast/Tool/Other]
Platform: [platform name]
URL: [full URL — find the real one if you know it; only use "—" if genuinely unknown]
Use for: [one specific sentence on exactly what to use this resource for — e.g. "Use for the strategic frameworks in module 2; skip the intro chapters if you already know positioning basics"]`

  const data = await proxy({
    model: MODEL,
    max_tokens: 2500,
    system,
    messages: [{ role: 'user', content: prompt }],
  })
  const text = data.content[0].text
  const usage = data.usage || {}
  await logAI(userId, 'learning_curriculum', `Curriculum: ${track.name}`, usage.input_tokens, usage.output_tokens)
  return parseCurriculumResponse(text, track.curriculum_mode)
}

function extractStepFields(block) {
  const hoursMatch = block.match(/Estimated hours?:\s*([\d.]+)/i)
  const estimated_minutes = hoursMatch ? Math.round(parseFloat(hoursMatch[1]) * 60) : null

  const todoMatch = block.match(/What to do:\s*(.+?)(?=\nWhat you'll be able|$)/is)
  const outcomeMatch = block.match(/What you(?:'ll| will) be able to do after:\s*(.+?)(?=\n[A-Z]|\n\d+\.|$)/is)

  const actions = todoMatch
    ? todoMatch[1].trim().split('|').map(a => a.trim()).filter(Boolean)
    : []
  const outcome = outcomeMatch?.[1]?.trim() || ''

  const description = [
    actions.length ? actions.map(a => `• ${a}`).join('\n') : '',
    outcome ? `\nAfter this: ${outcome}` : '',
  ].filter(Boolean).join('\n').trim()

  return { estimated_minutes, description }
}

function parseCurriculumResponse(text, mode) {
  const approachMatch = text.match(/APPROACH NOTE:\n([\s\S]*?)(?=\nCURRICULUM:|$)/i)
  const approachNote = approachMatch?.[1]?.trim() || ''

  const curriculumMatch = text.match(/CURRICULUM:\n([\s\S]*?)(?=\nRESOURCES:|$)/i)
  const curriculumRaw = curriculumMatch?.[1]?.trim() || ''

  const resourcesMatch = text.match(/RESOURCES:\n([\s\S]*?)$/i)
  const resourcesRaw = resourcesMatch?.[1]?.trim() || ''

  let steps = []
  let modules = []

  if (mode === 'structured') {
    // Split on "Module:" lines
    const moduleBlocks = curriculumRaw.split(/\n(?=Module:)/i)
    moduleBlocks.forEach(mBlock => {
      const headerMatch = mBlock.match(/^Module:\s*(.+?)\s*—\s*(.+)/i)
      if (!headerMatch) return
      const currentModule = { title: headerMatch[1].trim(), description: headerMatch[2].trim(), lessons: [] }
      modules.push(currentModule)
      // Split remainder on "Lesson:" lines
      const lessonParts = mBlock.split(/\n(?=\s*Lesson:)/i).slice(1)
      lessonParts.forEach(lBlock => {
        const titleMatch = lBlock.match(/Lesson:\s*(.+)/i)
        if (!titleMatch) return
        const { estimated_minutes, description } = extractStepFields(lBlock)
        currentModule.lessons.push({ title: titleMatch[1].trim(), estimated_minutes, description })
      })
    })
  } else {
    // Split on numbered step lines (1., 2., …)
    const stepBlocks = curriculumRaw.split(/\n(?=\d+\.)/)
    stepBlocks.forEach(block => {
      const titleMatch = block.match(/^\d+\.\s*(.+)/)
      if (!titleMatch) return
      const title = titleMatch[1].trim()
      const { estimated_minutes, description } = extractStepFields(block)
      steps.push({ title, estimated_minutes, description })
    })
  }

  const resources = []
  const rBlocks = resourcesRaw.split(/\n(?=Title:)/i)
  rBlocks.forEach(block => {
    const title = block.match(/Title:\s*(.+)/i)?.[1]?.trim()
    const type = block.match(/Type:\s*(.+)/i)?.[1]?.trim()
    const platform = block.match(/Platform:\s*(.+)/i)?.[1]?.trim()
    const url = block.match(/URL:\s*(.+)/i)?.[1]?.trim()
    const why = block.match(/Use for:\s*(.+)/i)?.[1]?.trim() || block.match(/Why:\s*(.+)/i)?.[1]?.trim()
    if (title) resources.push({ title, type: type || 'Other', platform: platform || '', url: url === '—' ? '' : (url || ''), why: why || '' })
  })

  return { approachNote, steps, modules, resources, raw: text }
}

// Summarise a step's notes into a 2–3 sentence takeaway
export async function summariseStepNotes({ stepTitle, notes, reflectionNotes, userId }) {
  const system = `You are a learning coach. Given a student's raw notes and reflections on a specific learning step, return a 2–3 sentence distilled takeaway — the core insight they should retain. Be specific to what they wrote; do not add generic advice. Return only the summary, no preamble.`

  const prompt = `Step: ${stepTitle}

Notes:
${notes || '(none)'}

Reflection so far:
${reflectionNotes || '(none)'}

Distil the key takeaway in 2–3 sentences.`

  const data = await proxy({
    model: MODEL,
    max_tokens: 300,
    system,
    messages: [{ role: 'user', content: prompt }],
  })
  const text = data.content[0].text
  const usage = data.usage || {}
  await logAI(userId, 'learning_reflection', `Reflection: ${stepTitle}`, usage.input_tokens, usage.output_tokens)
  return text.trim()
}
