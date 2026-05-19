'use client'

import { useEffect, useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

export type BurstKind =
  | 'food'         // emoji shower for meal/food/water logs
  | 'lift'         // dumbbell + flex on workout save
  | 'pr'           // PR detection — fire + trophy storm
  | 'goal'         // calorie / macro / streak goal hit
  | 'baseline'     // body check / first-time baseline locked
  | 'streak'       // streak fire animation

const EMOJI: Record<BurstKind, string[]> = {
  food:     ['🍎', '🥩', '🥚', '🥑', '🍌', '🥦', '🍗', '🐟', '🥛', '🍚', '🌶️', '🍓'],
  lift:     ['💪', '🏋️', '🔥', '⚡', '🦾', '🥵'],
  pr:       ['🏆', '🔥', '⚡', '💥', '🚀', '👑', '💯'],
  goal:     ['🎯', '✅', '💯', '⭐', '🚀'],
  baseline: ['📸', '✨', '⚡', '💎', '🔒'],
  streak:   ['🔥', '⚡', '💯', '🚀'],
}

const BURST_COUNT: Record<BurstKind, number> = {
  food: 14,
  lift: 12,
  pr: 22,
  goal: 16,
  baseline: 10,
  streak: 14,
}

const DURATION_MS: Record<BurstKind, number> = {
  food: 1500,
  lift: 1400,
  pr: 2200,
  goal: 1600,
  baseline: 1500,
  streak: 1400,
}

/**
 * Fires a one-shot burst of themed emoji that rise from the bottom (or center
 * for PR) and fade. Mount when `show` flips to true; auto-unmounts after
 * the animation completes via onComplete.
 *
 * Use it imperatively: keep a `burst: BurstKind | null` state, set it on
 * save success, render <CelebrationBurst show={!!burst} kind={burst!} onDone={() => setBurst(null)} />.
 */
export default function CelebrationBurst({
  show, kind, onDone,
}: { show: boolean; kind: BurstKind; onDone?: () => void }) {
  const [particles, setParticles] = useState<Array<{
    id: number
    emoji: string
    x: number
    y0: number
    yEnd: number
    rotate: number
    scale: number
    delay: number
  }> | null>(null)

  useEffect(() => {
    if (!show) {
      setParticles(null)
      return
    }
    const pool = EMOJI[kind]
    const n = BURST_COUNT[kind]
    const isCenterBurst = kind === 'pr' || kind === 'baseline'
    const list = Array.from({ length: n }).map((_, i) => ({
      id: i,
      emoji: pool[Math.floor(Math.random() * pool.length)],
      x: isCenterBurst
        ? (Math.random() - 0.5) * 320 // spread laterally from center
        : Math.random() * 100, // % across full viewport width
      y0: isCenterBurst ? 0 : 100, // %  (bottom)
      yEnd: isCenterBurst ? -180 : -110,
      rotate: (Math.random() - 0.5) * 540,
      scale: 0.85 + Math.random() * 0.6,
      delay: Math.random() * 0.25,
    }))
    setParticles(list)
    const t = setTimeout(() => {
      setParticles(null)
      onDone?.()
    }, DURATION_MS[kind] + 350)
    return () => clearTimeout(t)
  }, [show, kind, onDone])

  const labelMeta = useMemo(() => {
    switch (kind) {
      case 'pr':       return { text: 'NEW PR', color: 'text-amber-300', glow: 'drop-shadow-[0_0_24px_rgba(252,211,77,0.6)]' }
      case 'goal':     return { text: 'GOAL HIT', color: 'text-emerald-300', glow: 'drop-shadow-[0_0_18px_rgba(110,231,183,0.6)]' }
      case 'baseline': return { text: 'BASELINE LOCKED', color: 'text-cyan-300', glow: 'drop-shadow-[0_0_18px_rgba(103,232,249,0.55)]' }
      default:         return null
    }
  }, [kind])

  if (!particles) return null

  const isCenterBurst = kind === 'pr' || kind === 'baseline'

  return (
    <div
      className="fixed inset-0 z-[100] pointer-events-none overflow-hidden"
      aria-hidden="true"
    >
      <AnimatePresence>
        {particles.map((p) => (
          <motion.div
            key={p.id}
            className="absolute text-2xl select-none"
            style={
              isCenterBurst
                ? { left: '50%', top: '50%' }
                : { left: `${p.x}%`, bottom: 0 }
            }
            initial={{
              x: isCenterBurst ? 0 : 0,
              y: isCenterBurst ? 0 : 0,
              opacity: 0,
              scale: 0.4,
              rotate: 0,
            }}
            animate={{
              x: isCenterBurst ? p.x : 0,
              y: isCenterBurst ? p.yEnd : `-${100 + Math.random() * 40}vh`,
              opacity: [0, 1, 1, 0],
              scale: p.scale,
              rotate: p.rotate,
            }}
            transition={{
              duration: DURATION_MS[kind] / 1000,
              delay: p.delay,
              ease: [0.2, 0.65, 0.4, 1],
              times: [0, 0.1, 0.8, 1],
            }}
          >
            {p.emoji}
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Center label flash for high-impact bursts */}
      {labelMeta && (
        <motion.div
          className="absolute inset-0 flex items-center justify-center"
          initial={{ opacity: 0, scale: 0.7 }}
          animate={{ opacity: [0, 1, 1, 0], scale: [0.7, 1.1, 1, 0.95] }}
          transition={{ duration: (DURATION_MS[kind] - 200) / 1000, times: [0, 0.15, 0.7, 1], ease: 'easeOut' }}
        >
          <p className={`text-3xl font-black uppercase tracking-wider ${labelMeta.color} ${labelMeta.glow}`}>
            {labelMeta.text}
          </p>
        </motion.div>
      )}
    </div>
  )
}
