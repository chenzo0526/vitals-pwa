import { NextResponse, type NextRequest } from 'next/server'
import { getServerClient } from '@/lib/supabase-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') || '/'

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

    // Look up or create user_profile.
    const { data: profile } = await supabase
      .from('user_profile')
      .select('id, onboarding_completed_at')
      .eq('id', userId)
      .maybeSingle()

    if (!profile) {
      const nowIso = new Date().toISOString()
      const trialEndsIso = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
      const { error: insertErr } = await supabase.from('user_profile').insert({
        id: userId,
        tier: 'pro',
        display_name: userEmail,
        trial_started_at: nowIso,
        trial_ends_at: trialEndsIso,
      })
      if (insertErr) {
        console.error('[auth/callback] profile insert error:', insertErr)
        // Don't block — user is signed in, can recover.
      }
      return NextResponse.redirect(`${origin}/onboarding`)
    }

    // Existing user — onboarding done → home, else → onboarding to finish.
    if (profile.onboarding_completed_at) {
      return NextResponse.redirect(`${origin}${next}`)
    }
    return NextResponse.redirect(`${origin}/onboarding`)
  } catch (err) {
    console.error('[auth/callback] error:', err)
    return NextResponse.redirect(`${origin}/login?error=callback_failed`)
  }
}
