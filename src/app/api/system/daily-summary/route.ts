import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth-server'
import { generateDailySummary } from '@/lib/daily-summary'

export const dynamic = 'force-dynamic'

/**
 * POST /api/system/daily-summary
 * Manually trigger or schedule a daily P&L summary.
 * Sends results via configured webhooks (Discord/Telegram/Slack).
 */
export async function POST() {
  const user = await requireAdmin()
  if (user instanceof NextResponse) return user

  try {
    const summary = await generateDailySummary()
    return NextResponse.json({ success: true, ...summary })
  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: e.message },
      { status: 500 },
    )
  }
}