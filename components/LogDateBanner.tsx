'use client'

import { CalendarClock } from 'lucide-react'
import { logDateLabel } from '@/lib/logDate'

/** Shows a clear banner when the user is logging to a past day (not today). */
export default function LogDateBanner({ dateStr, isToday }: { dateStr: string; isToday: boolean }) {
  if (isToday) return null
  return (
    <div className="flex items-center gap-2 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-amber-200">
      <CalendarClock size={14} className="flex-shrink-0" />
      <p className="text-xs font-semibold">
        Logging to {logDateLabel(dateStr)} — not today
      </p>
    </div>
  )
}
