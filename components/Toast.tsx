'use client'

import { useEffect } from 'react'
import { AlertTriangle, Check, X } from 'lucide-react'

export type ToastKind = 'success' | 'error'

export type ToastMsg = {
  kind: ToastKind
  text: string
  id: number
}

export function Toast({ msg, onDismiss }: { msg: ToastMsg | null; onDismiss: () => void }) {
  useEffect(() => {
    if (!msg) return
    const t = setTimeout(onDismiss, msg.kind === 'error' ? 6000 : 2400)
    return () => clearTimeout(t)
  }, [msg, onDismiss])

  if (!msg) return null

  const styles = msg.kind === 'success'
    ? 'bg-green-500/15 border-green-400/40 text-green-200'
    : 'bg-rose-500/15 border-rose-400/40 text-rose-200'

  return (
    <div className="fixed top-4 left-0 right-0 z-50 px-4 pointer-events-none">
      <div className="max-w-md mx-auto pointer-events-auto">
        <div className={`flex items-start gap-2 rounded-lg border ${styles} px-3 py-2.5 shadow-lg backdrop-blur-md`}>
          {msg.kind === 'success'
            ? <Check size={14} className="flex-shrink-0 mt-0.5" />
            : <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />}
          <p className="text-xs flex-1 leading-snug">{msg.text}</p>
          <button onClick={onDismiss} className="opacity-60 hover:opacity-100">
            <X size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}
