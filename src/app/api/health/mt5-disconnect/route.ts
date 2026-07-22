import { NextResponse } from 'next/server'
import { logError, logWarn } from '@/lib/logger'

export const dynamic = 'force-dynamic'

/**
 * POST /api/health/mt5-disconnect
 *
 * Called by the heartbeat-monitor mini-service when MT5 bridge has been
 * offline for > 30 seconds. Triggers emergency close of all open positions
 * to prevent unmanaged exposure.
 *
 * Authenticated via SERVICE_API_KEY (shared secret between services).
 */
export async function POST(request: Request) {
  // Verify service-to-service auth
  const serviceKey = process.env.SERVICE_API_KEY || ''
  if (!serviceKey) {
    return NextResponse.json(
      { error: 'SERVICE_API_KEY not configured on server' },
      { status: 500 },
    )
  }

  const authHeader = request.headers.get('authorization')
  const token = authHeader?.replace(/^Bearer\s+/i, '')
  if (token !== serviceKey) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Dynamic import to avoid circular dependency at module level
    const { autoCloseAllPositions } = await import('@/lib/auto-close')

    await logWarn('system', 'MT5 disconnect detected by heartbeat monitor — initiating emergency close of all positions')

    const result = await autoCloseAllPositions()

    return NextResponse.json({
      action: 'emergency_close_all',
      ...result,
      message: `Closed ${result.closed} positions, ${result.failed} failed, ${result.skipped} skipped`,
    })
  } catch (e: any) {
    await logError('system', 'MT5 disconnect emergency close failed', e?.stack || String(e))
    return NextResponse.json(
      { error: 'Emergency close failed', detail: e.message },
      { status: 500 },
    )
  }
}

/**
 * GET /api/health/mt5-disconnect
 * Basic health check endpoint.
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  })
}