export const TASK_AREAS = ['Career', 'Creative', 'Personal', 'Financial', 'Health/Wellness', 'Other']

export const AREA_COLORS = {
  Career: '#1a4fff',
  Creative: '#e8a020',
  Personal: '#d4506a',
  Financial: '#0a8a5a',
  'Health/Wellness': '#e07820',
  Other: '#8a7d75',
}

export const GOAL_CATEGORIES = ['Career', 'Creative', 'Financial', 'Personal', 'Wellness']

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

// Parses time-allocation strings like '15 min', '1 hr', '1.5 hr' into minutes.
export function parseTimeAllocationToMinutes(value) {
  if (!value) return null
  const match = String(value).match(/^([\d.]+)\s*(min|hr)/i)
  if (!match) return null
  const num = parseFloat(match[1])
  if (Number.isNaN(num)) return null
  return match[2].toLowerCase() === 'hr' ? Math.round(num * 60) : Math.round(num)
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
