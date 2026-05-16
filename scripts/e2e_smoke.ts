#!/usr/bin/env tsx
/**
 * e2e_smoke.ts — End-to-end smoke test of the Vitals data flow.
 *
 * Validates:
 *   1. Admin can spawn a confirmed user
 *   2. As that user (via anon key + access_token): UPSERT profile w/ tz, INSERT consent_log,
 *      UPDATE onboarding_progress.completed_at, INSERT intake_events
 *   3. The daily_summary trigger correctly aggregates that intake (calories_total = 500)
 *   4. INSERT workout_sessions -> daily_summary.workout_count = 1
 *   5. DELETE the intake row -> daily_summary.calories_total = 0
 *   6. RLS isolation: a second user CANNOT SELECT user 1's rows
 *   7. RLS rejection: user 2 cannot INSERT with user 1's user_id
 *   8. Cleanup: both users deleted via admin API
 *
 * Required env (read from process.env — set in .env.local locally):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Run: `npm run smoke`
 */
import { createClient, type User } from '@supabase/supabase-js'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!URL || !ANON || !SERVICE) {
  console.error('❌  Missing env: set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const admin = createClient(URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } })
const stamp = Date.now()
const EMAIL_A = `e2e-a-${stamp}@vitals.test`
const EMAIL_B = `e2e-b-${stamp}@vitals.test`
const PASSWORD = 'E2eTest!' + stamp

function userClient(accessToken: string) {
  return createClient(URL!, ANON!, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

async function createUser(email: string) {
  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  })
  if (error || !created.user) throw new Error(`createUser(${email}): ${error?.message}`)

  const tmp = createClient(URL!, ANON!, { auth: { persistSession: false } })
  const { data: signin, error: signErr } = await tmp.auth.signInWithPassword({ email, password: PASSWORD })
  if (signErr || !signin.session) throw new Error(`signIn(${email}): ${signErr?.message}`)
  return { user: created.user, access_token: signin.session.access_token }
}

let failures = 0
function check(ok: boolean, label: string, extra?: unknown) {
  console.log(`${ok ? '✅' : '❌'}  ${label}${extra !== undefined ? '  ' + JSON.stringify(extra) : ''}`)
  if (!ok) failures++
}

function todayLocal(tz: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date())
}

async function main() {
  console.log('\n──────────────────────────────────────────────────────────────')
  console.log('  VITALS e2e smoke test')
  console.log(`  Supabase: ${URL}`)
  console.log(`  Stamp:    ${stamp}`)
  console.log('──────────────────────────────────────────────────────────────\n')

  let userA: { user: User; access_token: string } | null = null
  let userB: { user: User; access_token: string } | null = null

  try {
    // 1. Spawn two users
    console.log('▸ creating test users…')
    userA = await createUser(EMAIL_A)
    userB = await createUser(EMAIL_B)
    console.log(`   A=${userA.user.id}  B=${userB.user.id}\n`)

    const clA = userClient(userA.access_token)
    const clB = userClient(userB.access_token)

    // 2a. UPSERT user_profile with tz
    const tzA = 'America/Los_Angeles'
    const { error: profErr } = await clA.from('user_profile').upsert({
      id: userA.user.id,
      tier: 'pro',
      display_name: 'E2E A',
      timezone: tzA,
    }, { onConflict: 'id' })
    check(!profErr, 'A: upsert user_profile with tz', profErr?.message)

    // 2b. INSERT consent_log
    const { error: clErr } = await clA.from('consent_log').insert({
      user_id: userA.user.id,
      consent_version: 'v1.0',
      accepted_terms: true,
      accepted_privacy: true,
      accepted_not_medical_advice: true,
      user_agent: 'e2e-script',
    })
    check(!clErr, 'A: insert consent_log', clErr?.message)

    // 2c. onboarding_progress.completed_at
    const { error: onbErr } = await clA.from('onboarding_progress').upsert({
      user_id: userA.user.id,
      completed_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })
    check(!onbErr, 'A: upsert onboarding_progress.completed_at', onbErr?.message)

    // 2d. INSERT intake_events
    const today = todayLocal(tzA)
    const { data: intake, error: ieErr } = await clA.from('intake_events').insert({
      user_id: userA.user.id,
      ts: new Date().toISOString(),
      item: 'e2e oats + eggs',
      calories: 500,
      protein_g: 30,
      carbs_g: 50,
      fat_g: 15,
      raw_input: 'e2e-smoke',
      parsed_by: 'e2e',
    }).select().single()
    check(!ieErr && !!intake, 'A: insert intake_events 500 kcal', ieErr?.message)

    // Allow trigger time to run
    await sleep(400)

    // 3. daily_summary populated by trigger
    const { data: sum1 } = await clA.from('daily_summary').select('*').eq('date', today).maybeSingle()
    check(
      !!sum1 && Number(sum1.calories_total) === 500,
      `A: daily_summary[${today}].calories_total = 500`,
      { actual: sum1?.calories_total },
    )

    // 4. INSERT workout_session
    const { error: wsErr } = await clA.from('workout_sessions').insert({
      user_id: userA.user.id,
      focus: 'e2e push',
      energy_pre: 7,
      started_at: new Date().toISOString(),
      ended_at: new Date().toISOString(),
    })
    check(!wsErr, 'A: insert workout_sessions', wsErr?.message)

    await sleep(400)
    const { data: sum2 } = await clA.from('daily_summary').select('*').eq('date', today).maybeSingle()
    check(
      !!sum2 && Number(sum2.workout_count) >= 1,
      `A: daily_summary[${today}].workout_count >= 1`,
      { actual: sum2?.workout_count },
    )

    // 5. DELETE intake row -> calories_total back to 0
    if (intake) {
      const { error: delErr } = await clA.from('intake_events').delete().eq('id', intake.id)
      check(!delErr, 'A: delete intake_events row', delErr?.message)
      await sleep(400)
      const { data: sum3 } = await clA.from('daily_summary').select('*').eq('date', today).maybeSingle()
      check(
        !sum3 || Number(sum3.calories_total) === 0,
        `A: daily_summary[${today}].calories_total = 0 after delete`,
        { actual: sum3?.calories_total },
      )
    }

    // 6. RLS isolation: user B cannot see user A's intake
    const { error: bSeedErr } = await clB.from('intake_events').insert({
      user_id: userB.user.id,
      ts: new Date().toISOString(),
      item: 'B own row',
      calories: 100,
      raw_input: 'e2e',
      parsed_by: 'e2e',
    })
    check(!bSeedErr, 'B: insert their own intake row', bSeedErr?.message)

    const { data: bSees } = await clB.from('intake_events').select('id, item, user_id')
    const sawAnyOfA = (bSees || []).some((r) => r.user_id === userA?.user.id)
    check(!sawAnyOfA, 'B: cannot SELECT any of A\'s intake_events (RLS)', { rowsSeen: bSees?.length })

    // 7. RLS rejection: B cannot insert with A's user_id
    const { error: crossErr } = await clB.from('intake_events').insert({
      user_id: userA.user.id,
      item: 'cross write',
      calories: 1,
      raw_input: 'e2e',
      parsed_by: 'e2e',
    })
    check(crossErr !== null, 'B: INSERT with A\'s user_id rejected by RLS', { msg: crossErr?.message })

  } catch (e) {
    console.error('\n💥 fatal:', e instanceof Error ? e.message : e)
    failures++
  } finally {
    console.log('\n▸ cleanup…')
    if (userA) await admin.auth.admin.deleteUser(userA.user.id).catch(() => {})
    if (userB) await admin.auth.admin.deleteUser(userB.user.id).catch(() => {})
    console.log('   deleted both test users')
  }

  console.log('\n──────────────────────────────────────────────────────────────')
  if (failures === 0) {
    console.log('🎉  ALL SMOKE CHECKS PASSED')
    process.exit(0)
  } else {
    console.log(`🚨  ${failures} check(s) failed`)
    process.exit(2)
  }
}

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)) }

main().catch((e) => { console.error(e); process.exit(1) })
