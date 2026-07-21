// Price-feed WebSocket mini-service for FinexFX AI Trading dashboard.
// REAL TRADING ONLY — fetches live prices from the MT5 bridge service.
//
// Run:  bun --hot index.ts      (dev)   |   bun index.ts   (prod)
// Port: 3003  ·  path: '/'  ·  cors: *
// Caddy forwards browser `io('/?XTransformPort=3003')` to this port.
//
// This service polls the MT5 bridge (port 3050) for live ticks every 1s
// and broadcasts them to all connected dashboard clients via socket.io.
// No price simulation — all data comes from the real MT5 terminal.

import { createServer, Server as HttpServer } from 'http'
import { Server, Socket } from 'socket.io'

// ──────────────────────────────────────────────────────────────────────────────
// 1. Symbol metadata (digits/pip for rounding — actual prices come from MT5)
// ──────────────────────────────────────────────────────────────────────────────

const SYMBOL_BASE: Record<string, { price: number; pip: number; digits: number }> = {
  EURUSD: { price: 1.085, pip: 0.0001, digits: 5 },
  USDJPY: { price: 156.4, pip: 0.01, digits: 3 },
  GBPUSD: { price: 1.272, pip: 0.0001, digits: 5 },
  XAUUSD: { price: 2335.5, pip: 0.1, digits: 2 },
}

const SYMBOLS = Object.keys(SYMBOL_BASE)

// ──────────────────────────────────────────────────────────────────────────────
// 2. MT5 bridge client — fetches live ticks
// ──────────────────────────────────────────────────────────────────────────────

const MT5_BRIDGE_URL = process.env.MT5_BRIDGE_URL || 'http://localhost:3050'
const FETCH_TIMEOUT_MS = 4000

