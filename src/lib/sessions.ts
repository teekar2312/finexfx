// Trading sessions calculator (UTC based)

export interface SessionState {
  name: string
  city: string
  openUtc: number
  closeUtc: number
  active: boolean
  progress: number // 0..1
  nextOpen: string // ISO
}

const SESSIONS = [
  { name: 'Sydney', city: 'Sydney', openUtc: 21, closeUtc: 6 },
  { name: 'Tokyo', city: 'Tokyo', openUtc: 0, closeUtc: 9 },
  { name: 'London', city: 'London', openUtc: 7, closeUtc: 16 },
  { name: 'New York', city: 'New York', openUtc: 12, closeUtc: 21 },
]

export function getSessions(now: Date = new Date()): SessionState[] {
  const h = now.getUTCHours() + now.getUTCMinutes() / 60
  return SESSIONS.map((s) => {
    let active: boolean
    let progress = 0
    if (s.openUtc < s.closeUtc) {
      active = h >= s.openUtc && h < s.closeUtc
      if (active) progress = (h - s.openUtc) / (s.closeUtc - s.openUtc)
    } else {
      active = h >= s.openUtc || h < s.closeUtc
      if (active) {
        progress = h >= s.openUtc ? (h - s.openUtc) / (24 - s.openUtc + s.closeUtc) : (24 - s.openUtc + h) / (24 - s.openUtc + s.closeUtc)
      }
    }
    // next open
    let nextOpen: Date
    if (active) {
      nextOpen = new Date(now)
      nextOpen.setUTCDate(nextOpen.getUTCDate() + 1)
      nextOpen.setUTCHours(s.openUtc, 0, 0, 0)
    } else {
      nextOpen = new Date(now)
      if (h > s.openUtc) nextOpen.setUTCDate(nextOpen.getUTCDate() + 1)
      nextOpen.setUTCHours(s.openUtc, 0, 0, 0)
    }
    return { ...s, active, progress: Number(progress.toFixed(3)), nextOpen: nextOpen.toISOString() }
  })
}

export function getOverlap(now: Date = new Date()): SessionState {
  const h = now.getUTCHours() + now.getUTCMinutes() / 60
  // London 7-16, NY 12-21 → overlap 12-16
  const open = 12
  const close = 16
  const active = h >= open && h < close
  const progress = active ? (h - open) / (close - open) : 0
  const nextOpen = new Date(now)
  if (h >= open) nextOpen.setUTCDate(nextOpen.getUTCDate() + 1)
  nextOpen.setUTCHours(open, 0, 0, 0)
  return { name: 'Overlap', city: 'London-NY', openUtc: open, closeUtc: close, active, progress: Number(progress.toFixed(3)), nextOpen: nextOpen.toISOString() }
}

export function isScalpingWindow(now: Date = new Date()): boolean {
  // London + Overlap = 7-16 UTC
  const h = now.getUTCHours()
  return h >= 7 && h < 16
}

/**
 * Check if a session ID (as stored in risk settings) is currently active.
 * Supported IDs: 'london', 'ny', 'tokyo', 'sydney', 'overlap'.
 */
export function isSessionIdActive(sessionId: string, now: Date = new Date()): boolean {
  switch (sessionId) {
    case 'london': {
      const h = now.getUTCHours() + now.getUTCMinutes() / 60
      return h >= 7 && h < 16
    }
    case 'ny': {
      const h = now.getUTCHours() + now.getUTCMinutes() / 60
      return h >= 12 && h < 21
    }
    case 'tokyo': {
      const h = now.getUTCHours() + now.getUTCMinutes() / 60
      return h >= 0 && h < 9
    }
    case 'sydney': {
      const h = now.getUTCHours() + now.getUTCMinutes() / 60
      // Sydney wraps midnight: 21:00 UTC → 06:00 UTC
      return h >= 21 || h < 6
    }
    case 'overlap': {
      const h = now.getUTCHours() + now.getUTCMinutes() / 60
      return h >= 12 && h < 16
    }
    default:
      return false
  }
}

/**
 * Check if ANY of the given session IDs is currently active.
 * @param sessionIds - comma-separated string like 'london,overlap' or array of IDs
 * @returns object with active flag and details
 */
export function isAnySessionActive(sessionIds: string | string[], now: Date = new Date()): {
  active: boolean
  activeSessions: string[]
  allSessions: string[]
} {
  const ids = typeof sessionIds === 'string'
    ? sessionIds.split(',').map(s => s.trim()).filter(Boolean)
    : sessionIds

  const activeSessions = ids.filter(id => isSessionIdActive(id, now))
  return {
    active: activeSessions.length > 0,
    activeSessions,
    allSessions: ids,
  }
}
