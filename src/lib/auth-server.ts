// Server-side session helpers for API routes.
// Wraps getServerSession with our auth options + provides role-checking utilities.

import 'server-only'
import { getServerSession } from 'next-auth'
import { NextRequest, NextResponse } from 'next/server'
import { authOptions } from './auth-config'
import { canTrade, canManageUsers, canManageSystem, type UserRole } from './auth'
import { headers } from 'next/headers'
import { timingSafeEqual } from 'crypto'

export interface SessionUser {
  id: string
  email: string
  name: string
  role: UserRole
}

/**
 * Check if the request is from a trusted background service (SL/TP monitor,
 * price-feed, etc.) via the X-Service-Key header.
 *
 * Background services don't have browser sessions, so they authenticate
 * with a shared secret set via the SERVICE_API_KEY env var.
 *
 * When authenticated as a service, they get admin-level access (since they
 * need to call protected endpoints like /api/system/backup).
 */
async function getServiceUser(): Promise<SessionUser | null> {
  const serviceKey = process.env.SERVICE_API_KEY
  if (!serviceKey) return null // service auth not configured

  try {
    const hdrs = await headers()
    const providedKey = hdrs.get('x-service-key')
    if (providedKey) {
      // Timing-safe comparison to prevent timing attacks
      const a = Buffer.from(providedKey)
      const b = Buffer.from(serviceKey)
      if (a.length === b.length && timingSafeEqual(a, b)) {
        return {
          id: 'service',
          email: 'service@finexfx.local',
          name: 'Background Service',
          role: 'admin',
        }
      }
    }
  } catch {
    // headers() not available (e.g., in tests) — skip service auth
  }
  return null
}

/** Get the current session user on the server side. Returns null if not authenticated. */
export async function getSessionUser(): Promise<SessionUser | null> {
  // Check service auth first (background services)
  const serviceUser = await getServiceUser()
  if (serviceUser) return serviceUser

  // Then check browser session
  const session = await getServerSession(authOptions)
  if (!session?.user) return null
  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    role: session.user.role,
  }
}

/**
 * Require authentication. Returns the user if authenticated, or a 401 NextResponse if not.
 * Usage in API routes:
 *   const user = await requireAuth()
 *   if (user instanceof NextResponse) return user  // 401
 *   // user is now typed as SessionUser
 */
export async function requireAuth(): Promise<SessionUser | NextResponse> {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json(
      { error: 'Unauthorized — authentication required' },
      { status: 401 },
    )
  }
  return user
}

/**
 * Require a specific role. Returns the user if authorized, or 401/403 NextResponse if not.
 * Usage:
 *   const user = await requireRole('trader', req)
 *   if (user instanceof NextResponse) return user
 */
export async function requireRole(
  minRole: UserRole,
  _req?: NextRequest,
): Promise<SessionUser | NextResponse> {
  const authResult = await requireAuth()
  if (authResult instanceof NextResponse) return authResult // 401

  const levels: Record<UserRole, number> = { viewer: 1, trader: 2, admin: 3 }
  if (levels[authResult.role] < levels[minRole]) {
    return NextResponse.json(
      {
        error: `Forbidden — requires ${minRole} role or higher`,
        yourRole: authResult.role,
        requiredRole: minRole,
      },
      { status: 403 },
    )
  }
  return authResult
}

/** Require trader role (can open/close/modify trades). */
export async function requireTrader(): Promise<SessionUser | NextResponse> {
  return requireRole('trader')
}

/** Require admin role (can manage users, system config). */
export async function requireAdmin(): Promise<SessionUser | NextResponse> {
  return requireRole('admin')
}

/** Convenience: check if the current user can trade. */
export async function checkCanTrade(): Promise<boolean> {
  const user = await getSessionUser()
  return canTrade(user?.role)
}

/** Convenience: check if the current user can manage users. */
export async function checkCanManageUsers(): Promise<boolean> {
  const user = await getSessionUser()
  return canManageUsers(user?.role)
}

/** Convenience: check if the current user can manage system settings. */
export async function checkCanManageSystem(): Promise<boolean> {
  const user = await getSessionUser()
  return canManageSystem(user?.role)
}
