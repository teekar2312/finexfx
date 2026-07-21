import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/auth-server'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const user = await requireAdmin()
  if (user instanceof NextResponse) return user

  try {
    const limit = Math.min(Number(req.nextUrl.searchParams.get('limit') || 50), 200)
    const errors = await db.log.findMany({
      where: { level: { in: ['error', 'warn'] } },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })
    const stats = {
      total: errors.length,
      errors: errors.filter(e => e.level === 'error').length,
      warnings: errors.filter(e => e.level === 'warn').length,
    }
    return NextResponse.json({ errors, stats })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
