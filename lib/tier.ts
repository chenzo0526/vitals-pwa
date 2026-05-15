// Tier gating and feature flags
import { supabase } from './supabase'

export type Tier = 'free' | 'pro' | 'premium'

export const TIER_LIMITS = {
  free: {
    maxSubstances: 3,
    historyDays: 7,
    bloodworkUploadsPerYear: 0,
    foodVisionPerMonth: 30,
    foodVisionModel: 'claude-haiku-4-5-20251001',
    rediagnosisAccess: false,
    rediagnosisModel: null,
    bodyCompositionDeep: false,
    dailyNudges: false,
  },
  pro: {
    maxSubstances: Infinity,
    historyDays: Infinity,
    bloodworkUploadsPerYear: 3,
    foodVisionPerMonth: Infinity,
    foodVisionModel: 'claude-sonnet-4-5',
    rediagnosisAccess: true,
    rediagnosisModel: 'claude-sonnet-4-5',
    bodyCompositionDeep: false,
    dailyNudges: false,
  },
  premium: {
    maxSubstances: Infinity,
    historyDays: Infinity,
    bloodworkUploadsPerYear: Infinity,
    foodVisionPerMonth: Infinity,
    foodVisionModel: 'claude-sonnet-4-5',
    rediagnosisAccess: true,
    rediagnosisModel: 'claude-opus-4-7',
    bodyCompositionDeep: true,
    dailyNudges: true,
  },
} as const

export type UserProfile = {
  id: string
  tier: Tier
  trial_started_at: string | null
  trial_ends_at: string | null
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  subscription_status: string | null
  current_period_end: string | null
  display_name: string | null
  onboarding_completed_at: string | null
}

export async function getUserProfile(): Promise<UserProfile | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase
    .from('user_profile')
    .select('*')
    .eq('id', user.id)
    .single()
  return data as UserProfile | null
}

export function getEffectiveTier(profile: UserProfile | null): Tier {
  if (!profile) return 'free'
  if (profile.trial_ends_at && new Date(profile.trial_ends_at) > new Date() && profile.tier === 'pro') {
    return 'pro'
  }
  return profile.tier
}

export function getLimits(tier: Tier) {
  return TIER_LIMITS[tier]
}

export function isTrialing(profile: UserProfile | null): boolean {
  if (!profile?.trial_ends_at) return false
  return new Date(profile.trial_ends_at) > new Date()
}

export function trialDaysLeft(profile: UserProfile | null): number {
  if (!profile?.trial_ends_at) return 0
  const ms = new Date(profile.trial_ends_at).getTime() - Date.now()
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)))
}
