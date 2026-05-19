import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function getSupabase() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
          } catch { /* server component context */ }
        },
      },
    },
  )
}

// Snooze a coach insight topic for N days (default 14). Upserts on (user_id, topic_key).
export async function POST(req: Request) {
  try {
    const supabase = await getSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    const topicKey = typeof body?.topic_key === 'string' ? body.topic_key.trim().slice(0, 80) : ''
    const topicTitle = typeof body?.topic_title === 'string' ? body.topic_title.trim().slice(0, 200) : ''
    const days = Math.max(1, Math.min(60, Number(body?.days) || 14))

    if (!topicKey) {
      return NextResponse.json({ error: 'topic_key required' }, { status: 400 })
    }

    const dismissedUntil = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()

    const { error } = await supabase
      .from('coach_insight_dismissals')
      .upsert(
        {
          user_id: user.id,
          topic_key: topicKey,
          topic_title: topicTitle || topicKey,
          dismissed_until: dismissedUntil,
          reason: 'user_snooze',
        },
        { onConflict: 'user_id,topic_key' }
      )

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, dismissed_until: dismissedUntil, days })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Snooze failed' },
      { status: 500 }
    )
  }
}

export async function DELETE(req: Request) {
  try {
    const supabase = await getSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const url = new URL(req.url)
    const topicKey = url.searchParams.get('topic_key')?.trim().slice(0, 80) || ''
    if (!topicKey) return NextResponse.json({ error: 'topic_key required' }, { status: 400 })

    const { error } = await supabase
      .from('coach_insight_dismissals')
      .delete()
      .eq('user_id', user.id)
      .eq('topic_key', topicKey)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Un-snooze failed' },
      { status: 500 }
    )
  }
}
