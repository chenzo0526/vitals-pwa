'use client'

import { motion } from 'framer-motion'
import { type LucideIcon } from 'lucide-react'

export function EmptyState({
  icon: Icon,
  title,
  body,
  cta,
  accent = 'amber',
}: {
  icon: LucideIcon
  title: string
  body: string
  cta?: { label: string; onClick?: () => void; href?: string }
  accent?: 'amber' | 'cyan' | 'violet' | 'rose' | 'emerald'
}) {
  const ring = {
    amber: 'border-amber-400/30 text-amber-300 bg-amber-500/5',
    cyan: 'border-cyan-400/30 text-cyan-300 bg-cyan-500/5',
    violet: 'border-violet-400/30 text-violet-300 bg-violet-500/5',
    rose: 'border-rose-400/30 text-rose-300 bg-rose-500/5',
    emerald: 'border-emerald-400/30 text-emerald-300 bg-emerald-500/5',
  }[accent]

  const ctaCls = {
    amber: 'bg-amber-400 text-black hover:bg-amber-300',
    cyan: 'bg-cyan-400 text-black hover:bg-cyan-300',
    violet: 'bg-violet-400 text-black hover:bg-violet-300',
    rose: 'bg-rose-400 text-black hover:bg-rose-300',
    emerald: 'bg-emerald-400 text-black hover:bg-emerald-300',
  }[accent]

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center"
    >
      <div className={`w-14 h-14 mx-auto rounded-2xl border flex items-center justify-center ${ring}`}>
        <Icon size={26} />
      </div>
      <p className="mt-4 text-sm font-semibold text-white">{title}</p>
      <p className="mt-1.5 text-xs text-white/50 leading-relaxed max-w-[280px] mx-auto">{body}</p>
      {cta && (
        cta.href ? (
          <a
            href={cta.href}
            className={`inline-flex mt-4 px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${ctaCls}`}
          >
            {cta.label}
          </a>
        ) : (
          <button
            onClick={cta.onClick}
            className={`inline-flex mt-4 px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${ctaCls}`}
          >
            {cta.label}
          </button>
        )
      )}
    </motion.div>
  )
}
