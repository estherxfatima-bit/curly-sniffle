import { supabase } from './supabase'
import { format, startOfWeek } from 'date-fns'

// Pull a ```json ... ``` block with a "suggested_tasks" array out of an AI response,
// returning the cleaned display text (with the fence removed, wherever it sits — at
// the end or with trailing prose after it) and the parsed task list (if any).
export function parseSuggestedTasks(text) {
  // Prefer a properly closed ```json fence, but fall back to an unclosed one
  // (e.g. the response got cut off by the token limit) by reading to the end of the text.
  const closedMatch = text.match(/```json\s*([\s\S]*?)```/)
  const match = closedMatch || text.match(/```json\s*([\s\S]*)/)
  if (!match) return { text, tasks: [] }

  let jsonStr = match[1].trim()
  // If the fence was unclosed, the JSON itself may be truncated mid-object — trim back to the
  // last complete suggested_tasks entry so JSON.parse still succeeds on the salvageable part.
  if (!closedMatch) {
    const lastComplete = jsonStr.lastIndexOf('},')
    if (lastComplete !== -1) jsonStr = jsonStr.slice(0, lastComplete + 1) + ']}'
  }

  // Strip the whole fenced block out of the displayed text regardless of whether the
  // JSON parses — a malformed block should never leak into the UI as raw text.
  const before = text.slice(0, match.index).trim()
  const after = text.slice(match.index + match[0].length).trim()
  const cleanText = [before, after].filter(Boolean).join('\n\n')

  try {
    const parsed = JSON.parse(jsonStr)
    if (!Array.isArray(parsed.suggested_tasks)) return { text: cleanText, tasks: [] }
    return { text: cleanText, tasks: parsed.suggested_tasks }
  } catch {
    return { text: cleanText, tasks: [] }
  }
}

// Insert a single AI-suggested task into weekly_tasks or daily_todos. Returns
// the Supabase { error } result so callers can surface failures to the user.
export async function insertSuggestedTask(userId, task, priority_level) {
  if (task.type === 'weekly') {
    const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd')
    return supabase.from('weekly_tasks').insert({
      user_id: userId, week_start: weekStart,
      area: task.area || 'Personal', action: task.action, frequency: task.frequency, specific_task: task.specific_task,
      complete: false, carried_forward: false, priority_level,
    })
  }
  if (task.type === 'daily') {
    return supabase.from('daily_todos').insert({
      user_id: userId, text: task.title, date: task.due_date, complete: false, priority_level,
    })
  }
  return { error: new Error(`Unknown suggested task type: ${task.type}`) }
}
