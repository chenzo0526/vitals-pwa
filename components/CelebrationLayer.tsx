'use client'

import { useEffect, useRef, useState } from 'react'
import CelebrationBurst, { type BurstKind } from './CelebrationBurst'
import { subscribeCelebrate } from '@/lib/celebrate'

/**
 * Single global mount. Listens to celebrate.* calls from anywhere in the app
 * and renders one burst at a time. Drop <CelebrationLayer /> once in the root
 * layout — save sites then just call celebrate.food() / .lift() / .pr() etc.
 */
export default function CelebrationLayer() {
  const [active, setActive] = useState<BurstKind | null>(null)
  const queueRef = useRef<BurstKind[]>([])

  useEffect(() => {
    const unsub = subscribeCelebrate((kind) => {
      if (active) {
        queueRef.current.push(kind)
      } else {
        setActive(kind)
      }
    })
    return unsub
  }, [active])

  function onDone() {
    const next = queueRef.current.shift() ?? null
    setActive(next)
  }

  return <CelebrationBurst show={!!active} kind={active ?? 'food'} onDone={onDone} />
}
