// Server-side Supabase clients. Use from API routes, server components, and middleware.
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key'

/**
 * Session-aware server client. Reads the auth cookie so `supabase.auth.getUser()`
 * returns the logged-in user. Inserts/reads honor RLS as that user.
 */
export function getServerClient() {
  const cookieStore = cookies()
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        } catch {
          // Server Components cannot set cookies; the middleware handles refresh.
        }
      },
    },
  })
}

/**
 * Service-role client. BYPASSES RLS — use ONLY for trusted server-side flows
 * (e.g. Stripe webhook processing). Never expose to client code.
 */
export function getServiceRoleClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  return createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/**
 * Convenience: returns the authenticated user or null in a server route.
 */
export async function getServerUser() {
  const supabase = getServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}
