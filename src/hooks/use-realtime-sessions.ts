'use client'

import { useMemo } from 'react'
import { useClock } from '@/lib/format'
import { getSessions, getOverlap, isScalpingWindow } from '@/lib/sessions'
import type { TradingSession } from '@/lib/types'

/**
 * Client-side realtime trading sessions.
 *
 * Sessions are pure UTC math — no network call needed.
 * This hook re-computes every second via useClock() so progress
 * bars and active/closed badges update smoothly.
 */
export function useRealtimeSessions() {
  const now = useClock()

  return useMemo(() => {
    const base = getSessions(now)
    const overlap = getOverlap(now)
    const scalpingWindow = isScalpingWindow(now)

    // Combine into a single TradingSession[] (same shape as SessionState)
    const sessions: TradingSession[] = [...base, overlap]

    return { sessions, overlap, scalpingWindow }
  }, [now])
}