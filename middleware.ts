import { NextResponse, type NextRequest } from 'next/server'

// Paths reachable without a session.
const PUBLIC_PATHS = [
  '/login',
  '/auth/callback',
  '/terms',
  '/privacy',
  '/api/stripe/webhook',
  // Token-authenticated machine endpoint (X-Vitals-Token / ?token=), not a session cookie.
  '/api/import-health',
]

const PUBLIC_PREFIXES = [
  '/_next',
  '/icons',
  '/favicon',
  '/manifest',
  '/api', // API routes do their OWN auth (server client + getUser, or token). Never gate them in middleware.
]

// IMPORTANT: this middleware is intentionally SYNCHRONOUS and makes NO network calls.
// It previously called supabase.auth.getUser() (a network round-trip to Supabase) on
// every request, which caused MIDDLEWARE_INVOCATION_TIMEOUT (504) under cold starts /
// slow auth responses and made every page slow. Real auth is still enforced at the data
// layer (Postgres RLS) and in server routes/components (which call getUser themselves);
// this gate is only the login-redirect UX, so a fast cookie-presence check is sufficient.
export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))

  // Fast, local check: does a Supabase auth cookie exist? No network call.
  const hasAuthCookie = request.cookies
    .getAll()
    .some((c) => c.name.startsWith('sb-') && c.name.includes('auth-token') && !!c.value)

  if (!hasAuthCookie && !isPublic) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    if (pathname !== '/') url.searchParams.set('redirect', pathname)
    return NextResponse.redirect(url)
  }

  if (hasAuthCookie && pathname === '/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icons|manifest.json).*)',
  ],
}
