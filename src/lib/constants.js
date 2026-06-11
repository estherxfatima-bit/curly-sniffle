export const TASK_AREAS = ['Career', 'Creative', 'Business/Sanctum', 'Personal', 'Financial', 'Health']

export const GOAL_CATEGORIES = ['Career', 'Creative', 'Financial', 'Personal']

export const CONTENT_PILLARS = [
  'Work & Becoming',
  'Taste & Expression',
  'Life Design',
  'Creative Direct Your Life',
]

export const CONTENT_FORMATS = [
  'Talking head',
  'Video anchor',
  'Carousel',
  'Simple text over clip',
]

export const CONTENT_STATUSES = [
  'Idea',
  'Film next',
  'Pull clip',
  'Ready to edit',
  'Editing',
  'Ready to post',
  'Posted',
]

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
