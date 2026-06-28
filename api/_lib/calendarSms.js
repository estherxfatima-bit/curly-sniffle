// SMS calendar add/remove — never writes to Google Calendar from the first
// message. Every request is parsed, replied back in plain English for the
// user to check, and only acted on once they reply YES (a wrong date/time
// silently turning into a real calendar event is the exact failure mode
// this two-step flow exists to prevent).
import * as chrono from 'chrono-node'
import { format } from 'date-fns'
import { supabaseAdmin } from './db.js'
import { getAccessToken, listUpcomingEvents, createEvent, deleteEvent } from './googleCalendar.js'

const PENDING_TTL_MS = 10 * 60 * 1000
const REMOVE_WINDOW_DAYS = 60
const MAX_CANDIDATES = 5

// ── Parsers ──────────────────────────────────────────────────────────────

// "calendar: dentist thursday 3pm" / "cal: dentist 3 jul 3pm-4pm" / "schedule: ..."
export function parseCalendarAdd(text) {
  const m = text.trim().match(/^(?:calendar|cal|schedule):?\s+(.+)$/i)
  if (!m) return null
  return { raw: m[1].trim() }
}

// "cancel: dentist" / "remove calendar: dentist thursday" / "delete event: dentist"
export function parseCalendarRemove(text) {
  const m = text.trim().match(/^(?:cancel|remove|delete)\s*(?:calendar|event)?:?\s+(.+)$/i)
  if (!m) return null
  return { query: m[1].trim() }
}

export function isConfirmYes(text) { return /^(yes|y|confirm|ok|okay)\b/i.test(text.trim()) }
export function isConfirmNo(text) { return /^(no|n|cancel|stop)\b/i.test(text.trim()) }
export function parseNumericChoice(text) {
  const m = text.trim().match(/^(\d+)$/)
  return m ? parseInt(m[1], 10) : null
}

// ── Pending-action state ────────────────────────────────────────────────

export async function getPendingAction(userId) {
  const { data } = await supabaseAdmin
    .from('sms_pending_actions')
    .select('*')
    .eq('user_id', userId)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data
}

async function setPendingAction(userId, actionType, payload) {
  await supabaseAdmin.from('sms_pending_actions').delete().eq('user_id', userId)
  await supabaseAdmin.from('sms_pending_actions').insert({
    user_id: userId,
    action_type: actionType,
    payload,
    expires_at: new Date(Date.now() + PENDING_TTL_MS).toISOString(),
  })
}

async function clearPendingAction(id) {
  await supabaseAdmin.from('sms_pending_actions').delete().eq('id', id)
}

// ── Add flow ─────────────────────────────────────────────────────────────

export async function handleCalendarAdd(userId, { raw }) {
  const { error } = await getAccessToken(userId)
  if (error === 'not_connected') return "Google Calendar isn't connected — connect it in Settings first."
  if (error === 'reconnect') return 'Your Google Calendar connection needs reconnecting — go to Settings.'

  const results = chrono.parse(raw, new Date())
  if (!results.length) {
    return "I couldn't find a date/time in that — try e.g. 'calendar: dentist thursday 3pm'."
  }
  const r = results[0]
  const start = r.start.date()
  const hasTime = r.start.isCertain('hour')
  const end = r.end ? r.end.date() : new Date(start.getTime() + 60 * 60 * 1000)

  const title = (raw.slice(0, r.index) + raw.slice(r.index + r.text.length)).replace(/\s+/g, ' ').trim() || 'Event'

  const payload = {
    summary: title,
    description: '',
    allDay: !hasTime,
    start: hasTime ? start.toISOString() : format(start, 'yyyy-MM-dd'),
    end: hasTime ? end.toISOString() : format(start, 'yyyy-MM-dd'),
  }
  await setPendingAction(userId, 'calendar_add', payload)

  const whenText = hasTime ? format(start, "EEE d MMM 'at' h:mma") : format(start, 'EEE d MMM (all day)')
  return `Add "${title}" — ${whenText}? Reply YES to confirm, NO to cancel.`
}

async function executeCalendarAdd(userId, payload) {
  const { accessToken, error } = await getAccessToken(userId)
  if (error) return "Couldn't reach Google Calendar — try again from the app."
  const event = await createEvent(accessToken, payload)
  if (event.error) return `Failed to add event: ${event.error}`
  return `Added "${payload.summary}" to your calendar.`
}

// ── Remove flow ──────────────────────────────────────────────────────────

export async function handleCalendarRemove(userId, { query }) {
  const { accessToken, error } = await getAccessToken(userId)
  if (error === 'not_connected') return "Google Calendar isn't connected — connect it in Settings first."
  if (error === 'reconnect') return 'Your Google Calendar connection needs reconnecting — go to Settings.'

  const now = new Date()
  const events = await listUpcomingEvents(accessToken, {
    timeMin: now.toISOString(),
    timeMax: new Date(now.getTime() + REMOVE_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString(),
  })
  const q = query.toLowerCase()
  const matches = events.filter(e => (e.summary || '').toLowerCase().includes(q))

  if (!matches.length) return `No upcoming events found matching "${query}".`

  if (matches.length === 1) {
    const e = matches[0]
    await setPendingAction(userId, 'calendar_remove', { eventId: e.id, calendarId: e.calendarId, summary: e.summary })
    const when = format(new Date(e.start), e.allDay ? 'EEE d MMM' : "EEE d MMM 'at' h:mma")
    return `Delete "${e.summary}" — ${when}? Reply YES to confirm, NO to cancel.`
  }

  const top = matches.slice(0, MAX_CANDIDATES)
  await setPendingAction(userId, 'calendar_remove_select', { candidates: top })
  const lines = top.map((e, i) => `${i + 1}. ${e.summary} — ${format(new Date(e.start), e.allDay ? 'EEE d MMM' : "EEE d MMM, h:mma")}`)
  return `Multiple matches:\n${lines.join('\n')}\nReply with the number to delete, or NO to cancel.`
}

async function executeCalendarRemove(userId, payload) {
  const { accessToken, error } = await getAccessToken(userId)
  if (error) return "Couldn't reach Google Calendar — try again from the app."
  const result = await deleteEvent(accessToken, payload.eventId, payload.calendarId)
  if (result.error) return `Failed to delete event: ${result.error}`
  return `Deleted "${payload.summary}".`
}

// ── Pending-action resolution ───────────────────────────────────────────

// Returns the reply text if `text` resolved the pending action, or null if
// it didn't match (the action stays pending — caller falls through to
// normal message routing).
export async function handlePendingResponse(userId, text, pending) {
  if (isConfirmNo(text)) {
    await clearPendingAction(pending.id)
    return 'Cancelled.'
  }

  if (pending.action_type === 'calendar_remove_select') {
    const choice = parseNumericChoice(text)
    const candidate = choice ? pending.payload.candidates[choice - 1] : null
    if (!candidate) return null
    await clearPendingAction(pending.id)
    return executeCalendarRemove(userId, candidate)
  }

  if (isConfirmYes(text)) {
    await clearPendingAction(pending.id)
    if (pending.action_type === 'calendar_add') return executeCalendarAdd(userId, pending.payload)
    if (pending.action_type === 'calendar_remove') return executeCalendarRemove(userId, pending.payload)
  }

  return null
}