async function fetchWithTimeout(url: string, timeoutMs = FETCH_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

interface BridgeTick {
  bid?: number
  ask?: number
  spread?: number
  time?: string
}

/** Fetch a single tick from the MT5 bridge. Returns null if unavailable. */
async function fetchTick(symbol: string): Promise<BridgeTick | null> {
  try {
    const res = await fetchWithTimeout(`${MT5_BRIDGE_URL}/tick/${symbol}`)
    if (!res.ok) return null
    const data = await res.json() as { tick?: BridgeTick }
    return data.tick ?? null
  } catch {
    return null
  }
}

/** Fetch historical bars from the MT5 bridge for sparkline + changePct. */
async function fetchBars(symbol: string, tf: string, count: number): Promise<Array<{ close: number; high: number; low: number }>> {
  try {
    const res = await fetchWithTimeout(`${MT5_BRIDGE_URL}/bars/${symbol}?tf=${tf}&count=${count}`)
    if (!res.ok) return []
    const data = await res.json() as { bars?: Array<{ close: number; high: number; low: number }> }
    return data.bars ?? []
  } catch {
    return []
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// 3. Quote / payload types
// ──────────────────────────────────────────────────────────────────────────────

interface SymbolQuote {
  symbol: string
  price: number
  bid: number
  ask: number
  spread: number
  changePct: number
  spark: number[]
  updatedAt: number
}

interface TickPayload {
  symbols: SymbolQuote[]
  ts: number
}

/** Build a live snapshot of all symbols by fetching ticks from MT5 bridge. */
async function buildSnapshot(): Promise<SymbolQuote[]> {
  const results = await Promise.all(
    SYMBOLS.map(async (symbol) => {
      const tick = await fetchTick(symbol)
      const base = SYMBOL_BASE[symbol]

      if (!tick || typeof tick.bid !== 'number' || typeof tick.ask !== 'number') {
        // Bridge offline or symbol unavailable — return a zeroed quote so the
        // dashboard can display "no data" rather than crash.
        return {
          symbol,
          price: 0,
          bid: 0,
          ask: 0,
          spread: 0,
          changePct: 0,
          spark: Array(40).fill(0),
          updatedAt: Date.now(),
        }
      }

      const spread = tick.spread ?? Math.abs(tick.ask - tick.bid)
      const price = Number(((tick.bid + tick.ask) / 2).toFixed(base.digits))

      // Fetch sparkline (40 M1 bars) + 24h changePct in parallel
      const [sparkBars, changeBars] = await Promise.all([
        fetchBars(symbol, 'M1', 40),
        fetchBars(symbol, 'H1', 25),
      ])

      const spark = sparkBars.length > 0
        ? sparkBars.map((b) => b.close)
        : Array(40).fill(price)

      let changePct = 0
      if (changeBars.length >= 2) {
        const past = changeBars[0].close
        const now = changeBars[changeBars.length - 1].close
        if (past > 0) {
          changePct = Number((((now - past) / past) * 100).toFixed(2))
        }
      }

      return {
        symbol,
        price,
        bid: Number(tick.bid.toFixed(base.digits)),
        ask: Number(tick.ask.toFixed(base.digits)),
        spread: Number(spread.toFixed(base.digits)),
        changePct,
        spark,
        updatedAt: Date.now(),
      }
    }),
  )
  return results
}

// ──────────────────────────────────────────────────────────────────────────────
// 4. Trading sessions (UTC). London 7-16, NY 12-21, Overlap 12-16.
//    scalpingWindow = London + Overlap (7-16 UTC).
// ──────────────────────────────────────────────────────────────────────────────

interface SessionState {
  name: string
  openUtc: number
  closeUtc: number
  active: boolean
  progress: number
}

function sessionActive(open: number, close: number, h: number): boolean {
  if (open < close) return h >= open && h < close
  return h >= open || h < close
}

function sessionProgress(open: number, close: number, h: number): number {
  if (open < close) {
    if (h >= open && h < close) return Number(((h - open) / (close - open)).toFixed(3))
    return 0
  }
  if (h >= open) return Number(((h - open) / (24 - open + close)).toFixed(3))
  if (h < close) return Number(((24 - open + h) / (24 - open + close)).toFixed(3))
  return 0
}

function buildSessions(now: Date = new Date()): SessionState[] {
  const h = now.getUTCHours() + now.getUTCMinutes() / 60
  const defs = [
    { name: 'London', openUtc: 7, closeUtc: 16 },
    { name: 'New York', openUtc: 12, closeUtc: 21 },
    { name: 'Overlap', openUtc: 12, closeUtc: 16 },
    { name: 'Tokyo', openUtc: 0, closeUtc: 9 },
    { name: 'Sydney', openUtc: 21, closeUtc: 6 },
  ]
  return defs.map((s) => ({
    name: s.name,
    openUtc: s.openUtc,
    closeUtc: s.closeUtc,
    active: sessionActive(s.openUtc, s.closeUtc, h),
    progress: sessionProgress(s.openUtc, s.closeUtc, h),
  }))
}

function isScalpingWindow(now: Date = new Date()): boolean {
  const h = now.getUTCHours()
  return h >= 7 && h < 16
}

// ──────────────────────────────────────────────────────────────────────────────
// 5. HTTP + socket.io server
// ──────────────────────────────────────────────────────────────────────────────

const PORT = 3003
const PRICE_FEED_TOKEN = process.env.PRICE_FEED_TOKEN || ''
const httpServer: HttpServer = createServer()
const io = new Server(httpServer, {
  path: '/',
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  pingTimeout: 60000,
  pingInterval: 25000,
})

// P1: WebSocket authentication — require token if PRICE_FEED_TOKEN is set
if (PRICE_FEED_TOKEN) {
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token
    if (token !== PRICE_FEED_TOKEN) {
      console.warn(`[price-feed] unauthorized socket connection from ${socket.handshake.address}`)
      return next(new Error('Unauthorized — invalid or missing token'))
    }
    next()
  })
  console.log('🔒 Price-feed WebSocket authentication enabled')
} else {
  console.warn('⚠️  PRICE_FEED_TOKEN not set — WebSocket is unsecured')
}

const startedAt = Date.now()
let connectionCount = 0

io.on('connection', (socket: Socket) => {
  connectionCount++
  console.log(`[price-feed] client connected: ${socket.id} (total=${connectionCount})`)

  // Welcome handshake with current snapshot (async fetch).
  buildSnapshot().then((symbols) => {
    const now = Date.now()
    socket.emit('welcome', {
      connected: true,
      symbols,
      ts: now,
    })
  })

  socket.on('subscribe', (payload: unknown, ack?: (res: unknown) => void) => {
    console.log(`[price-feed] subscribe from ${socket.id}:`, payload)
    if (typeof ack === 'function') ack({ ok: true, subscribed: true, ts: Date.now() })
  })

  // alert-check: fetch current price from MT5 bridge (no simulation).
  socket.on('alert-check', async (payload: { symbol?: string; price?: number; condition?: string }, ack?: (res: unknown) => void) => {
    console.log(`[price-feed] alert-check from ${socket.id}:`, payload)
    let currentPrice: number | null = null
    if (payload?.symbol) {
      const tick = await fetchTick(payload.symbol)
      if (tick && typeof tick.bid === 'number' && typeof tick.ask === 'number') {
        currentPrice = Number(((tick.bid + tick.ask) / 2).toFixed(5))
      }
    }
    const echo = {
      ok: true,
      received: payload,
      currentPrice,
      ts: Date.now(),
    }
    if (typeof ack === 'function') ack(echo)
    else socket.emit('alert-check', echo)
  })

  socket.on('disconnect', (reason: string) => {
    connectionCount = Math.max(0, connectionCount - 1)
    console.log(`[price-feed] client disconnected: ${socket.id} reason=${reason} (total=${connectionCount})`)
  })

  socket.on('error', (err: Error) => {
    console.error(`[price-feed] socket error (${socket.id}):`, err)
  })
})

// ──────────────────────────────────────────────────────────────────────────────
// 6. Periodic emitters
// ──────────────────────────────────────────────────────────────────────────────

// Tick broadcast every 1000ms — fetches live prices from MT5 bridge.
let consecutiveFailures = 0

const tickTimer = setInterval(async () => {
  try {
    const symbols = await buildSnapshot()
    const t = Date.now()
    const payload: TickPayload = { symbols, ts: t }
    io.emit('tick', payload)

    // Health monitoring — detect MT5 bridge outages and emit status events.
    const allZero = symbols.every((s) => s.price === 0)
    if (allZero) {
      consecutiveFailures++
      if (consecutiveFailures === 5) {
        io.emit('bridge-status', { status: 'degraded', message: 'MT5 bridge offline — prices unavailable' })
        console.warn('[price-feed] MT5 bridge appears offline (5 consecutive failures)')
      }
    } else if (consecutiveFailures > 0) {
      consecutiveFailures = 0
      io.emit('bridge-status', { status: 'online', message: 'MT5 bridge online' })
      console.log('[price-feed] MT5 bridge recovered')
    }
  } catch (e) {
    console.error('[price-feed] tick broadcast error:', (e as Error).message)
  }
}, 1000)

// System status every 15 seconds.
const statusTimer = setInterval(() => {
  const now = new Date()
  io.emit('system-status', {
    sessions: buildSessions(now),
    scalpingWindow: isScalpingWindow(now),
    uptime: Date.now() - startedAt,
    connectedClients: connectionCount,
    ts: now.getTime(),
  })
}, 15000)

// NOTE: Simulated trade / AI-signal / news events have been REMOVED.
// Real trading mode — the dashboard pulls trade history, AI signals, and news
// from the Next.js API routes (which read from the database), not from
// this WebSocket service. This service only broadcasts live price ticks.

// ──────────────────────────────────────────────────────────────────────────────
// 7. Boot + graceful shutdown
// ──────────────────────────────────────────────────────────────────────────────

httpServer.listen(PORT, () => {
  console.log(`Price-feed WS running on port ${PORT} (real MT5 prices from ${MT5_BRIDGE_URL})`)
})

function shutdown(signal: string) {
  console.log(`[price-feed] received ${signal}, shutting down...`)
  clearInterval(tickTimer)
  clearInterval(statusTimer)
  io.close(() => {
    httpServer.close(() => {
      console.log('[price-feed] closed')
      process.exit(0)
    })
  })
  setTimeout(() => process.exit(0), 3000).unref()
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))

export { buildSnapshot, fetchTick }
