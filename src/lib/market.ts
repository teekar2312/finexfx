// Real-time market data layer — fetches live prices from the MT5 bridge.
// All price/tick data comes from the real MT5 terminal via the bridge service.
// No simulation — this is production real-trading mode.
//
// The MT5 bridge runs at http://localhost:3050 (mini-services/mt5-bridge).
// From server-side API routes, we call it directly.

import 'server-only'
import { SYMBOL_BASE } from './types'

const BRIDGE_URL = process.env.MT5_BRIDGE_URL || 'http://localhost:3050'
const BRIDGE_API_KEY = process.env.BRIDGE_API_KEY || ''
const REQUEST_TIMEOUT_MS = 4000

// ─────────────────────────────────────────────────────────────────────────────
// Live price fetch from MT5 bridge
// ─────────────────────────────────────────────────────────────────────────────

async function fetchWithTimeout(url: string, init?: RequestInit, timeoutMs = REQUEST_TIMEOUT_MS): Promise<Response> {
  const headers: Record<string, string> = init?.headers ?
    (init.headers as Record<string, string>) : {}
  if (BRIDGE_API_KEY && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${BRIDGE_API_KEY}`
  }
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...init, headers, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Fetch the current bid/ask for a symbol from the MT5 bridge.
 * Returns null if the bridge is offline or the symbol is unavailable.
 */
async function fetchTick(symbol: string): Promise<{ bid: number; ask: number; spread: number } | null> {
  try {
    const res = await fetchWithTimeout(`${BRIDGE_URL}/tick/${symbol}`)
    if (!res.ok) return null
    const data = await res.json() as { tick?: { bid?: number; ask?: number; spread?: number } }
    const tick = data.tick
    if (!tick || typeof tick.bid !== 'number' || typeof tick.ask !== 'number') return null
    const base = SYMBOL_BASE[symbol]
    const spread = tick.spread ?? Math.abs(tick.ask - tick.bid)
    return {
      bid: Number(tick.bid.toFixed(base.digits)),
      ask: Number(tick.ask.toFixed(base.digits)),
      spread: Number(spread.toFixed(base.digits)),
    }
  } catch {
    return null
  }
}

/**
 * Current bid/ask for a symbol. Fetches live from MT5 bridge.
 * If the bridge is offline, throws an error — real trading requires real prices.
 */
export async function bidAsk(symbol: string, _t?: number): Promise<{ bid: number; ask: number; spread: number }> {
  const tick = await fetchTick(symbol)
  if (!tick) {
    throw new Error(
      `Cannot fetch live price for ${symbol} — MT5 bridge offline. ` +
      `Ensure the mt5-bridge service is running and connected to a live MT5 terminal.`
    )
  }
  return tick
}

/**
 * Current mid price for a symbol (live from MT5 bridge).
 */
export async function priceAt(symbol: string, _t?: number): Promise<number> {
  const { bid, ask } = await bidAsk(symbol)
  const base = SYMBOL_BASE[symbol]
  return Number(((bid + ask) / 2).toFixed(base.digits))
}

// Re-export pure math functions from market-math.ts (no server-only guard,
// safe for Client Components). This keeps backward compatibility for server-side
// callers that import from '@/lib/market'.
export { calcPnl, calcLotSize } from './market-math'

/**
 * Build a spark array of N price points from historical bars fetched via MT5 bridge.
 * Falls back to a flat line at the current price if bars are unavailable.
 */
export async function sparkline(symbol: string, points: number = 40, _t?: number): Promise<number[]> {
  try {
    const res = await fetchWithTimeout(`${BRIDGE_URL}/bars/${symbol}?tf=M1&count=${points}`)
    if (res.ok) {
      const data = await res.json() as { bars?: Array<{ close: number }> }
      const bars = data.bars
      if (Array.isArray(bars) && bars.length > 0) {
        return bars.map(b => b.close)
      }
    }
  } catch {
    // bridge offline — fall through to fallback
  }
  // Fallback: flat line at the base price (prevents UI from breaking, but signals no data)
  const base = SYMBOL_BASE[symbol]
  return Array(points).fill(base.price)
}

/**
 * Fetch 24h high/low from MT5 bridge bars.
 * Falls back to base price (high=low=current) if unavailable.
 */
export async function dayHighLow(symbol: string, _t?: number): Promise<{ high: number; low: number }> {
  try {
    // Fetch 24h of M15 bars = 96 bars
    const res = await fetchWithTimeout(`${BRIDGE_URL}/bars/${symbol}?tf=M15&count=96`)
    if (res.ok) {
      const data = await res.json() as { bars?: Array<{ high: number; low: number }> }
      const bars = data.bars
      if (Array.isArray(bars) && bars.length > 0) {
        const high = Math.max(...bars.map(b => b.high))
        const low = Math.min(...bars.map(b => b.low))
        return { high, low }
      }
    }
  } catch {
    // fall through
  }
  const base = SYMBOL_BASE[symbol]
  return { high: base.price, low: base.price }
}

/**
 * 24h change % — compares current price to price 24h ago from MT5 bars.
 * Returns 0 if unavailable.
 */
export async function changePct24h(symbol: string, _t?: number): Promise<number> {
  try {
    const res = await fetchWithTimeout(`${BRIDGE_URL}/bars/${symbol}?tf=H1&count=25`)
    if (res.ok) {
      const data = await res.json() as { bars?: Array<{ close: number }> }
      const bars = data.bars
      if (Array.isArray(bars) && bars.length >= 2) {
        const past = bars[0].close
        const now = bars[bars.length - 1].close
        return Number((((now - past) / past) * 100).toFixed(2))
      }
    }
  } catch {
    // fall through
  }
  return 0
}
