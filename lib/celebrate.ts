'use client'

import type { BurstKind } from '@/components/CelebrationBurst'

type Listener = (kind: BurstKind) => void

const listeners = new Set<Listener>()

export function subscribeCelebrate(l: Listener): () => void {
  listeners.add(l)
  return () => listeners.delete(l)
}

function fire(kind: BurstKind) {
  if (typeof window === 'undefined') return
  // Respect reduced motion
  try {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  } catch { /* noop */ }
  listeners.forEach((l) => {
    try { l(kind) } catch { /* one listener fail shouldn't break others */ }
  })
}

export const celebrate = {
  food:     () => fire('food'),
  lift:     () => fire('lift'),
  pr:       () => fire('pr'),
  goal:     () => fire('goal'),
  baseline: () => fire('baseline'),
  streak:   () => fire('streak'),
}
