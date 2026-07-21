import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/auth-server'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const user = await requireAdmin()
  if (user instanceof NextResponse) return user

  try {
    const { searchParams } = new URL(req.url)
    const userId = searchParams.get('userId') || undefined
    const action = searchParams.get('action') || undefined
    const limit = Math.min(Number(searchParams.get('limit') || 100), 500)

    const logs = await db.auditLog.findMany({
      where: {
        ...(userId ? { userId } : {}),
        ...(action ? { action } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })
    return NextResponse.json({ logs })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
