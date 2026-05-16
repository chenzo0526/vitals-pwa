import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { getServerClient } from '@/lib/supabase-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const supabase = getServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const { data: profile } = await supabase.from('user_profile').select('stripe_customer_id').eq('id', user.id).maybeSingle()
    const customerId = (profile as { stripe_customer_id?: string } | null)?.stripe_customer_id
    if (!customerId) {
      return NextResponse.json({ error: 'No Stripe customer for this user' }, { status: 400 })
    }

    const origin = req.headers.get('origin') || 'https://vitals-pwa.vercel.app'
    const portal = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}/billing`,
    })
    return NextResponse.json({ url: portal.url })
  } catch (err) {
    console.error('[stripe/portal] error:', err)
    return NextResponse.json({ error: 'Failed to open billing portal. Please try again.' }, { status: 500 })
  }
}
