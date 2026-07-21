import { NextResponse } from 'next/server'
import { randomBytes } from 'crypto'

export const dynamic = 'force-dynamic'

/**
 * GET /api/auth/csrf-token — issue a CSRF token for double-submit protection.
 *
 * Sets a `csrf-token` cookie (non-httpOnly so client JS can read it and mirror
 * it in the `x-csrf-token` header on state-changing requests) and returns the
 * same token in the JSON body.
 *
 * The proxy (src/proxy.ts) enforces that POST/PUT/PATCH/DELETE requests to
 * non-auth endpoints must send matching token in cookie + header.
 *
 * Cookie attributes:
 *   - httpOnly: false — client JS must read it to copy into the header
 *   - secure:   true in production (HTTPS-only)
 *   - sameSite: 'lax' — allows the cookie to accompany top-level navigations
 *               while blocking cross-site POSTs (defense-in-depth)
 *   - path:     '/' — available to all routes
 *
 * NOTE: This endpoint is reachable without authentication so the login page
 * itself can obtain a token. The proxy's matcher no longer excludes /api/auth/*,
 * but proxy() passes through all /api/auth/* requests after rate-limiting the
 * sensitive ones (this endpoint is GET, so it is not rate-limited and not
 * CSRF-checked).
 */
export async function GET() {
  const token = randomBytes(32).toString('hex')

  const res = NextResponse.json({ token })
  res.cookies.set('csrf-token', token, {
    httpOnly: false, // Must be readable by client JS for double-submit
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  })
  return res
}
