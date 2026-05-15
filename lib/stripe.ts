import Stripe from 'stripe'

let _stripe: Stripe | null = null

export function getStripe(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder', {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      apiVersion: '2024-12-18.acacia' as any,
    })
  }
  return _stripe
}

// Convenience proxy so existing call sites `stripe.foo` still work.
export const stripe = new Proxy({} as Stripe, {
  get(_, prop: string) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (getStripe() as any)[prop]
  },
})

export const STRIPE_PRICE_IDS = {
  pro_monthly: process.env.STRIPE_PRICE_PRO_MONTHLY || '',
  pro_yearly: process.env.STRIPE_PRICE_PRO_YEARLY || '',
  premium_monthly: process.env.STRIPE_PRICE_PREMIUM_MONTHLY || '',
  premium_yearly: process.env.STRIPE_PRICE_PREMIUM_YEARLY || '',
}

export function tierFromPriceId(priceId: string | null | undefined): 'free' | 'pro' | 'premium' {
  if (!priceId) return 'free'
  if (priceId === STRIPE_PRICE_IDS.premium_monthly || priceId === STRIPE_PRICE_IDS.premium_yearly) {
    return 'premium'
  }
  if (priceId === STRIPE_PRICE_IDS.pro_monthly || priceId === STRIPE_PRICE_IDS.pro_yearly) {
    return 'pro'
  }
  return 'free'
}

export const TIER_PRICES_DISPLAY = {
  pro: { monthly: 29, yearly: 290 },
  premium: { monthly: 99, yearly: 990 },
}
