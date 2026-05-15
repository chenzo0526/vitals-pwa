import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { stripe, tierFromPriceId } from '@/lib/stripe'
import { getServerSupabase } from '@/lib/supabase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const sig = req.headers.get('stripe-signature')
  const whSecret = process.env.STRIPE_WEBHOOK_SECRET || ''
  const body = await req.text()

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig || '', whSecret)
  } catch (err) {
    return NextResponse.json(
      { error: `Webhook signature verification failed: ${err instanceof Error ? err.message : 'unknown'}` },
      { status: 400 }
    )
  }

  const sb = getServerSupabase()

  // Idempotency
  await sb.from('subscription_events').insert({
    stripe_event_id: event.id,
    event_type: event.type,
    payload: event.data.object as object,
  }).select().single()

  try {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.trial_will_end': {
        const sub = event.data.object as Stripe.Subscription & {
          current_period_start: number
          current_period_end: number
        }
        const priceId = sub.items.data[0]?.price.id
        const tier = tierFromPriceId(priceId)
        const userId = (sub.metadata?.user_id) || ((await stripe.customers.retrieve(sub.customer as string)) as Stripe.Customer).metadata?.user_id

        await sb.from('subscriptions').upsert({
          user_id: userId,
          stripe_customer_id: sub.customer as string,
          stripe_subscription_id: sub.id,
          stripe_price_id: priceId,
          status: sub.status,
          tier,
          current_period_start: new Date(sub.current_period_start * 1000).toISOString(),
          current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
          cancel_at_period_end: sub.cancel_at_period_end,
          trial_end: sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'stripe_subscription_id' })

        if (userId) {
          await sb.from('user_profile').update({
            tier,
            stripe_customer_id: sub.customer as string,
            stripe_subscription_id: sub.id,
            subscription_status: sub.status,
            current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
            updated_at: new Date().toISOString(),
          }).eq('id', userId)
        }
        break
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        const userId = sub.metadata?.user_id
        if (userId) {
          await sb.from('user_profile').update({
            tier: 'free',
            subscription_status: 'canceled',
            updated_at: new Date().toISOString(),
          }).eq('id', userId)
        }
        await sb.from('subscriptions').update({
          status: 'canceled',
          tier: 'free',
          updated_at: new Date().toISOString(),
        }).eq('stripe_subscription_id', sub.id)
        break
      }
    }
  } catch (err) {
    console.error('Webhook handler error', err)
  }

  return NextResponse.json({ received: true })
}
