'use client'

import { AnimatePresence, motion, type PanInfo } from 'framer-motion'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, CheckCircle2, Info, RefreshCw, X, XCircle } from 'lucide-react'

export type ToastKind = 'success' | 'error' | 'warning' | 'info'

export type ToastMsg = {
  id: number
  kind: ToastKind
  title?: string
  text: string
  /** Optional retry — surfaces a "Retry" button. */
  onRetry?: () => void | Promise<void>
}

type ToastApi = {
  toast: (msg: Omit<ToastMsg, 'id'>) => number
  dismiss: (id: number) => void
}

const ToastContext = createContext<ToastApi | null>(null)

/** Hook for any client component to push a toast. Wrap the app root in <ToastProvider/>. */
export function useToast(): ToastApi {
  const ctx = useContext(ToastContext)
  if (ctx) return ctx
  // Fallback no-op in case provider not mounted (server render etc.)
  return {
    toast: () => 0,
    dismiss: () => {},
  }
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [stack, setStack] = useState<ToastMsg[]>([])
  const idRef = useRef(1)

  const dismiss = useCallback((id: number) => {
    setStack((s) => s.filter((t) => t.id !== id))
  }, [])

  const toast = useCallback((msg: Omit<ToastMsg, 'id'>) => {
    const id = idRef.current++
    setStack((s) => [...s, { ...msg, id }])
    const ttl = msg.kind === 'error' ? 6000 : 3000
    setTimeout(() => dismiss(id), ttl)
    return id
  }, [dismiss])

  const api = useMemo<ToastApi>(() => ({ toast, dismiss }), [toast, dismiss])

  return (
    <ToastContext.Provider value={api}>
      {children}
      <ToastViewport stack={stack} dismiss={dismiss} />
    </ToastContext.Provider>
  )
}

function ToastViewport({ stack, dismiss }: { stack: ToastMsg[]; dismiss: (id: number) => void }) {
  return (
    <div className="fixed left-0 right-0 z-[100] pointer-events-none px-4"
         style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 96px)' }}>
      <div className="max-w-md mx-auto flex flex-col gap-2 pointer-events-none">
        <AnimatePresence initial={false}>
          {stack.map((t) => (
            <ToastItem key={t.id} msg={t} onDismiss={() => dismiss(t.id)} />
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}

function ToastItem({ msg, onDismiss }: { msg: ToastMsg; onDismiss: () => void }) {
  const [retrying, setRetrying] = useState(false)

  const palette = {
    success: { ring: 'border-emerald-400/50', bg: 'bg-emerald-500/15', text: 'text-emerald-100', glyph: 'text-emerald-300' },
    error:   { ring: 'border-rose-400/50',    bg: 'bg-rose-500/15',    text: 'text-rose-100',    glyph: 'text-rose-300' },
    warning: { ring: 'border-amber-400/50',   bg: 'bg-amber-500/15',   text: 'text-amber-100',   glyph: 'text-amber-300' },
    info:    { ring: 'border-cyan-400/50',    bg: 'bg-cyan-500/15',    text: 'text-cyan-100',    glyph: 'text-cyan-300' },
  }[msg.kind]

  const Icon = {
    success: CheckCircle2,
    error: XCircle,
    warning: AlertTriangle,
    info: Info,
  }[msg.kind]

  function handleDragEnd(_e: unknown, info: PanInfo) {
    if (Math.abs(info.offset.x) > 80 || Math.abs(info.velocity.x) > 500) onDismiss()
  }

  async function retry() {
    if (!msg.onRetry || retrying) return
    setRetrying(true)
    try {
      await msg.onRetry()
    } finally {
      setRetrying(false)
      onDismiss()
    }
  }

  return (
    <motion.div
      layout
      initial={{ y: 60, opacity: 0, scale: 0.96 }}
      animate={{ y: 0, opacity: 1, scale: 1 }}
      exit={{ y: 20, opacity: 0, scale: 0.96, transition: { duration: 0.18 } }}
      transition={{ type: 'spring', stiffness: 380, damping: 28 }}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.4}
      onDragEnd={handleDragEnd}
      className={`pointer-events-auto rounded-xl border ${palette.ring} ${palette.bg} backdrop-blur-xl shadow-lg shadow-black/30 px-3 py-2.5`}
    >
      <div className="flex items-start gap-2.5">
        <Icon size={16} className={`${palette.glyph} mt-0.5 flex-shrink-0`} />
        <div className="flex-1 min-w-0">
          {msg.title && <p className={`text-sm font-semibold ${palette.text}`}>{msg.title}</p>}
          <p className={`text-xs leading-snug ${palette.text} ${msg.title ? 'opacity-80 mt-0.5' : ''}`}>
            {msg.text}
          </p>
          {msg.onRetry && (
            <button
              onClick={retry}
              disabled={retrying}
              className={`mt-1.5 text-[11px] font-semibold inline-flex items-center gap-1 ${palette.glyph} hover:underline disabled:opacity-50`}
            >
              <RefreshCw size={11} className={retrying ? 'animate-spin' : ''} />
              {retrying ? 'Retrying…' : 'Retry'}
            </button>
          )}
        </div>
        <button onClick={onDismiss} className="opacity-50 hover:opacity-100 transition-opacity">
          <X size={14} />
        </button>
      </div>
    </motion.div>
  )
}

// ─── Backward-compat shim ────────────────────────────────────────────────────
// Older pages use <Toast msg={...} onDismiss={...} />. Keep them working until
// they migrate to useToast().
export function Toast({ msg, onDismiss }: { msg: ToastMsg | null; onDismiss: () => void }) {
  useEffect(() => {
    if (!msg) return
    const t = setTimeout(onDismiss, msg.kind === 'error' ? 6000 : 2400)
    return () => clearTimeout(t)
  }, [msg, onDismiss])

  if (!msg) return null

  return (
    <div className="fixed left-0 right-0 z-50 px-4 pointer-events-none"
         style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 96px)' }}>
      <div className="max-w-md mx-auto pointer-events-auto">
        <ToastItem msg={msg} onDismiss={onDismiss} />
      </div>
    </div>
  )
}
