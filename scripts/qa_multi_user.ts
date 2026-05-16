#!/usr/bin/env tsx
/**
 * qa_multi_user.ts — verify RLS truly isolates two users.
 *
 * What it does:
 *   1. Spawns two test users via the admin API (auto-confirms email).
 *   2. As user A — inserts food log, workout session, substance.
 *   3. As user B — inserts food log, workout session, substance.
 *   4. As user A — selects all data. ONLY user A's rows should be visible.
 *   5. As user B — selects all data. ONLY user B's rows should be visible.
 *   6. As anonymous (no session) — selects all data. ZERO rows should be visible.
 *   7. Cleans up: deletes both test users.
 *
 * Required env (read from process.env — set in .env.local or shell):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Run: `npx tsx scripts/qa_multi_user.ts`
 *
 * NOTE: this script assumes the 2026-05-16-multi-user-rls migration is applied.
 * If RLS is still on dogfood-permissive policies, every user will see every row
 * and the script will FAIL with a clear message.
 */
import { createClient, type User } from '@supabase/supabase-js'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!URL || !ANON || !SERVICE) {
  console.error('❌  Missing env. Set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY.')
  process.exit(1)
}

const admin = createClient(URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } })

const stamp = Date.now()
const EMAIL_A = `qa-a-${stamp}@vitals.test`
const EMAIL_B = `qa-b-${stamp}@vitals.test`
const PASSWORD = 'QaTest!' + stamp

function userClient(accessToken: string) {
  return createClient(URL!, ANON!, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

async function createTestUser(email: string): Promise<{ user: User; access_token: string }> {
  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  })
  if (error || !created.user) throw new Error(`Create user ${email} failed: ${error?.message}`)

  const session = createClient(URL!, ANON!, { auth: { persistSession: false } })
  const { data: signin, error: signErr } = await session.auth.signInWithPassword({ email, password: PASSWORD })
  if (signErr || !signin.session) throw new Error(`Sign in ${email} failed: ${signErr?.message}`)

  return { user: created.user, access_token: signin.session.access_token }
}

async function seedRows(client: ReturnType<typeof userClient>, userId: string, tag: string) {
  const { error: foodErr } = await client.from('intake_events').insert({
    user_id: userId,
    item: `[${tag}] qa eggs`,
    calories: 200, protein_g: 18, carbs_g: 2, fat_g: 14,
    raw_input: 'qa-script', parsed_by: 'qa',
  })
  if (foodErr) throw new Error(`intake_events insert (${tag}): ${foodErr.message}`)

  const { data: session, error: sessErr } = await client.from('workout_sessions').insert({
    user_id: userId,
    focus: `[${tag}] qa push`, energy_pre: 7,
    started_at: new Date().toISOString(),
  }).select().single()
  if (sessErr || !session) throw new Error(`workout_sessions insert (${tag}): ${sessErr?.message}`)

  const { error: setErr } = await client.from('workout_sets').insert({
    session_id: session.id,
    user_id: userId,
    exercise_name: `[${tag}] bench`, set_number: 1, weight_lb: 135, reps: 8,
  })
  if (setErr) throw new Error(`workout_sets insert (${tag}): ${setErr.message}`)

  const { error: subErr } = await client.from('substances').insert({
    user_id: userId,
    name: `[${tag}] creatine`, category: 'supplements', dose: 5, dose_unit: 'g', frequency: 'daily',
  })
  if (subErr) throw new Error(`substances insert (${tag}): ${subErr.message}`)
}

async function readCounts(client: ReturnType<typeof userClient> | ReturnType<typeof createClient>) {
  const [food, sessions, sets, subs] = await Promise.all([
    client.from('intake_events').select('id, item'),
    client.from('workout_sessions').select('id, focus'),
    client.from('workout_sets').select('id, exercise_name'),
    client.from('substances').select('id, name'),
  ])
  return {
    intake: food.data || [],
    workout_sessions: sessions.data || [],
    workout_sets: sets.data || [],
    substances: subs.data || [],
  }
}

async function cleanup(userId: string) {
  await admin.auth.admin.deleteUser(userId).catch(() => {})
}

