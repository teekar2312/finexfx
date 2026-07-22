'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/api'

const AUTO_TRADE_INTERVAL = 30000 // 30 seconds
const SLTP_CHECK_INTERVAL = 5000 // 5 seconds — check open trades for SL/TP hits
const EVENT_ALERT_INTERVAL = 60000 // 60 seconds — check for upcoming high-impact events

export interface AutoPilotStatus {
  enabled: boolean
  lastMessage: string | null
  lastBlockedReason: 'session' | 'market' | 'circuit-breaker' | null
  lastExecutedAt: number | null
}

/**
 * Auto-pilot hook:
 * 1. Always polls /api/trades/check-sl-tp every 5s to auto-close trades that
 *    hit stop-loss or take-profit (and apply trailing stops). This runs
 *    regardless of autoTradingEnabled — it's risk management.
 * 2. Always polls /api/economic-calendar/check-alerts every 60s to send email
 *    alerts 15 minutes before high-impact economic events.
 * 3. When autoTradingEnabled is true, also polls /api/ai/auto-trade every 30s
 *    to automatically execute high-confidence AI signals.
 *
 * Auto-trade status (blocked reason, last message) is surfaced via the
 * returned `status` object so the UI can display why auto-trading is idle.
 */
export function useAutoPilot() {
  const qc = useQueryClient()

  // Status state — only updated from async callbacks (setInterval), never from effect body
  const [lastMessage, setLastMessage] = useState<string | null>(null)
  const [lastBlockedReason, setLastBlockedReason] = useState<AutoPilotStatus['lastBlockedReason']>(null)
  const [lastExecutedAt, setLastExecutedAt] = useState<number | null>(null)

  // Refs for interval IDs — always cleared on cleanup, never use mount guards
  const sltpRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const tradeRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const eventRef = useRef<ReturnType<typeof setInterval> | null>(null)
  // Guard to prevent overlapping async calls within each interval
  const sltpActiveRef = useRef(false)
  const tradeActiveRef = useRef(false)
  const eventActiveRef = useRef(false)

  // Fetch risk settings to check if auto-trading is enabled
  const { data: riskData } = useQuery({
    queryKey: ['risk', 'autopilot'],
    queryFn: () => api.risk(),
    refetchInterval: 10000,
  })

  const autoEnabled = String(riskData?.settings?.autoTradingEnabled ?? 'false') === 'true'

  const status: AutoPilotStatus = {
    enabled: autoEnabled,
    lastMessage,
    lastBlockedReason,
    lastExecutedAt,
  }

  // Stable callback refs so intervals don't need to be recreated on every render
  const onTradeClosed = useCallback(
    (closed: Array<{ reason?: string; symbol?: string; pips?: number; pnl?: number }>) => {
      if (closed.length > 0) {
        for (const c of closed) {
          const emoji = c.reason === 'Take Profit' ? '🎯' : '🛑'
          toast(`${emoji} ${c.reason}: ${c.symbol}`, {
            description: `${(c as any).side?.toUpperCase() ?? ''} ${c.pips != null ? (c.pips > 0 ? '+' : '') + c.pips + ' pips' : ''} • P&L $${(c.pnl ?? 0).toFixed(2)}`,
          })
        }
        qc.invalidateQueries({ queryKey: ['dashboard'] })
        qc.invalidateQueries({ queryKey: ['trades'] })
        qc.invalidateQueries({ queryKey: ['risk-usage'] })
      }
    },
    [qc],
  )

  // ── SL/TP monitor (always on) ──
  useEffect(() => {
    const tick = async () => {
      if (sltpActiveRef.current) return
      sltpActiveRef.current = true
      try {
        const res = await fetch('/api/trades/check-sl-tp', { method: 'POST' })
        if (res.ok) {
          const data = await res.json()
          if (data.closed?.length > 0) onTradeClosed(data.closed)
        }
      } catch {
        // silent
      } finally {
        sltpActiveRef.current = false
      }
    }

    tick() // run immediately on mount
    sltpRef.current = setInterval(tick, SLTP_CHECK_INTERVAL)

    return () => {
      if (sltpRef.current) {
        clearInterval(sltpRef.current)
        sltpRef.current = null
      }
      sltpActiveRef.current = false
    }
  }, [onTradeClosed])

  // ── Economic event alert monitor (always on) ──
  useEffect(() => {
    const tick = async () => {
      if (eventActiveRef.current) return
      eventActiveRef.current = true
      try {
        const res = await fetch('/api/economic-calendar/check-alerts', { method: 'POST' })
        if (res.ok) {
          const data = await res.json()
          if (data.alerted?.length > 0) {
            for (const a of data.alerted) {
              toast.warning(`⚠️ Event Alert: ${a.title}`, {
                description: `${a.country} • ${a.minsUntil}m lagi • Pair: ${a.symbols}`,
              })
            }
            qc.invalidateQueries({ queryKey: ['notifications'] })
          }
        }
      } catch {
        // silent
      } finally {
        eventActiveRef.current = false
      }
    }

    tick()
    eventRef.current = setInterval(tick, EVENT_ALERT_INTERVAL)

    return () => {
      if (eventRef.current) {
        clearInterval(eventRef.current)
        eventRef.current = null
      }
      eventActiveRef.current = false
    }
  }, [qc])

  // ── Auto-trade executor (only when enabled) ──
  // Uses interval ref pattern: interval is created when autoEnabled=true
  // and explicitly cleared when autoEnabled=false. No fragile mount guards.
  useEffect(() => {
    if (!autoEnabled) {
      // Explicitly clear when disabled — no stale interval leaking
      if (tradeRef.current) {
        clearInterval(tradeRef.current)
        tradeRef.current = null
      }
      tradeActiveRef.current = false
      return
    }

    // If interval already exists, skip creation
    if (tradeRef.current) return

    const tick = async () => {
      if (tradeActiveRef.current) return
      tradeActiveRef.current = true
      try {
        const res = await api.aiAutoTrade()
        if (res.enabled && res.executed?.length > 0) {
          toast.success(`🤖 Auto-Pilot: ${res.executed.length} trade dieksekusi`, {
            description: res.executed.map((t: any) => `${t.side.toUpperCase()} ${t.lot} ${t.symbol}`).join(' • '),
          })
          qc.invalidateQueries({ queryKey: ['dashboard'] })
          qc.invalidateQueries({ queryKey: ['trades'] })
          qc.invalidateQueries({ queryKey: ['risk-usage'] })
          setLastExecutedAt(Date.now())
          setLastBlockedReason(null)
          setLastMessage(null)
        } else if (res.message) {
          // Determine blocked reason from message content
          let reason: AutoPilotStatus['lastBlockedReason'] = null
          const msg = res.message.toLowerCase()
          if (msg.includes('session') || msg.includes('sesi')) reason = 'session'
          else if (msg.includes('market') || msg.includes('tutup')) reason = 'market'
          else if (msg.includes('circuit') || msg.includes('risk limit') || msg.includes('daily')) reason = 'circuit-breaker'

          setLastMessage(res.message)
          setLastBlockedReason(reason)
        }
      } catch {
        // silent — don't spam on auth/network errors
      } finally {
        tradeActiveRef.current = false
      }
    }

    tick() // run immediately when enabled
    tradeRef.current = setInterval(tick, AUTO_TRADE_INTERVAL)

    return () => {
      if (tradeRef.current) {
        clearInterval(tradeRef.current)
        tradeRef.current = null
      }
      tradeActiveRef.current = false
    }
  }, [autoEnabled, qc])

  return { autoEnabled, status }
}