'use client'

// Legacy entrypoint — kept for backward compat. Now routes through the
// unified CelebrationLayer (food emoji shower instead of generic confetti).
// New code should import { celebrate } from '@/lib/celebrate' directly.

import { celebrate } from './celebrate'

export function celebrateConfetti() {
  celebrate.food()
}
