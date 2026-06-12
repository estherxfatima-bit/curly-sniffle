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

export const PILLAR_COLORS = {
  'Work & Becoming': 'var(--career)',
  'Taste & Expression': 'var(--creative)',
  'Life Design': 'var(--wellness)',
  'Creative Direct Your Life': 'var(--personal)',
}

export const PILLAR_DESCRIPTIONS = {
  'Work & Becoming': 'Career, portfolio life, business building, and the work of becoming who you\'re growing into.',
  'Taste & Expression': 'Style, beauty, taste, and personal expression — the things that shape how you show up.',
  'Life Design': 'How you design your days, money, routines, and the bigger-picture choices behind your life.',
  'Creative Direct Your Life': 'Creative direction applied to everyday life — experiments, aesthetics, and intentional living.',
}

export const PRODUCTION_STAGES = [
  'Idea',
  'Filming scheduled',
  'Filmed',
  'Editing',
  'Ready to post',
  'Posted',
]

export const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4']

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
