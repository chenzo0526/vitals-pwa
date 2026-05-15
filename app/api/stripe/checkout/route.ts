import { NextRequest, NextResponse } from 'next/server'
import { stripe, STRIPE_PRICE_IDS } from '@/lib/stripe'
import { supabase } from '@/lib/supabase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { tier, interval } = await req.json() as { tier: 'pro' | 'premium'; interval: 'monthly' | 'yearly' }
    const priceKey = `${tier}_${interval}` as keyof typeof STRIPE_PRICE_IDS
    const priceId = STRIPE_PRICE_IDS[priceKey]
    if (!priceId) {
      return NextResponse.json({ error: 'Price not configured. Set STRIPE_PRICE_* env vars.' }, { status: 400 })
    }

    const { data: { user } } = await supabase.auth.getUser()
    const userId = user?.id
    const email = user?.email

    // Ensure customer
    let customerId: string | undefined
    if (userId) {
      const { data: profile } = await supabase.from('user_profile').select('stripe_customer_id').eq('id', userId).single()
      customerId = (profile as { stripe_customer_id?: string } | null)?.stripe_customer_id || undefined
      if (!customerId && email) {
        const customer = await stripe.customers.create({ email, metadata: { user_id: userId } })
        customerId = customer.id
        await supabase.from('user_profile').update({ stripe_customer_id: customerId }).eq('id', userId)
      }
    }

    const origin = req.headers.get('origin') || 'https://vitals-pwa.vercel.app'
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      customer_email: customerId ? undefined : email || undefined,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/billing?success=1`,
      cancel_url: `${origin}/billing?canceled=1`,
      allow_promotion_codes: true,
      metadata: { user_id: userId || '', tier, interval },
      subscription_data: { metadata: { user_id: userId || '', tier } },
    })

    return NextResponse.json({ url: session.url })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 })
  }
}
