'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { todayStr, yesterdayStr, logDateLabel } from '@/lib/logDate'
import { Home, FlaskConical, Sparkles, MoreHorizontal, Plus, Camera, Mic, Dumbbell, TrendingUp, X, Search, CalendarDays } from 'lucide-react'

const TABS = [
  { href: '/', icon: Home, label: 'Home' },
  { href: '/substances', icon: FlaskConical, label: 'Stack' },
  // FAB sits between Stack and Practices
  { href: '/practices', icon: Sparkles, label: 'Practices' },
  { href: '/more', icon: MoreHorizontal, label: 'More' },
]

const LOG_OPTIONS = [
  { href: '/chat', icon: Sparkles, label: 'Ask Vitals', color: 'bg-amber-500/15 border-amber-400/40 text-amber-300' },
  { href: '/journal', icon: Sparkles, label: 'Check-in', color: 'bg-violet-500/15 border-violet-400/40 text-violet-300' },
  { href: '/food', icon: Camera, label: 'Snap Plate', color: 'bg-amber-500/15 border-amber-400/40 text-amber-300' },
  { href: '/food-search', icon: Search, label: 'Search Food', color: 'bg-emerald-500/15 border-emerald-400/40 text-emerald-300' },
  { href: '/voice', icon: Mic, label: 'Voice Food', color: 'bg-cyan-500/15 border-cyan-400/40 text-cyan-300' },
  { href: '/workout', icon: Dumbbell, label: 'Workout', color: 'bg-emerald-500/15 border-emerald-400/40 text-emerald-300' },
  { href: '/progress', icon: TrendingUp, label: 'Body Check', color: 'bg-rose-500/15 border-rose-400/40 text-rose-300' },
]

function haptic() {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(10)
}

export default function BottomNav() {
  const pathname = usePathname()
  const router = useRouter()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [logDate, setLogDate] = useState<string>(todayStr())

  if (
    pathname === '/login' ||
    pathname === '/onboarding' ||
    pathname?.startsWith('/auth/callback')
  ) return null

  function open() {
    haptic()
    setLogDate(todayStr())
    setSheetOpen(true)
  }

  function close() {
    setSheetOpen(false)
  }

  function go(href: string) {
    haptic()
    setSheetOpen(false)
    const url = logDate && logDate !== todayStr() ? `${href}?date=${logDate}` : href
    router.push(url)
  }

  return (
    <>
      <AnimatePresence>
        {sheetOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="fixed inset-0 z-[55] bg-black/70 backdrop-blur-sm"
              onClick={close}
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 360, damping: 32 }}
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={0.3}
              onDragEnd={(_e, info) => { if (info.offset.y > 60) close() }}
              className="fixed left-0 right-0 bottom-0 z-[60] safe-bottom"
            >
              <div className="max-w-md mx-auto bg-zinc-950 border-t border-white/10 rounded-t-3xl px-4 pt-2 pb-6 shadow-2xl">
                <div className="flex justify-center pb-2">
                  <div className="w-10 h-1 rounded-full bg-white/15" />
                </div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs uppercase tracking-wider text-white/40">Log something</p>
                  <button onClick={close} className="text-white/30 hover:text-white/70 p-1">
                    <X size={16} />
                  </button>
                </div>

                {/* Date selector — log to a past day if you forgot */}
                <div className="flex items-center gap-1.5 mb-3">
                  <CalendarDays size={13} className="text-white/30 flex-shrink-0" />
                  <button
                    onClick={() => setLogDate(todayStr())}
                    className={`text-[11px] font-semibold px-2.5 py-1 rounded-md border transition-colors ${
                      logDate === todayStr()
                        ? 'bg-amber-400/15 border-amber-400/40 text-amber-200'
                        : 'border-white/10 text-white/50 hover:text-white/80'
                    }`}
                  >
                    Today
                  </button>
                  <button
                    onClick={() => setLogDate(yesterdayStr())}
                    className={`text-[11px] font-semibold px-2.5 py-1 rounded-md border transition-colors ${
                      logDate === yesterdayStr()
                        ? 'bg-amber-400/15 border-amber-400/40 text-amber-200'
                        : 'border-white/10 text-white/50 hover:text-white/80'
                    }`}
                  >
                    Yesterday
                  </button>
                  <input
                    type="date"
                    max={todayStr()}
                    value={logDate}
                    onChange={(e) => e.target.value && setLogDate(e.target.value)}
                    className="text-[11px] bg-black/30 border border-white/10 rounded-md px-2 py-1 text-white/70 focus:outline-none focus:border-amber-400/40 ml-auto"
                    aria-label="Pick a date to log to"
                  />
                </div>
                {logDate !== todayStr() && (
                  <p className="text-[10px] text-amber-300/80 mb-2 -mt-1">
                    Logging to <span className="font-bold">{logDateLabel(logDate)}</span> — pick Today to switch back.
                  </p>
                )}
                <div className="grid grid-cols-3 gap-2">
                  {LOG_OPTIONS.map((opt, i) => (
                    <motion.button
                      key={opt.href}
                      onClick={() => go(opt.href)}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.04 * i, duration: 0.22, ease: 'easeOut' }}
                      whileTap={{ scale: 0.94 }}
                      className={`flex flex-col items-center gap-1.5 p-4 rounded-xl border ${opt.color} active:scale-95 transition-all`}
                    >
                      <opt.icon size={22} />
                      <span className="text-[11px] font-semibold text-white">{opt.label}</span>
                    </motion.button>
                  ))}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <nav
        className={`flex-shrink-0 relative z-50 border-t border-white/10 bg-black/95 backdrop-blur-xl safe-bottom transition-opacity ${
          sheetOpen ? 'pointer-events-none opacity-0' : 'opacity-100'
        }`}
      >
        <div className="max-w-md mx-auto relative flex items-center justify-around px-1 py-2">
          {TABS.slice(0, 2).map((t) => <Tab key={t.href} {...t} active={isActive(pathname, t.href)} />)}

          {/* center FAB cutout */}
          <div className="w-14" aria-hidden />

          {TABS.slice(2).map((t) => <Tab key={t.href} {...t} active={isActive(pathname, t.href)} />)}

          <button
            onClick={open}
            className="absolute left-1/2 -translate-x-1/2 -top-6 w-14 h-14 rounded-full bg-amber-400 text-black shadow-xl shadow-amber-400/30 flex items-center justify-center hover:bg-amber-300 active:scale-95 transition-all border-4 border-zinc-950"
            aria-label="Open log menu"
          >
            <Plus size={26} strokeWidth={2.5} />
          </button>
        </div>
      </nav>
    </>
  )
}

function isActive(pathname: string | null, href: string) {
  if (href === '/') return pathname === '/'
  return pathname === href || (pathname?.startsWith(href + '/') ?? false)
}

function Tab({ href, icon: Icon, label, active }: { href: string; icon: typeof Home; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      onClick={haptic}
      className={`relative flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-colors min-w-[60px] ${
        active ? 'text-amber-400' : 'text-white/40 hover:text-white/70'
      }`}
    >
      <Icon size={20} strokeWidth={active ? 2.5 : 1.5} />
      <span className="text-[10px] font-medium">{label}</span>
      {active && (
        <motion.span
          layoutId="nav-underline"
          className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 h-0.5 w-6 rounded-full bg-amber-400"
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        />
      )}
    </Link>
  )
}
