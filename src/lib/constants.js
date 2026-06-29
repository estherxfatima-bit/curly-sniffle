export const TASK_AREAS = ['Career', 'Creative', 'Personal', 'Financial', 'Health/Wellness', 'Work (9–5)', 'Other']

export const AREA_COLORS = {
  Career: '#1a4fff',
  Creative: '#e8a020',
  Personal: '#d4506a',
  Financial: '#0a8a5a',
  'Health/Wellness': '#e07820',
  'Work (9–5)': '#64748b',
  Other: '#8a7d75',
}

// Day labels used by work-hours / overlap pickers (Settings, time-blocking).
export const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

// Curated 12-swatch palette offered when picking a colour for a daily-todo category.
export const TODO_CATEGORY_COLOR_PALETTE = [
  '#1a4fff', // blue
  '#c44060', // rose
  '#c8820a', // amber
  '#3d8a62', // green
  '#0a8a5a', // teal-green
  '#8a3ddb', // purple
  '#e0607e', // pink
  '#0aa8c8', // cyan
  '#d4500a', // orange
  '#6b6b6b', // grey
  '#b8902a', // gold
  '#3d5a99', // navy
]

// Default daily-todo categories, seeded into todo_categories on first load if a user has none.
export const DEFAULT_TODO_CATEGORIES = [
  { name: 'Work',     colour: '#1a4fff' },
  { name: 'Personal', colour: '#c44060' },
  { name: 'Errands',  colour: '#c8820a' },
  { name: 'Creative', colour: '#c8820a' },
  { name: 'Health',   colour: '#3d8a62' },
]

export const GOAL_CATEGORIES = ['Career', 'Creative', 'Financial', 'Personal', 'Wellness']

// Quarterly goals track progress as a manual metric or via milestones.
// Yearly goals track progress as a manual metric or as a theme (a count of
// linked quarterly goals completed) — linked-task tracking no longer exists.
export const QUARTERLY_TRACKING_TYPES = ['milestone', 'metric']
export const YEARLY_TRACKING_TYPES = ['theme', 'metric']
export const TRACKING_TYPE_LABELS = {
  milestone: 'Milestones',
  metric: 'Manual metric',
  theme: 'Theme',
}

export const CONTENT_PILLARS = [
  'Work & Becoming',
  'Taste & Expression',
  'Life Design',
  'Creative Direct Your Life',
]

export const CONTENT_FORMATS = [
  'Talking head',
  'Carousel',
  'Video anchor',
  'Simple text over clip',
  'Pull clip',
]

export const CONTENT_STATUSES = [
  'Idea',
  'Film next',
  'Ready to edit',
  'Pull clip',
  'Posted',
]

export const PILLAR_COLOR_PALETTE = [
  'var(--career)',
  'var(--creative)',
  'var(--wellness)',
  'var(--personal)',
  'var(--finance)',
]

export const DEFAULT_PILLARS = [
  {
    name: 'Work & Becoming',
    description: 'Career, portfolio life, business building, and the work of becoming who you\'re growing into.',
    examples: 'Career updates, portfolio career breakdowns, business lessons, income streams, freelance life.',
    color: 'var(--career)',
  },
  {
    name: 'Taste & Expression',
    description: 'Style, beauty, taste, and personal expression — the things that shape how you show up.',
    examples: 'GRWM, outfit breakdowns, makeup, product hauls, aesthetic experiments.',
    color: 'var(--creative)',
  },
  {
    name: 'Life Design',
    description: 'How you design your days, money, routines, and the bigger-picture choices behind your life.',
    examples: 'Day-in-the-life, routines, money mindset, habit and goal systems.',
    color: 'var(--wellness)',
  },
  {
    name: 'Creative Direct Your Life',
    description: 'Creative direction applied to everyday life — experiments, aesthetics, and intentional living.',
    examples: 'Creative direction series, experimental looks, intentional-living vignettes.',
    color: 'var(--personal)',
  },
]

export const PRODUCTION_STAGES = [
  'Idea',
  'Filming scheduled',
  'Filmed',
  'Editing',
  'Ready to post',
  'Posted',
]

// Parses time-allocation strings like '15 min', '1 hr', '1.5 hr', '1 hr 30 min' into minutes.
export function parseTimeAllocationToMinutes(value) {
  if (!value) return null
  const str = String(value)
  let total = 0
  let matched = false
  for (const m of str.matchAll(/([\d.]+)\s*(min|hr)/gi)) {
    const num = parseFloat(m[1])
    if (Number.isNaN(num)) continue
    matched = true
    total += m[2].toLowerCase() === 'hr' ? num * 60 : num
  }
  return matched ? Math.round(total) : null
}

// Splits a time-allocation string into { hours, minutes } for editing UI.
export function parseTimeAllocationToParts(value) {
  const total = parseTimeAllocationToMinutes(value)
  if (total == null) return { hours: 0, minutes: 0 }
  return { hours: Math.floor(total / 60), minutes: total % 60 }
}

// Builds a time-allocation string like '1 hr 30 min' from hours/minutes, or null if both are 0.
export function buildTimeAllocation(hours, minutes) {
  const h = Number(hours) || 0
  const m = Number(minutes) || 0
  if (h === 0 && m === 0) return null
  const parts = []
  if (h > 0) parts.push(`${h} hr`)
  if (m > 0) parts.push(`${m} min`)
  return parts.join(' ')
}

export const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4']

// 'Year' is a pseudo-quarter for goals that span the whole year and get
// broken down into quarterly goals via `parent_goal_id`.
export const GOAL_TIMEFRAMES = ['Year', ...QUARTERS]

export const getCurrentQuarter = () => getQuarterFromDate(new Date())

export const getQuarterFromDate = (date) => {
  const month = date.getMonth()
  if (month < 3) return 'Q1'
  if (month < 6) return 'Q2'
  if (month < 9) return 'Q3'
  return 'Q4'
}

export const getQuarterYear = () => {
  const now = new Date()
  return `${getCurrentQuarter()} ${now.getFullYear()}`
}

// Priority levels for daily todos, weekly tasks and goals (stored as `priority_level`).
export const PRIORITY_LEVELS = ['urgent', 'high', 'medium', 'low']

export const PRIORITY_LABELS = {
  urgent: 'Urgent',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
}

export const PRIORITY_COLORS = {
  urgent: '#e0453c',
  high: '#e8a020',
  medium: '#3b6fe0',
  low: '#9a9089',
}

// Exclamation-mark badges: Urgent = !!!!, High = !!!, Medium = !!, Low = !.
export const PRIORITY_MARKS = {
  urgent: '!!!!',
  high: '!!!',
  medium: '!!',
  low: '!',
}

// Sort comparator: items with a priority_level sort before items without one,
// ordered urgent > high > medium > low.
export function priorityRank(level) {
  const idx = PRIORITY_LEVELS.indexOf(level)
  return idx === -1 ? PRIORITY_LEVELS.length : idx
}

// Options for a priority filter bar: '' (all), each level, then 'none' (unprioritised).
export function priorityFilterOptions() {
  return [
    { value: '', label: 'All' },
    ...PRIORITY_LEVELS.map(p => ({ value: p, label: PRIORITY_LABELS[p] })),
    { value: 'none', label: 'No priority' },
  ]
}
