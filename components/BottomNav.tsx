'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Camera, ScanLine, Mic, Dumbbell, TrendingUp, History } from 'lucide-react'

const tabs = [
  { href: '/', icon: Home, label: 'Home' },
  { href: '/food', icon: Camera, label: 'Food' },
  { href: '/label', icon: ScanLine, label: 'Label' },
  { href: '/voice', icon: Mic, label: 'Voice' },
  { href: '/workout', icon: Dumbbell, label: 'Lift' },
  { href: '/progress', icon: TrendingUp, label: 'Body' },
  { href: '/history', icon: History, label: 'Log' },
]

export default function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/10 bg-black/80 backdrop-blur-md safe-bottom">
      <div className="max-w-md mx-auto flex items-center justify-around px-1 py-2">
        {tabs.map(({ href, icon: Icon, label }) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl transition-colors min-w-[44px] ${
                active
                  ? 'text-amber-400'
                  : 'text-white/40 hover:text-white/70'
              }`}
            >
              <Icon size={20} strokeWidth={active ? 2.5 : 1.5} />
              <span className="text-[10px] font-medium">{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
