'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { TIER_PRICES_DISPLAY } from '@/lib/stripe'
import { Check, Sparkles, Crown, Loader2, AlertTriangle } from 'lucide-react'
import { UserProfile, isTrialing, trialDaysLeft } from '@/lib/tier'

const FEATURES = {
  free: [
    'Basic logging',
    '7-day history',
    'Up to 3 substances',
    'Basic image-based food logging (30/mo cap)',
  ],
  pro: [
    'Everything in Free',
    'Standard AI insights — weekly cadence',
    '3 bloodwork uploads/yr',
    'Unlimited substances',
    'Unlimited history',
    'Unlimited image-based food logging with detailed macro breakdown',
  ],
  premium: [
    'Everything in Pro',
    'Monthly deep-dive AI analysis',
    'Daily AI nudges',
    'Advanced body composition insights',
    'Unlimited bloodwork',
  ],
}

export default function BillingPage() {
  return (
    <Suspense fallback={<div className="px-4 pt-6"><p className="text-white/40">Loading billing…</p></div>}>
      <BillingInner />
    </Suspense>
  )
}

function BillingInner() {
  const params = useSearchParams()
  const success = params.get('success')
  const canceled = params.get('canceled')
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [interval, setInterval] = useState<'monthly' | 'yearly'>('monthly')
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase.from('user_profile').select('*').single()
    if (data) setProfile(data as UserProfile)
  }

  async function checkout(tier: 'pro' | 'premium') {
    setLoading(tier)
    setError(null)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier, interval }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Checkout failed')
      if (data.url) window.location.href = data.url
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed')
    } finally {
      setLoading(null)
    }
  }

  async function manageSubscription() {
    setLoading('portal')
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Portal failed')
      if (data.url) window.location.href = data.url
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed')
    } finally {
      setLoading(null)
    }
  }

  const currentTier = profile?.tier || 'free'
  const trial = isTrialing(profile)
  const daysLeft = trialDaysLeft(profile)

  return (
    <div className="px-4 pt-6 space-y-5 pb-12">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Billing</h1>
        <p className="text-xs text-white/40 mt-0.5">Plan, payment, and limits</p>
      </div>

      {success && (
        <div className="text-xs text-green-300 bg-green-500/10 border border-green-400/30 rounded-md p-3">
          ✓ Subscription confirmed. Your tier will update once the webhook processes.
        </div>
      )}
      {canceled && (
        <div className="text-xs text-amber-300 bg-amber-500/10 border border-amber-400/30 rounded-md p-3">
          Checkout canceled. Nothing was charged.
        </div>
      )}
      {error && (
        <div className="text-xs text-rose-300 bg-rose-500/10 border border-rose-400/30 rounded-md p-3 flex items-start gap-1.5">
          <AlertTriangle size={12} className="mt-0.5" /><span>{error}</span>
        </div>
      )}

      {/* Current state */}
      <Card className="border-amber-400/20 bg-gradient-to-br from-amber-400/5 via-violet-400/5 to-cyan-400/5">
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wider text-white/40">Current plan</p>
              <p className="text-2xl font-bold capitalize">{currentTier}</p>
            </div>
            <Badge variant="outline" className="border-amber-400/30 text-amber-300 capitalize">
              {profile?.subscription_status || (trial ? 'trial' : 'active')}
            </Badge>
          </div>
          {trial && (
            <p className="text-xs text-amber-300">
              {daysLeft} day{daysLeft !== 1 ? 's' : ''} left in Pro trial
            </p>
          )}
          {profile?.current_period_end && !trial && (
            <p className="text-xs text-white/50">
              Next bill: {new Date(profile.current_period_end).toLocaleDateString()}
            </p>
          )}
          {profile?.stripe_customer_id && (
            <Button
              onClick={manageSubscription}
              disabled={loading === 'portal'}
              variant="outline"
              className="border-white/20 mt-1"
            >
              {loading === 'portal' ? <Loader2 className="animate-spin" size={14} /> : null}
              Manage subscription
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Interval toggle */}
      <div className="flex gap-1 p-1 bg-white/5 rounded-lg w-fit mx-auto">
        <button
          onClick={() => setInterval('monthly')}
          className={`px-4 py-1.5 text-xs rounded-md transition-colors ${interval === 'monthly' ? 'bg-amber-400 text-black font-medium' : 'text-white/60'}`}
        >
          Monthly
        </button>
        <button
          onClick={() => setInterval('yearly')}
          className={`px-4 py-1.5 text-xs rounded-md transition-colors ${interval === 'yearly' ? 'bg-amber-400 text-black font-medium' : 'text-white/60'}`}
        >
          Yearly · save ~17%
        </button>
      </div>

      {/* Plans */}
      <PlanCard
        name="Free" price={0} interval={interval}
        features={FEATURES.free} cta={null} current={currentTier === 'free' && !trial}
      />
      <PlanCard
        name="Pro" price={TIER_PRICES_DISPLAY.pro[interval]} interval={interval}
        features={FEATURES.pro}
        cta={{
          label: trial ? 'Upgrade now' : currentTier === 'pro' ? 'Current' : 'Subscribe',
          disabled: currentTier === 'pro' && !trial,
          loading: loading === 'pro',
          onClick: () => checkout('pro'),
          accent: 'amber',
        }}
        current={currentTier === 'pro' && !trial}
        icon={<Sparkles size={18} className="text-amber-300" />}
      />
      <PlanCard
        name="Premium" price={TIER_PRICES_DISPLAY.premium[interval]} interval={interval}
        features={FEATURES.premium}
        cta={{
          label: currentTier === 'premium' ? 'Current' : 'Subscribe',
          disabled: currentTier === 'premium',
          loading: loading === 'premium',
          onClick: () => checkout('premium'),
          accent: 'violet',
        }}
        current={currentTier === 'premium'}
        icon={<Crown size={18} className="text-violet-300" />}
      />
    </div>
  )
}

function PlanCard({
  name, price, interval, features, cta, current, icon,
}: {
  name: string; price: number; interval: 'monthly' | 'yearly'
  features: string[]; current?: boolean
  icon?: React.ReactNode
  cta: { label: string; disabled: boolean; loading: boolean; onClick: () => void; accent: 'amber' | 'violet' } | null
}) {
  return (
    <Card className={`border bg-white/5 ${current ? 'border-amber-400/50' : 'border-white/10'}`}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {icon}
            <p className="text-lg font-bold">{name}</p>
            {current && <Badge variant="outline" className="border-amber-400/30 text-amber-300 text-[10px]">Current</Badge>}
          </div>
          <div className="text-right">
            <p className="text-xl font-bold">${price}<span className="text-xs text-white/40 font-normal">/{interval === 'monthly' ? 'mo' : 'yr'}</span></p>
          </div>
        </div>
        <ul className="space-y-1">
          {features.map(f => (
            <li key={f} className="text-xs text-white/70 flex items-start gap-1.5">
              <Check size={12} className="text-green-400 mt-0.5 flex-shrink-0" />
              <span>{f}</span>
            </li>
          ))}
        </ul>
        {cta && (
          <Button
            onClick={cta.onClick}
            disabled={cta.disabled || cta.loading}
            className={`w-full ${cta.accent === 'amber'
              ? 'bg-amber-400 text-black hover:bg-amber-300'
              : 'bg-violet-400 text-black hover:bg-violet-300'} disabled:opacity-40`}
          >
            {cta.loading ? <Loader2 className="animate-spin" size={14} /> : null}
            {cta.label}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
