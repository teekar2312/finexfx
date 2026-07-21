// Ownership check helper — prevents IDOR (Insecure Direct Object Reference)
// In single-tenant mode (userId=null on account), all authenticated users can access.
// In multi-tenant mode (userId set on account), only owner + admin can access.

import 'server-only'
import type { SessionUser } from './auth-server'

/**
 * Check if a user owns or can access an account.
 * - Admins can access all accounts
 * - If account has no userId (single-tenant), any authenticated user can access
 * - If account has userId, only the owner can access
 */
export function canAccessAccount(user: SessionUser, accountUserId: string | null): boolean {
  if (user.role === 'admin') return true
  if (!accountUserId) return true // single-tenant — shared account
  return user.id === accountUserId
}

/**
 * Check if a user owns or can access a trade (via account ownership).
 */
export function canAccessTrade(user: SessionUser, accountUserId: string | null): boolean {
  return canAccessAccount(user, accountUserId)
}
