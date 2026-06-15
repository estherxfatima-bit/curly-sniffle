// Auto time-blocking: given today's todos (with duration/time) and existing
// Google Calendar busy events, propose a schedule that fits each todo into a
// free gap within working hours.

import { priorityRank } from './constants'

export function toMinutes(hhmm, fallback) {
  if (!hhmm) return fallback
  const [h, m] = hhmm.split(':').map(Number)
  if (Number.isNaN(h) || Number.isNaN(m)) return fallback
  return h * 60 + m
}

export function minutesToTimeString(minutes) {
  const h = Math.floor(minutes / 60) % 24
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

// `date` is a yyyy-MM-dd string. Returns an ISO datetime string for that date at `minutes` past midnight, local time.
export function dateAndMinutesToISO(date, minutes) {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  const d = new Date(`${date}T00:00:00`)
  d.setHours(h, m, 0, 0)
  return d.toISOString()
}

// Merges overlapping/adjacent busy intervals (sorted by start) into a minimal set.
function mergeIntervals(intervals) {
  const sorted = [...intervals].sort((a, b) => a.start - b.start)
  const merged = []
  for (const iv of sorted) {
    const last = merged[merged.length - 1]
    if (last && iv.start <= last.end) {
      last.end = Math.max(last.end, iv.end)
    } else {
      merged.push({ ...iv })
    }
  }
  return merged
}

/**
 * @param {Array} todos - todos with { id, text, duration_minutes, scheduled_time }
 * @param {Array} busyEvents - calendar events with { start, end } ISO strings (today's events)
 * @param {{ start: string, end: string }} workingHours - 'HH:MM' strings, defaults to 09:00–19:00
 * @param {string} date - yyyy-MM-dd, the day being scheduled
 * @returns {Array} proposed slots: [{ todoId, todoText, durationMinutes, start, end, startLabel, endLabel }]
 */
export function proposeTimeBlocks(todos, busyEvents, workingHours, date) {
  const dayStart = toMinutes(workingHours?.start, 9 * 60)
  const dayEnd = toMinutes(workingHours?.end, 19 * 60)

  const schedulable = todos.filter(t => !t.complete && t.duration_minutes > 0)
  const timed = schedulable.filter(t => t.scheduled_time).sort((a, b) => toMinutes(a.scheduled_time, 0) - toMinutes(b.scheduled_time, 0))
  // Untimed todos are slotted into gaps in priority order: Urgent > High > Medium > Low > unprioritised.
  const untimed = schedulable.filter(t => !t.scheduled_time)
    .sort((a, b) => priorityRank(a.priority_level) - priorityRank(b.priority_level))

  // Busy intervals (in minutes-of-day) from Google Calendar, restricted to today
  const calBusy = (busyEvents || [])
    .filter(e => e.start && e.end && !e.allDay)
    .map(e => {
      const start = new Date(e.start)
      const end = new Date(e.end)
      const dayPrefix = `${date}T`
      // Only include events that fall on the target date
      if (!e.start.startsWith(dayPrefix) && start.toDateString() !== new Date(`${date}T00:00:00`).toDateString()) return null
      return {
        start: start.getHours() * 60 + start.getMinutes(),
        end: end.getHours() * 60 + end.getMinutes(),
      }
    })
    .filter(Boolean)

  const results = []
  const busy = [...calBusy]

  // 1. Place timed todos at their requested time, clamped to working hours
  for (const todo of timed) {
    let start = toMinutes(todo.scheduled_time, dayStart)
    const duration = todo.duration_minutes
    let end = start + duration
    if (end > dayEnd) { end = dayEnd; start = Math.max(dayStart, end - duration) }
    results.push({ todoId: todo.id, todoText: todo.text, durationMinutes: duration, startMin: start, endMin: end })
    busy.push({ start, end })
  }

  // 2. Place untimed todos into the next available free gap
  const sortedBusy = mergeIntervals(busy)
  let cursor = dayStart
  for (const todo of untimed) {
    const duration = todo.duration_minutes
    let placed = false
    while (!placed) {
      // Find the next interval blocking the cursor
      const blocking = sortedBusy.find(b => b.start < cursor + duration && b.end > cursor)
      if (!blocking) {
        if (cursor + duration <= dayEnd) {
          results.push({ todoId: todo.id, todoText: todo.text, durationMinutes: duration, startMin: cursor, endMin: cursor + duration })
          sortedBusy.push({ start: cursor, end: cursor + duration })
          sortedBusy.sort((a, b) => a.start - b.start)
          cursor += duration
        }
        // No blocking interval found: either placed above, or no room left today — skip this todo either way
        placed = true
      } else {
        cursor = blocking.end
      }
    }
  }

  return results
    .sort((a, b) => a.startMin - b.startMin)
    .map(r => ({
      todoId: r.todoId,
      todoText: r.todoText,
      durationMinutes: r.durationMinutes,
      startMin: r.startMin,
      endMin: r.endMin,
      start: dateAndMinutesToISO(date, r.startMin),
      end: dateAndMinutesToISO(date, r.endMin),
      startLabel: minutesToTimeString(r.startMin),
      endLabel: minutesToTimeString(r.endMin),
    }))
}
