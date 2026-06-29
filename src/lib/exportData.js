import { supabase } from './supabase'

// Each entry: the table to read, and the date column used to scope it to
// the selected timeframe. `null` means "always export everything" (goals
// and content batches aren't really period-bound).
export const EXPORT_TABLES = [
  { key: 'goals',           table: 'goals',            dateCol: null,        label: 'Goals' },
  { key: 'weekly_tasks',    table: 'weekly_tasks',      dateCol: 'week_start', label: 'Weekly tasks' },
  { key: 'daily_todos',     table: 'daily_todos',       dateCol: 'date',      label: 'Daily to-dos' },
  { key: 'habit_logs',      table: 'habit_logs',        dateCol: 'log_date',  label: 'Habit logs' },
  { key: 'fixed_expenses',  table: 'fixed_expenses',    dateCol: null,        label: 'Fixed expenses' },
  { key: 'variable_expenses', table: 'variable_expenses', dateCol: 'date',    label: 'Variable expenses' },
  { key: 'content_batches', table: 'content_batches',   dateCol: null,       label: 'Content ideas' },
  { key: 'mood_logs',       table: 'mood_logs',         dateCol: 'log_date',  label: 'Mood logs' },
  { key: 'workout_logs',    table: 'workout_logs',      dateCol: 'log_date',  label: 'Workout logs' },
]

export const DEFAULT_EXPORT_KEYS = EXPORT_TABLES.map(t => t.key)

export const EXPORT_RANGE_OPTIONS = [
  { label: 'Last 1 month',  months: 1 },
  { label: 'Last 3 months', months: 3 },
  { label: 'Last 6 months', months: 6 },
  { label: 'Last 12 months', months: 12 },
  { label: 'All time',      months: null },
]

function cutoffDateStr(months) {
  if (!months) return null
  const d = new Date()
  d.setMonth(d.getMonth() - months)
  return d.toISOString().slice(0, 10)
}

export async function fetchExportData(userId, months, selectedKeys = DEFAULT_EXPORT_KEYS) {
  const cutoff = cutoffDateStr(months)
  const results = {}
  for (const { key, table, dateCol } of EXPORT_TABLES) {
    if (!selectedKeys.includes(key)) continue
    let query = supabase.from(table).select('*').eq('user_id', userId)
    if (dateCol && cutoff) query = query.gte(dateCol, cutoff)
    const { data, error } = await query
    if (error) throw new Error(`Failed to load ${table}: ${error.message}`)
    results[key] = data || []
  }
  return results
}

function csvEscape(value) {
  if (value === null || value === undefined) return ''
  const str = typeof value === 'object' ? JSON.stringify(value) : String(value)
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str
}

function tableToCSV(rows) {
  if (!rows.length) return ''
  const columns = [...new Set(rows.flatMap(r => Object.keys(r)))]
  const lines = [columns.join(',')]
  for (const row of rows) lines.push(columns.map(c => csvEscape(row[c])).join(','))
  return lines.join('\n')
}

// One combined CSV, with a header line per section — no zip library needed.
export function toCombinedCSV(data) {
  const sections = []
  for (const { key } of EXPORT_TABLES) {
    if (!(key in data)) continue
    const rows = data[key] || []
    sections.push(`## ${key} (${rows.length} rows)\n${rows.length ? tableToCSV(rows) : '(no rows)'}`)
  }
  return sections.join('\n\n')
}

export function downloadFile(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export async function exportMyData(userId, months, selectedKeys = DEFAULT_EXPORT_KEYS) {
  const data = await fetchExportData(userId, months, selectedKeys)
  const stamp = new Date().toISOString().slice(0, 10)
  downloadFile(`my-data-export-${stamp}.json`, JSON.stringify(data, null, 2), 'application/json')
  downloadFile(`my-data-export-${stamp}.csv`, toCombinedCSV(data), 'text/csv')
}
