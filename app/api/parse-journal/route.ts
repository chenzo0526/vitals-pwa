import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { parseDailyCheckin } from '@/lib/claude'
import { friendlyAiError } from '@/lib/aiError'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Daily check-in parser. Body: { transcript: string, for_date?: 'YYYY-MM-DD' }
// Upserts the daily check-in row for that user/date.
export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
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

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    const userId = user.id

    const body = await req.json()
    const transcript: string | undefined = body?.transcript
    if (!transcript || !transcript.trim()) {
      return NextResponse.json({ error: 'Transcript is empty' }, { status: 400 })
    }

    // Resolve local date (use user's timezone)
    const { data: profile } = await supabase
      .from('user_profile')
      .select('timezone')
      .eq('id', userId)
      .maybeSingle()
    const tz = profile?.timezone || 'America/Los_Angeles'
    const forDate: string = body?.for_date || new Date().toLocaleDateString('en-CA', { timeZone: tz })

    const raw = await parseDailyCheckin(transcript)
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      console.error('[parse-journal] no JSON in response:', raw?.slice(0, 200))
      return NextResponse.json({ error: 'Could not parse your check-in. Try again with a bit more detail.' }, { status: 500 })
    }
    const parsed = JSON.parse(jsonMatch[0])

    // Upsert today's check-in row
    const { data: upsertData, error: upsertErr } = await supabase
      .from('daily_checkins')
      .upsert(
        {
          user_id: userId,
          for_date: forDate,
          mood: parsed.mood ?? null,
          energy: parsed.energy ?? null,
          focus: parsed.focus ?? null,
          sleep_quality: parsed.sleep_quality ?? null,
          sleep_hours: parsed.sleep_hours ?? null,
          stress_level: parsed.stress_level ?? null,
          training_quality: parsed.training_quality ?? null,
          gratitude_items: parsed.gratitude_items || [],
          intentions: parsed.intentions || [],
          concerns: parsed.concerns || [],
          wins: parsed.wins || [],
          transcript,
          parsed_json: parsed,
          notes: parsed.notes || null,
        },
        { onConflict: 'user_id,for_date' },
      )
      .select()
      .single()

    if (upsertErr) {
      console.error('[parse-journal] upsert error:', upsertErr)
      return NextResponse.json({ error: upsertErr.message }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      for_date: forDate,
      checkin: upsertData,
      summary: parsed.summary || '',
    })
  } catch (err) {
    console.error('[parse-journal] error:', err)
    const ai = friendlyAiError(err, 'parse your check-in')
    return NextResponse.json({ error: ai.message, code: ai.code }, { status: ai.status })
  }
}
