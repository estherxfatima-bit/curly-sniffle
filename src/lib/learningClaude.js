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
${track.curriculum_mode === 'structured'
    ? '[Modules with nested lessons. Format each module as:\nModule: [title] — [brief description]\n  Lesson: [title] | [estimated hours] hours | [brief description]'
    : '[Numbered steps in logical order. Format each as:\n[n]. [title] | [estimated hours] hours | [brief description]'}
]

RESOURCES:
[3-5 specific resources. Format each as:\nTitle: [title]\nType: [Course/Book/Article/Video/Podcast/Tool/Other]\nPlatform: [platform]\nURL: [url or "—"]\nWhy: [one sentence why it's relevant at their level]
]`

  const data = await proxy({
    model: MODEL,
    max_tokens: 2000,
    system,
    messages: [{ role: 'user', content: prompt }],
  })
  const text = data.content[0].text
  const usage = data.usage || {}
  await logAI(userId, 'learning_curriculum', `Curriculum: ${track.name}`, usage.input_tokens, usage.output_tokens)
  return parseCurriculumResponse(text, track.curriculum_mode)
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
    let currentModule = null
    curriculumRaw.split('\n').forEach(line => {
      const modMatch = line.match(/^Module:\s*(.+?)\s*—\s*(.+)/)
      const lessonMatch = line.match(/^\s*Lesson:\s*(.+?)\s*\|\s*([\d.]+)\s*hours?\s*\|\s*(.+)/i)
      if (modMatch) {
        currentModule = { title: modMatch[1].trim(), description: modMatch[2].trim(), lessons: [] }
        modules.push(currentModule)
      } else if (lessonMatch && currentModule) {
        currentModule.lessons.push({
          title: lessonMatch[1].trim(),
          estimated_minutes: Math.round(parseFloat(lessonMatch[2]) * 60),
          description: lessonMatch[3].trim(),
        })
      }
    })
  } else {
    curriculumRaw.split('\n').forEach(line => {
      const m = line.match(/^\d+\.\s*(.+?)\s*\|\s*([\d.]+)\s*hours?\s*\|\s*(.+)/i)
      if (m) steps.push({ title: m[1].trim(), estimated_minutes: Math.round(parseFloat(m[2]) * 60), description: m[3].trim() })
    })
  }

  const resources = []
  const rBlocks = resourcesRaw.split(/\n(?=Title:)/i)
  rBlocks.forEach(block => {
    const title = block.match(/Title:\s*(.+)/i)?.[1]?.trim()
    const type = block.match(/Type:\s*(.+)/i)?.[1]?.trim()
    const platform = block.match(/Platform:\s*(.+)/i)?.[1]?.trim()
    const url = block.match(/URL:\s*(.+)/i)?.[1]?.trim()
    const why = block.match(/Why:\s*(.+)/i)?.[1]?.trim()
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
