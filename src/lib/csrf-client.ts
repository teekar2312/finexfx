'use client'

// CSRF client-side helper — installs a global fetch wrapper that automatically
// attaches the `x-csrf-token` header (mirroring the `csrf-token` cookie) to
// every state-changing request to `/api/*` (excluding `/api/auth/*`, which
// NextAuth protects with its own CSRF tokens).
//
// The server-side enforcement lives in `src/proxy.ts` (double-submit cookie
// pattern). The cookie is issued by `GET /api/auth/csrf-token`.
//
// Importing this module from any client bundle (e.g. `lib/api.ts`) is enough
// to install the patch — no UI components need to be modified.

const CSRF_COOKIE_NAME = 'csrf-token'
const CSRF_HEADER_NAME = 'x-csrf-token'
const STATE_CHANGING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

// In-flight token fetch (de-duplicates concurrent requests)
let tokenPromise: Promise<string | null> | null = null

/** Read a cookie by name from document.cookie (returns null if missing). */
function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  // Robust regex that handles values containing non-trivial chars
  const match = document.cookie.match(
    new RegExp('(?:^|; )' + name.replace(/([.$?*|{}()[\]\\/+^])/g, '\\$1') + '=([^;]*)'),
  )
  return match ? decodeURIComponent(match[1]) : null
}

/**
 * Resolve the current CSRF token. Reads the cookie first; if no cookie is set,
 * fetches one from /api/auth/csrf-token (which sets the cookie as a side
 * effect). Returns null if the token cannot be obtained — in that case the
 * request will be allowed to proceed without the header and the server will
 * reject it with 403, surfacing the failure to the caller.
 */
export async function getCsrfToken(): Promise<string | null> {
  const fromCookie = readCookie(CSRF_COOKIE_NAME)
  if (fromCookie) return fromCookie

  if (!tokenPromise) {
    tokenPromise = fetch('/api/auth/csrf-token', { credentials: 'same-origin' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('csrf-token fetch failed'))))
      .then((data: { token?: string }) => data.token ?? null)
      .catch(() => null)
      .finally(() => {
        // Allow a re-fetch on the next state-changing request if this attempt
        // failed. If it succeeded, the cookie is now set and the next call
        // will short-circuit on the cookie read above.
        tokenPromise = null
      })
  }
  return tokenPromise
}

// Augment the Window type so TS recognises our patch guard.
declare global {
  interface Window {
    __csrfFetchPatched?: boolean
  }
}

/**
 * Install a wrapper around window.fetch that injects the CSRF header for
 * state-changing requests to /api/* (excluding /api/auth/*).
 *
 * Idempotent — safe to call multiple times.
 */
export function installCsrfFetchPatch() {
  if (typeof window === 'undefined' || window.__csrfFetchPatched) return
  const originalFetch = window.fetch.bind(window)

  window.fetch = async function patchedFetch(
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> {
    const method = (init?.method || 'GET').toUpperCase()

    // Determine URL string for path-prefix checks
    let urlStr = ''
    if (typeof input === 'string') urlStr = input
    else if (input instanceof URL) urlStr = input.toString()
    else if ('url' in input) urlStr = input.url

    const isStateChanging = STATE_CHANGING_METHODS.has(method)
    // Only inject CSRF tokens for same-origin relative API calls — never for
    // cross-origin requests (would leak the token to other sites).
    const isSameOriginApiCall = urlStr.startsWith('/api/')
    const isAuthPath = urlStr.startsWith('/api/auth/')

    if (isStateChanging && isSameOriginApiCall && !isAuthPath) {
      try {
        const token = await getCsrfToken()
        if (token) {
          init = init ? { ...init } : {}
          // Preserve any existing headers (plain object, Headers, or array)
          const headers = new Headers(init.headers || {})
          headers.set(CSRF_HEADER_NAME, token)
          init.headers = headers
        }
      } catch {
        // Token unavailable — let the request proceed; server will 403.
      }
    }

    return originalFetch(input, init)
  }

  window.__csrfFetchPatched = true
}

// Auto-install on module import (client-side only)
installCsrfFetchPatch()