async function main() {
  console.log(`\n────────────────────────────────────────────────────────────`)
  console.log(`  VITALS multi-user RLS isolation test`)
  console.log(`  Supabase: ${URL}`)
  console.log(`────────────────────────────────────────────────────────────\n`)

  let userA: { user: User; access_token: string } | null = null
  let userB: { user: User; access_token: string } | null = null
  let failures = 0
  const reportLine = (ok: boolean, msg: string) => {
    console.log(`${ok ? '✅' : '❌'}  ${msg}`)
    if (!ok) failures++
  }

  try {
    console.log('▸ creating test users…')
    userA = await createTestUser(EMAIL_A)
    userB = await createTestUser(EMAIL_B)
    console.log(`   user A: ${userA.user.id} (${EMAIL_A})`)
    console.log(`   user B: ${userB.user.id} (${EMAIL_B})\n`)

    const clientA = userClient(userA.access_token)
    const clientB = userClient(userB.access_token)
    const anonClient = createClient(URL!, ANON!, { auth: { persistSession: false } })

    console.log('▸ seeding rows for each user…')
    await seedRows(clientA, userA.user.id, 'A')
    await seedRows(clientB, userB.user.id, 'B')
    console.log('   seeded both users with 1 intake + 1 session + 1 set + 1 substance\n')

    console.log('▸ user A reads everything they can see:')
    const aSees = await readCounts(clientA)
    console.log('   ', summarize(aSees))
    reportLine(
      aSees.intake.length === 1 && aSees.intake[0].item.startsWith('[A]'),
      `A sees exactly 1 intake row, and it's their own (item="${aSees.intake[0]?.item}")`,
    )
    reportLine(aSees.workout_sessions.length === 1, `A sees exactly 1 workout session`)
    reportLine(aSees.workout_sets.length === 1, `A sees exactly 1 workout set`)
    reportLine(aSees.substances.length === 1, `A sees exactly 1 substance`)

    console.log('\n▸ user B reads everything they can see:')
    const bSees = await readCounts(clientB)
    console.log('   ', summarize(bSees))
    reportLine(
      bSees.intake.length === 1 && bSees.intake[0].item.startsWith('[B]'),
      `B sees exactly 1 intake row, and it's their own (item="${bSees.intake[0]?.item}")`,
    )
    reportLine(bSees.workout_sessions.length === 1, `B sees exactly 1 workout session`)
    reportLine(bSees.workout_sets.length === 1, `B sees exactly 1 workout set`)
    reportLine(bSees.substances.length === 1, `B sees exactly 1 substance`)

    console.log('\n▸ anonymous client reads everything it can see:')
    const anonSees = await readCounts(anonClient)
    console.log('   ', summarize(anonSees))
    reportLine(anonSees.intake.length === 0, 'anon sees 0 intake rows')
    reportLine(anonSees.workout_sessions.length === 0, 'anon sees 0 workout sessions')
    reportLine(anonSees.workout_sets.length === 0, 'anon sees 0 workout sets')
    reportLine(anonSees.substances.length === 0, 'anon sees 0 substances')

    console.log('\n▸ attempting user A → user B cross-write (should fail):')
    const { error: crossErr } = await clientA.from('intake_events').insert({
      user_id: userB.user.id,
      item: 'cross-write attempt',
      raw_input: 'qa-script', parsed_by: 'qa',
    })
    reportLine(crossErr !== null, `cross-write rejected by RLS: ${crossErr?.message || '(no error — RLS broken!)'}`)

  } catch (e) {
    console.error('\n💥 fatal:', e instanceof Error ? e.message : e)
    failures++
  } finally {
    console.log('\n▸ cleanup…')
    if (userA) await cleanup(userA.user.id)
    if (userB) await cleanup(userB.user.id)
    console.log('   test users deleted')
  }

  console.log(`\n────────────────────────────────────────────────────────────`)
  if (failures === 0) {
    console.log(`🎉 ALL CHECKS PASSED — RLS isolates users correctly.`)
    process.exit(0)
  } else {
    console.log(`🚨 ${failures} check(s) failed.`)
    process.exit(2)
  }
}

function summarize(c: Awaited<ReturnType<typeof readCounts>>) {
  return `intake=${c.intake.length} sessions=${c.workout_sessions.length} sets=${c.workout_sets.length} subs=${c.substances.length}`
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
