// ICS file generation utilities — no server auth, pure client-side download

export function formatICSDate(date) {
  const d = new Date(date)
  const pad = (n) => String(n).padStart(2, '0')
  return (
    d.getUTCFullYear() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    'T' +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    'Z'
  )
}

export function generateUID() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}@lifeos`
}

export function buildICSEvent({ summary, description = '', location = '', start, end, uid }) {
  const startStr = typeof start === 'string' && start.length === 8 ? `DTSTART;VALUE=DATE:${start}` : `DTSTART:${formatICSDate(start)}`
  const endStr = typeof end === 'string' && end.length === 8 ? `DTEND;VALUE=DATE:${end}` : `DTEND:${formatICSDate(end)}`

  return [
    'BEGIN:VEVENT',
    `UID:${uid || generateUID()}`,
    `DTSTAMP:${formatICSDate(new Date())}`,
    startStr,
    endStr,
    `SUMMARY:${summary}`,
    description ? `DESCRIPTION:${description.replace(/\n/g, '\\n')}` : '',
    location ? `LOCATION:${location}` : '',
    'END:VEVENT',
  ]
    .filter(Boolean)
    .join('\r\n')
}

export function buildICSFile(events) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Life OS//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    ...events,
    'END:VCALENDAR',
  ]
  return lines.join('\r\n')
}

export function downloadICS(filename, content) {
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function createSingleEventICS({ summary, description, location, start, end }) {
  const event = buildICSEvent({ summary, description, location, start, end })
  return buildICSFile([event])
}
