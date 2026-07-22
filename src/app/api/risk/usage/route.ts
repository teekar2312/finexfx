import { NextResponse } from 'next/server'
import { computeRiskUsage } from '@/lib/risk-usage'
import { requireAuth } from '@/lib/auth-server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const user = await requireAuth()
  if (user instanceof NextResponse) return user

  try {
    const usage = await computeRiskUsage()
    return NextResponse.json(usage)
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Failed to compute risk usage' },
      { status: 500 },
    )
  }
}
