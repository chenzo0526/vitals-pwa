'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, X, ChevronRight, History, Dumbbell } from 'lucide-react'
import { EXERCISE_LIBRARY, CATEGORY_LABELS, searchExercises, groupedByCategory, type ExerciseCategory, type ExerciseDef } from '@/lib/exerciseLibrary'

export default function ExercisePicker({
  open, onClose, onPick, recentNames,
}: {
  open: boolean
  onClose: () => void
  onPick: (name: string) => void
  recentNames: string[]   // from user's own workout history
}) {
  const [query, setQuery] = useState('')
  const [openCategory, setOpenCategory] = useState<ExerciseCategory | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setQuery('')
      setOpenCategory(null)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [open])

  const searchResults = useMemo(() => (query ? searchExercises(query, 20) : []), [query])
  const grouped = useMemo(() => groupedByCategory(), [])

  // Recents — match user's previous names to library where possible, otherwise show raw
  const recents = useMemo(() => {
    const out: Array<{ display: string; canonical: string }> = []
    const seen = new Set<string>()
    for (const r of recentNames) {
      const key = r.trim().toLowerCase()
      if (!key || seen.has(key)) continue
      seen.add(key)
      const matched = EXERCISE_LIBRARY.find(ex =>
        ex.name.toLowerCase() === key || ex.aliases.some(a => a.toLowerCase() === key)
      )
      out.push({ display: matched?.name || r.trim(), canonical: matched?.name || r.trim() })
      if (out.length >= 8) break
    }
    return out
  }, [recentNames])

  function pick(name: string) {
    onPick(name)
    onClose()
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[65] bg-black/70 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 360, damping: 32 }}
            className="fixed left-0 right-0 bottom-0 top-12 z-[70] safe-bottom flex flex-col"
          >
            <div className="max-w-md mx-auto w-full bg-zinc-950 border-t border-x border-white/10 rounded-t-3xl flex flex-col flex-1 overflow-hidden">
              {/* Drag handle */}
              <div className="flex justify-center pt-2 pb-1 flex-shrink-0">
                <div className="w-10 h-1 rounded-full bg-white/20" />
              </div>

              {/* Header */}
              <div className="px-4 pt-1 pb-3 flex items-center justify-between flex-shrink-0">
                <h2 className="text-base font-bold text-white">Pick exercise</h2>
                <button onClick={onClose} className="text-white/40 hover:text-white/80">
                  <X size={20} />
                </button>
              </div>

              {/* Search */}
              <div className="px-4 pb-3 flex-shrink-0">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                  <input
                    ref={inputRef}
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search — bench, RDL, lateral raise, hack squat…"
                    className="w-full bg-black/30 border border-white/10 rounded-md pl-9 pr-9 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-amber-400/50"
                  />
                  {query && (
                    <button onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/80">
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>

              {/* Scrollable content */}
              <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-4">
                {/* Search results */}
                {query && (
                  <div>
                    {searchResults.length === 0 ? (
                      <div className="py-6 text-center">
                        <p className="text-xs text-white/40">No matches for &quot;{query}&quot;</p>
                        <button
                          onClick={() => pick(query.trim())}
                          className="mt-3 text-xs uppercase tracking-wider font-bold px-3 py-2 rounded-md bg-amber-400/15 border border-amber-400/40 text-amber-200 hover:bg-amber-400/25"
                        >
                          + Add as custom: &quot;{query.trim()}&quot;
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        {searchResults.map((ex) => <ExerciseRow key={ex.name} ex={ex} onPick={pick} />)}
                      </div>
                    )}
                  </div>
                )}

                {/* Recents (no query) */}
                {!query && recents.length > 0 && (
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-white/40 font-bold mb-1.5 flex items-center gap-1">
                      <History size={11} /> Recent
                    </p>
                    <div className="space-y-1">
                      {recents.map((r) => (
                        <button
                          key={r.display}
                          onClick={() => pick(r.canonical)}
                          className="w-full text-left flex items-center justify-between p-2.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 hover:border-amber-400/30"
                        >
                          <p className="text-sm font-medium text-white">{r.display}</p>
                          <ChevronRight size={14} className="text-white/30" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Categories (no query) */}
                {!query && (
                  <div className="space-y-1.5">
                    {grouped.map(([cat, exercises]) => {
                      const isOpen = openCategory === cat
                      return (
                        <div key={cat} className="rounded-lg border border-white/10 bg-white/5 overflow-hidden">
                          <button
                            onClick={() => setOpenCategory(isOpen ? null : cat)}
                            className="w-full flex items-center justify-between p-3 hover:bg-white/5"
                          >
                            <div className="flex items-center gap-2">
                              <Dumbbell size={14} className="text-amber-400" />
                              <p className="text-sm font-medium text-white">{CATEGORY_LABELS[cat]}</p>
                              <span className="text-[10px] text-white/40 tabular-nums">{exercises.length}</span>
                            </div>
                            <ChevronRight size={14} className={`text-white/40 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                          </button>
                          {isOpen && (
                            <div className="border-t border-white/5 p-2 space-y-0.5">
                              {exercises.map((ex) => <ExerciseRow key={ex.name} ex={ex} onPick={pick} compact />)}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Manual "add custom" affordance at bottom when not searching */}
                {!query && (
                  <div className="pt-2 border-t border-white/5">
                    <p className="text-[10px] uppercase tracking-wider text-white/40 mb-1.5">Don&apos;t see your lift?</p>
                    <button
                      onClick={() => inputRef.current?.focus()}
                      className="w-full text-left p-2.5 rounded-lg border border-dashed border-white/15 text-white/60 hover:border-amber-400/30 hover:text-amber-300 text-xs"
                    >
                      Search above to add a custom name
                    </button>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

function ExerciseRow({ ex, onPick, compact }: { ex: ExerciseDef; onPick: (n: string) => void; compact?: boolean }) {
  return (
    <button
      onClick={() => onPick(ex.name)}
      className={`w-full text-left flex items-center justify-between rounded-md hover:bg-white/10 transition-colors ${compact ? 'p-2' : 'p-2.5 border border-white/10 bg-white/[0.03]'}`}
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-white">{ex.name}</p>
        <p className="text-[10px] text-white/40 mt-0.5">
          {ex.primary_muscles.slice(0, 3).join(' · ')}
          {ex.level !== 'beginner' && <span className="ml-1.5 px-1 py-0.5 rounded bg-white/10 text-[9px] uppercase">{ex.level}</span>}
        </p>
      </div>
      <ChevronRight size={12} className="text-white/30 flex-shrink-0" />
    </button>
  )
}
