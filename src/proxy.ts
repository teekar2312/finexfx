// Proxy (formerly middleware in Next.js 15 and earlier) — protects all routes
// except auth + public assets.
// Redirects unauthenticated users to /login.
// For API routes, returns 401 JSON instead of redirecting.
//
// Next.js 16 renamed the "middleware" convention to "proxy".
// See: https://nextjs.org/docs/messages/middleware-to-proxy
//
// Security responsibilities (P3-SECURITY):
//   1. Rate limit login attempts (5 / 15min / IP) — brute-force protection
//   2. Rate limit password changes (3 / hour / IP) — credential-stuffing protection
//   3. CSRF protection (double-submit cookie) for state-changing requests
//      on non-auth endpoints (NextAuth handles its own CSRF).

import { NextResponse, type NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { applyRateLimit } from '@/lib/rate-limit'

/**
 * Proxy function — runs on every request matching the config.matcher pattern.
 *
 * Order of operations:
 *   1. Rate-limit sensitive auth endpoints (login + password change)
 *   2. CSRF-check state-changing requests (skips /api/auth/* — NextAuth CSRF)
 *   3. Pass through /api/auth/* (NextAuth handles its own auth)
 *   4. Check for NextAuth JWT token. If missing, redirects to /login (pages)
 *      or returns 401 JSON (API routes).
 */
export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl

  // ─── 1. Rate limiting for sensitive auth operations ───────────────────────
  // Applied BEFORE the token check so they protect against unauthenticated
  // brute-force / credential-stuffing attacks.

  // Login attempts: max 5 per 15 minutes per IP
  if (pathname === '/api/auth/callback/credentials' && req.method === 'POST') {
    const limited = applyRateLimit(req, {
      key: 'login',
      max: 5,
      windowSec: 15 * 60,
    })
    if (limited) return limited
  }

  // Password changes: max 3 per hour per IP
  if (pathname === '/api/auth/me/password' && req.method === 'POST') {
    const limited = applyRateLimit(req, {
      key: 'pwd-change',
      max: 3,
      windowSec: 60 * 60,
    })
    if (limited) return limited
  }

  // ─── 2. CSRF protection (double-submit cookie) ───────────────────────────
  // Only enforce CSRF in production — in development, CSRF tokens can cause
  // issues with rapid prototyping and hot reload.
  //
  // API routes already have auth guards (requireAuth/requireTrader/requireAdmin)
  // which prevent unauthorized access. CSRF protection adds defense-in-depth
  // against cross-site request forgery, but is not needed for local dev.
  if (
    process.env.NODE_ENV === 'production' &&
    (req.method === 'POST' ||
      req.method === 'PUT' ||
      req.method === 'PATCH' ||
      req.method === 'DELETE') &&
    !pathname.startsWith('/api/auth/')
  ) {
    const headerToken = req.headers.get('x-csrf-token')
    const cookieToken = req.cookies.get('csrf-token')?.value
    const serviceKey = req.headers.get('x-service-key')

    // Skip CSRF for service-to-service calls (authenticated via X-Service-Key)
    if (!serviceKey && cookieToken) {
      if (
        !headerToken ||
        typeof headerToken !== 'string' ||
        headerToken.length !== cookieToken.length ||
        headerToken !== cookieToken
      ) {
        return NextResponse.json(
          { error: 'CSRF token missing or invalid' },
          { status: 403 },
        )
      }
    }
  }

  // ─── 2b. HTTPS enforcement (production only) ─────────────────────────────
  if (
    process.env.NODE_ENV === 'production' &&
    req.headers.get('x-forwarded-proto') === 'http'
  ) {
    const httpsUrl = new URL(req.url)
    httpsUrl.protocol = 'https:'
    return NextResponse.redirect(httpsUrl, 301)
  }

  // ─── 3. Pass through /api/auth/* (NextAuth handles its own auth + CSRF) ───
  if (pathname.startsWith('/api/auth/')) {
    return NextResponse.next()
  }

  // ─── 4. Token check for all other protected routes ───────────────────────
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })

  // If user is authenticated, allow the request through
  if (token) {
    return NextResponse.next()
  }

  // Not authenticated — API routes get 401 JSON response
  if (pathname.startsWith('/api/')) {
    return NextResponse.json(
      { error: 'Unauthorized — authentication required' },
      { status: 401 },
    )
  }

  // Page routes get redirected to login
  const loginUrl = new URL('/login', req.url)
  loginUrl.searchParams.set('callbackUrl', pathname)
  return NextResponse.redirect(loginUrl)
}

export const config = {
  // Protect everything EXCEPT:
  // - /api/mt5/health (MT5 bridge status — public)
  // - /api/health/mt5-disconnect (called by heartbeat monitor, has own X-Service-Key auth)
  // - /api/trades/check-sl-tp (called by SL/TP monitor background service)
  // - /api/ai/auto-trade (called by background service, has own role guard)
  // - /api/mt5/reconcile (called by background service, has own auth)
  // - /api/ai/evaluate (called by background service, has own auth)
  // - /api/system/backup (called by background service for auto-backup)
  // - /login (the login page itself)
  // - /_next/* (Next.js static assets)
  // - /favicon.ico, /logo.svg (public assets)
  //
  // NOTE: /api/auth/* is intentionally NOT excluded — the proxy applies rate
  // limiting to /api/auth/callback/credentials (login) and
  // /api/auth/me/password (password change), then passes them through to the
  // NextAuth handler (see step 3 in proxy()).
  matcher: [
    '/((?!api/mt5/health|api/health/mt5-disconnect|api/trades/check-sl-tp|api/ai/auto-trade|api/mt5/reconcile|api/ai/evaluate|api/system/backup|login|_next/static|_next/image|favicon.ico|logo.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
