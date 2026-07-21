import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/auth-server'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const user = await requireAdmin()
  if (user instanceof NextResponse) return user

  try {
    const { searchParams } = new URL(req.url)
    const name = searchParams.get('name') || undefined
    const limit = Math.min(Number(searchParams.get('limit') || 200), 1000)

    const metrics = await db.metric.findMany({
      where: name ? { name } : {},
      orderBy: { createdAt: 'desc' },
      take: limit,
    })
    return NextResponse.json({ metrics })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
