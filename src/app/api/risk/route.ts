import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { logInfo } from '@/lib/logger'
import { requireAdmin } from '@/lib/auth-server'
import { auditLog } from '@/lib/audit'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const rows = await db.riskSetting.findMany()
    const settings: Record<string, string> = {}
    for (const r of rows) settings[r.key] = r.value
    return NextResponse.json({ settings })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to fetch risk settings' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  const user = await requireAdmin()
  if (user instanceof NextResponse) return user

  try {
    const body = await req.json().catch(() => ({}))
    const incoming = body?.settings
    if (!incoming || typeof incoming !== 'object') {
      return NextResponse.json({ error: 'settings object is required' }, { status: 400 })
    }

    const keys = Object.keys(incoming)
    for (const key of keys) {
      let value = String(incoming[key])

      // Server-side validation & clamping for known numeric settings
      if (key === 'autoTradeConfidenceThreshold') {
        const n = parseFloat(value)
        if (Number.isFinite(n)) value = String(Math.max(30, Math.min(95, Math.round(n / 5) * 5)))
      } else if (key === 'autoTradeSignalMaxAgeMin') {
        const n = parseFloat(value)
        if (Number.isFinite(n)) value = String(Math.max(1, Math.min(60, Math.round(n))))
      } else if (key === 'maxOpenPositions') {
        const n = parseInt(value, 10)
        if (Number.isFinite(n)) value = String(Math.max(1, Math.min(20, n)))
      } else if (key === 'riskPerTradePct' || key === 'dailyRiskLimitPct' || key === 'dailyTargetPct' || key === 'maxRiskPerTradePct') {
        const n = parseFloat(value)
        if (Number.isFinite(n)) value = String(Math.max(0, Math.min(100, n)))
      } else if (key === 'stopLossPipsMin' || key === 'stopLossPipsMax' || key === 'xauSlPipsMax') {
        const n = parseFloat(value)
        if (Number.isFinite(n)) value = String(Math.max(1, Math.min(100, n)))
      } else if (key === 'riskRewardRatio' || key === 'xauRiskRewardRatio') {
        const n = parseFloat(value)
        if (Number.isFinite(n)) value = String(Math.max(0.5, Math.min(5.0, Math.round(n * 10) / 10)))
      } else if (key === 'maxLotSizePerTrade' || key === 'maxTotalLotSize') {
        const n = parseFloat(value)
        if (Number.isFinite(n)) value = String(Math.max(0.01, Math.min(100, n)))
      } else if (key === 'marginCallLevel') {
        const n = parseFloat(value)
        if (Number.isFinite(n)) value = String(Math.max(10, Math.min(200, n)))
      }

      await db.riskSetting.upsert({
        where: { key },
        create: { key, value },
        update: { value },
      })
    }

    const rows = await db.riskSetting.findMany()
    const settings: Record<string, string> = {}
    for (const r of rows) settings[r.key] = r.value

    await logInfo('risk', 'Risk settings updated', { keys })
    await auditLog(user, { action: 'risk.update', entityType: 'risk_settings', metadata: { keys } })
    return NextResponse.json({ settings })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to update risk settings' }, { status: 500 })
  }
}
