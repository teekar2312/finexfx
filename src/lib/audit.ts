// Audit log helper — records who did what, when, from where.
// Used for security audit trail and compliance tracking.

import 'server-only'
import { db } from './db'
import { headers } from 'next/headers'
import type { SessionUser } from './auth-server'

export interface AuditEntry {
  action: string
  entityType?: string
  entityId?: string
  metadata?: Record<string, any>
}

/**
 * Record an audit log entry.
 * Call this after any state-changing operation (trade open, risk update, etc.)
 */
export async function auditLog(
  user: SessionUser | null,
  entry: AuditEntry,
): Promise<void> {
  try {
    let ipAddress: string | null = null
    let userAgent: string | null = null

    try {
      const hdrs = await headers()
      ipAddress = hdrs.get('x-forwarded-for') || hdrs.get('x-real-ip') || null
      userAgent = hdrs.get('user-agent') || null
    } catch {
      // headers() not available (e.g., in tests or background jobs)
    }

    await db.auditLog.create({
      data: {
        userId: user?.id ?? null,
        userEmail: user?.email ?? null,
        action: entry.action,
        entityType: entry.entityType ?? null,
        entityId: entry.entityId ?? null,
        metadata: entry.metadata ? JSON.stringify(entry.metadata) : null,
        ipAddress,
        userAgent,
      },
    })
  } catch (e) {
    // Audit log failure must not block the operation
    console.error('auditLog error:', e)
  }
}

/**
 * Record a metric (bridge latency, error count, etc.)
 */
export async function recordMetric(name: string, value: number, tags?: Record<string, any>): Promise<void> {
  try {
    await db.metric.create({
      data: {
        name,
        value,
        tags: tags ? JSON.stringify(tags) : null,
      },
    })
  } catch {
    // Metric recording failure is non-fatal
  }
}

/**
 * Get audit logs filtered by user, action, or entity.
 */
export async function getAuditLogs(filters: {
  userId?: string
  action?: string
  entityType?: string
  entityId?: string
  limit?: number
}): Promise<any[]> {
  return db.auditLog.findMany({
    where: {
      ...(filters.userId ? { userId: filters.userId } : {}),
      ...(filters.action ? { action: filters.action } : {}),
      ...(filters.entityType ? { entityType: filters.entityType } : {}),
      ...(filters.entityId ? { entityId: filters.entityId } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: Math.min(filters.limit ?? 100, 500),
  })
}
