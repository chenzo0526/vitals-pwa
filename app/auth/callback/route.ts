import { NextResponse, type NextRequest } from 'next/server'
import { getServerClient } from '@/lib/supabase-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') || '/'
  const tzFromQuery = searchParams.get('tz') || undefined

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=callback_failed`)
  }

  const supabase = getServerClient()

  try {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    if (error || !data.session) {
      console.error('[auth/callback] exchange error:', error)
      return NextResponse.redirect(`${origin}/login?error=callback_failed`)
    }

    const userId = data.session.user.id
    const userEmail = data.session.user.email || null

    // Upsert avoids the race between Supabase's handle_new_user trigger and our insert.
    const trialEndsIso = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
    const profilePayload: Record<string, unknown> = {
      id: userId,
      tier: 'pro',
      display_name: userEmail,
      trial_ends_at: trialEndsIso,
    }
    if (tzFromQuery) profilePayload.timezone = tzFromQuery

    const { error: upsertErr } = await supabase
      .from('user_profile')
      .upsert(profilePayload, { onConflict: 'id', ignoreDuplicates: false })
    if (upsertErr) {
      // Trigger may have already created the row with a different default — be tolerant.
      console.error('[auth/callback] profile upsert error:', upsertErr)
    }

    // Read post-upsert to decide where to route.
    const { data: profile } = await supabase
      .from('user_profile')
      .select('onboarding_completed_at')
      .eq('id', userId)
      .maybeSingle()

    if (!profile?.onboarding_completed_at) {
      return NextResponse.redirect(`${origin}/onboarding`)
    }
    return NextResponse.redirect(`${origin}${next}`)
  } catch (err) {
    console.error('[auth/callback] error:', err)
    return NextResponse.redirect(`${origin}/login?error=callback_failed`)
  }
}
