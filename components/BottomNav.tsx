'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Home, FlaskConical, Sparkles, MoreHorizontal, Plus, Camera, Mic, ScanLine, Dumbbell, TrendingUp, X } from 'lucide-react'

const TABS = [
  { href: '/', icon: Home, label: 'Home' },
  { href: '/substances', icon: FlaskConical, label: 'Stack' },
  // FAB sits between Stack and Practices
  { href: '/practices', icon: Sparkles, label: 'Practices' },
  { href: '/more', icon: MoreHorizontal, label: 'More' },
]

const LOG_OPTIONS = [
  { href: '/food', icon: Camera, label: 'Snap Plate', color: 'bg-amber-500/15 border-amber-400/40 text-amber-300' },
  { href: '/voice', icon: Mic, label: 'Voice', color: 'bg-violet-500/15 border-violet-400/40 text-violet-300' },
  { href: '/label', icon: ScanLine, label: 'Scan Label', color: 'bg-cyan-500/15 border-cyan-400/40 text-cyan-300' },
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

  if (
    pathname === '/login' ||
    pathname === '/onboarding' ||
    pathname?.startsWith('/auth/callback')
  ) return null

  function open() {
    haptic()
    setSheetOpen(true)
  }

  function close() {
    setSheetOpen(false)
  }

  function go(href: string) {
    haptic()
    setSheetOpen(false)
    router.push(href)
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
              className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
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
              className="fixed left-0 right-0 bottom-0 z-50 safe-bottom"
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

      <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-white/10 bg-black/85 backdrop-blur-md safe-bottom">
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
