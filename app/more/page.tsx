'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Droplet, Brain, Sliders, CreditCard, Camera, Mic, ScanLine, Dumbbell,
  TrendingUp, History, FileText, Shield, Sparkles, ChevronRight,
} from 'lucide-react'
import { isTrialing, trialDaysLeft } from '@/lib/tier'

type Profile = { tier: 'free' | 'pro' | 'premium'; display_name: string | null; trial_ends_at: string | null }

const SECTIONS = [
  {
    title: 'Health intelligence',
    items: [
      { href: '/bloodwork', icon: Droplet, label: 'Bloodwork', desc: 'Upload labs · AI extraction', accent: 'rose' },
      { href: '/rediagnosis', icon: Brain, label: 'Rediagnosis', desc: 'Weekly AI review', accent: 'violet' },
      { href: '/custom-metrics', icon: Sliders, label: 'Custom Metrics', desc: 'Track anything', accent: 'amber' },
    ],
  },
  {
    title: 'Quick log',
    items: [
      { href: '/food', icon: Camera, label: 'Snap Plate', desc: 'Food vision', accent: 'amber' },
      { href: '/label', icon: ScanLine, label: 'Scan Label', desc: 'Nutrition OCR', accent: 'cyan' },
      { href: '/voice', icon: Mic, label: 'Log Voice', desc: 'Speak to log', accent: 'violet' },
      { href: '/workout', icon: Dumbbell, label: 'Lift', desc: 'Sets, reps, RPE', accent: 'green' },
      { href: '/progress', icon: TrendingUp, label: 'Body Check', desc: 'Physique photo', accent: 'rose' },
      { href: '/history', icon: History, label: 'History', desc: 'All logs', accent: 'cyan' },
    ],
  },
  {
    title: 'Account',
    items: [
      { href: '/billing', icon: CreditCard, label: 'Billing & Plan', desc: 'Subscription, payment', accent: 'amber' },
      { href: '/onboarding', icon: Sparkles, label: 'Replay onboarding', desc: 'Re-do the setup wizard', accent: 'violet' },
      { href: '/terms', icon: FileText, label: 'Terms of Service', desc: '', accent: 'slate' },
      { href: '/privacy', icon: Shield, label: 'Privacy Policy', desc: '', accent: 'slate' },
    ],
  },
] as const

const ACCENT: Record<string, string> = {
  amber: 'bg-amber-500/10 border-amber-400/30 text-amber-300',
  cyan: 'bg-cyan-500/10 border-cyan-400/30 text-cyan-300',
  violet: 'bg-violet-500/10 border-violet-400/30 text-violet-300',
  rose: 'bg-rose-500/10 border-rose-400/30 text-rose-300',
  green: 'bg-green-500/10 border-green-400/30 text-green-300',
  slate: 'bg-slate-500/10 border-slate-400/30 text-slate-300',
}

export default function MorePage() {
  const [profile, setProfile] = useState<Profile | null>(null)

  useEffect(() => {
    supabase.from('user_profile').select('tier, display_name, trial_ends_at').single()
      .then(({ data }) => data && setProfile(data as Profile))
  }, [])

  const trial = isTrialing(profile as any)
  const days = trialDaysLeft(profile as any)

  return (
    <div className="px-4 pt-6 pb-12 space-y-5">
      {/* Profile header */}
      <Card className="border-amber-400/20 bg-gradient-to-br from-amber-400/5 via-violet-400/5 to-cyan-400/5">
        <CardContent className="p-4 flex items-center justify-between">
          <div>
            <p className="text-sm text-white/60">{profile?.display_name || 'Welcome'}</p>
            <p className="text-2xl font-bold capitalize">{profile?.tier || 'free'} <span className="text-xs text-white/40">tier</span></p>
            {trial && <p className="text-[11px] text-amber-300 mt-0.5">{days}d trial left</p>}
          </div>
          {(!profile || profile.tier !== 'premium') && (
            <Link href="/billing" className="text-xs px-3 py-1.5 rounded-md bg-amber-400 text-black hover:bg-amber-300 font-medium">
              Upgrade
            </Link>
          )}
        </CardContent>
      </Card>

      {SECTIONS.map(section => (
        <div key={section.title}>
          <p className="text-xs uppercase tracking-wider text-white/40 mb-2">{section.title}</p>
          <div className="space-y-1.5">
            {section.items.map(item => (
              <Link
                key={item.href}
                href={item.href}
                className="block"
              >
                <Card className="border-white/10 bg-white/5 hover:bg-white/10 transition-colors">
                  <CardContent className="p-3 flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-lg border flex items-center justify-center ${ACCENT[item.accent]}`}>
                      <item.icon size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{item.label}</p>
                      {item.desc && <p className="text-[11px] text-white/40">{item.desc}</p>}
                    </div>
                    <ChevronRight size={16} className="text-white/30" />
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
