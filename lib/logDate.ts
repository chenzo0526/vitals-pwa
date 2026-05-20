// Shared retroactive-logging helper. Lets any log entry point write to a past day
// via a ?date=YYYY-MM-DD query param. Without it, everything defaults to "now".

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}

export function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function yesterdayStr(): string {
  const d = new Date(Date.now() - 24 * 60 * 60 * 1000)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/**
 * Resolve a log timestamp + date string from an optional ?date param.
 * - Today  -> real now() so time ordering is preserved.
 * - Past   -> noon local on that day (avoids timezone day-boundary slips).
 * - Future or invalid -> coerced to today.
 */
export function resolveLogDate(dateParam: string | null | undefined): {
  ts: string
  dateStr: string
  isToday: boolean
} {
  const t = todayStr()
  if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) && dateParam <= t) {
    if (dateParam === t) return { ts: new Date().toISOString(), dateStr: t, isToday: true }
    const d = new Date(`${dateParam}T12:00:00`)
    if (!Number.isNaN(d.getTime())) {
      return { ts: d.toISOString(), dateStr: dateParam, isToday: false }
    }
  }
  return { ts: new Date().toISOString(), dateStr: t, isToday: true }
}

/** Human label for a YYYY-MM-DD: "Today", "Yesterday", or "Mon May 18". */
export function logDateLabel(dateStr: string): string {
  if (dateStr === todayStr()) return 'Today'
  if (dateStr === yesterdayStr()) return 'Yesterday'
  const d = new Date(`${dateStr}T12:00:00`)
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

/** Client-safe read of ?date= without useSearchParams (avoids Suspense boundary churn). */
export function readDateParamFromUrl(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return new URLSearchParams(window.location.search).get('date')
  } catch {
    return null
  }
}
