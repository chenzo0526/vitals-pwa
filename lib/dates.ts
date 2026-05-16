/**
 * Date helpers that work in the user's local timezone (not UTC).
 *
 * Why: Supabase `daily_summary` rows are keyed by the user's local date,
 * so any client-side query like `eq('date', today)` MUST compute today
 * in the same timezone the user is logging from — not UTC.
 */

/**
 * Returns YYYY-MM-DD in the user's local timezone (or specified tz).
 * Replace every `new Date().toISOString().split('T')[0]` pattern with this.
 */
export function getLocalDateString(d: Date = new Date(), tz?: string): string {
  const timeZone = tz || Intl.DateTimeFormat().resolvedOptions().timeZone
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d)
}

/** Returns array of last N YYYY-MM-DD strings ending today, in user's tz. */
export function getLastNDates(n: number, tz?: string): string[] {
  const result: string[] = []
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    result.push(getLocalDateString(d, tz))
  }
  return result
}

/** Browser-detected IANA timezone (e.g. "America/Los_Angeles"). */
export function getUserTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone
}

/**
 * Parse a YYYY-MM-DD string back to a Date at LOCAL noon —
 * use this for `toLocaleDateString` calls so DST transitions don't
 * shift the displayed weekday by a day.
 */
export function parseLocalDate(dateStr: string): Date {
  return new Date(dateStr + 'T12:00:00')
}
