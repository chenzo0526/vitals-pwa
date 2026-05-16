'use client'

import confetti from 'canvas-confetti'

/** Quick confetti burst — keep under 1.2s total so it doesn't fight UI. */
export function celebrateConfetti() {
  if (typeof window === 'undefined') return
  confetti({
    particleCount: 70,
    spread: 70,
    startVelocity: 45,
    decay: 0.92,
    scalar: 0.9,
    origin: { x: 0.5, y: 0.7 },
    colors: ['#fbbf24', '#06b6d4', '#a78bfa', '#34d399', '#f43f5e'],
    disableForReducedMotion: true,
  })
}
