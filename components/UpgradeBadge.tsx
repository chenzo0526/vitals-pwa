'use client'

import Link from 'next/link'
import { Lock, Sparkles } from 'lucide-react'

export function UpgradeBadge({
  tier = 'pro',
  feature,
  className = '',
}: {
  tier?: 'pro' | 'premium'
  feature: string
  className?: string
}) {
  return (
    <Link
      href="/billing"
      className={`inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-md border border-amber-400/30 bg-amber-400/10 text-amber-300 hover:bg-amber-400/20 transition-colors ${className}`}
    >
      <Lock size={11} />
      <span>Upgrade to {tier === 'premium' ? 'Premium' : 'Pro'} for {feature}</span>
    </Link>
  )
}

export function InlineUpgradeCard({
  title,
  description,
  tier = 'pro',
}: {
  title: string
  description: string
  tier?: 'pro' | 'premium'
}) {
  return (
    <div className="rounded-xl border border-amber-400/30 bg-gradient-to-br from-amber-400/10 via-violet-400/5 to-cyan-400/10 p-4">
      <div className="flex items-start gap-3">
        <Sparkles className="text-amber-400 mt-0.5" size={20} />
        <div className="flex-1">
          <p className="font-semibold text-white text-sm">{title}</p>
          <p className="text-white/60 text-xs mt-1 leading-snug">{description}</p>
          <Link
            href="/billing"
            className="inline-block mt-3 text-xs font-medium px-3 py-1.5 rounded-md bg-amber-400 text-black hover:bg-amber-300 transition-colors"
          >
            {tier === 'premium' ? 'Upgrade to Premium' : 'Try Pro free for 14 days'}
          </Link>
        </div>
      </div>
    </div>
  )
}
