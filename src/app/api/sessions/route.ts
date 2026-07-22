import { NextResponse } from 'next/server'
import { getSessions, getOverlap, isScalpingWindow, type SessionState } from '@/lib/sessions'
import { requireAuth } from '@/lib/auth-server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const user = await requireAuth()
  if (user instanceof NextResponse) return user

  try {
    const sessions: SessionState[] = getSessions()
    const overlap: SessionState = getOverlap()
    const scalpingWindow = isScalpingWindow()
    return NextResponse.json({ sessions, overlap, scalpingWindow })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
