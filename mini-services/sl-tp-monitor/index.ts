// Server-side monitoring mini-service for FinexFX AI Trading System.
//
// This service runs INDEPENDENTLY of the browser. It performs 5 jobs:
//
//   1. SL/TP Check (every 5s) — polls POST /api/trades/check-sl-tp to auto-close
//      trades that hit stop-loss or take-profit, and apply trailing stop adjustments.
//
//   2. Position Reconciliation (every 30s) — polls POST /api/mt5/reconcile to sync
//      local Trade records with MT5 bridge positions. Detects trades that were
//      closed externally on MT5 (e.g., SL hit on broker side) and updates local DB.
//
//   3. AI Auto-Trade (every 30s) — polls POST /api/ai/auto-trade to automatically
//      execute high-confidence AI signals. This makes auto-trading truly server-side
//      and independent of the browser being open.
//
//   4. AI Signal Evaluation (every 5 min) — polls POST /api/ai/evaluate to evaluate
//      pending AI signals (compare predicted direction with actual price movement).
//
//   5. Database Backup (every 1 hour) — polls POST /api/system/backup to create
//      a timestamped copy of the SQLite database. Keeps last 24 backups.
//
// This ensures monitoring AND auto-trading continue even when:
//   - The browser/dashboard tab is closed
//   - The user's machine is asleep
//   - The client-side useAutoPilot hook is not running
//
// Run:  bun --hot index.ts      (dev)   |   bun index.ts   (prod)
// No port needed — this is a polling worker, not a server.

const API_BASE = 'http://localhost:3000'
const POLL_INTERVAL_MS = 5000 // 5 seconds — SL/TP check cadence
const RECONCILE_INTERVAL_MS = 30_000 // 30 seconds — reconciliation cadence
const AUTO_TRADE_INTERVAL_MS = 30_000 // 30 seconds — auto-trade execution cadence
const EVALUATE_INTERVAL_MS = 5 * 60_000 // 5 minutes — AI signal evaluation
const BACKUP_INTERVAL_MS = 60 * 60_000 // 1 hour — database backup
const API_TIMEOUT_MS = 8000

interface CheckResult {
  closed: Array<{
    tradeId?: string
    symbol?: string
    side?: string
    reason?: string
    pnl?: number
    pips?: number
    closePrice?: number
  }>
  trailed: Array<{ tradeId?: string; symbol?: string; newSl?: number; oldSl?: number }>
  skipped?: Array<{ id?: string; symbol?: string; reason?: string }>
  checked: number
}

interface ReconcileResult {
  report: {
    checked: number
    synced: number
    updated: number
    orphaned: number
    errors: number
  }
}

interface AutoTradeResult {
  enabled: boolean
  message?: string
  executed?: Array<{ symbol: string; side: string; lot: number }>
  rejected?: Array<{ symbol: string; violations: string[] }>
  openPositions?: number
  marketClosed?: boolean
  sessionInfo?: { utcTime: string; configuredSessions: string[] }
}

interface EvaluateResult {
  evaluated: number
  correct: number
  wrong: number
  skipped: number
}

interface BackupResult {
  ok: boolean
  backup?: { filename: string; sizeMB: number; createdAt: string }
  message: string
}

// Service API key for authenticating with protected API routes.
// Must match SERVICE_API_KEY env var in the Next.js app's .env file.
const SERVICE_API_KEY = process.env.SERVICE_API_KEY || ''

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs: number): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    // Add X-Service-Key header to all requests for service-to-service auth
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    }
    if (SERVICE_API_KEY) {
      headers['X-Service-Key'] = SERVICE_API_KEY
    }
    const res = await fetch(url, { ...options, headers, signal: controller.signal })
    return res
  } finally {
    clearTimeout(timeout)
  }
}

async function checkSlTp(): Promise<CheckResult | null> {
  try {
    const res = await fetchWithTimeout(`${API_BASE}/api/trades/check-sl-tp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: 'server-cron' }),
    }, API_TIMEOUT_MS)

    if (!res.ok) {
      console.error(`[${new Date().toISOString()}] check-sl-tp returned ${res.status} ${res.statusText}`)
      return null
    }

    const data = (await res.json()) as CheckResult
    return data
  } catch (e: any) {
    if (e?.name === 'AbortError') {
      console.warn(`[${new Date().toISOString()}] check-sl-tp timeout (${API_TIMEOUT_MS}ms)`)
    } else if (e?.code === 'ECONNREFUSED') {
      // Dev server not running — wait quietly
    } else {
      console.error(`[${new Date().toISOString()}] check-sl-tp error:`, e?.message || e)
    }
    return null
  }
}

async function reconcilePositions(): Promise<ReconcileResult | null> {
  try {
    const res = await fetchWithTimeout(`${API_BASE}/api/mt5/reconcile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }, API_TIMEOUT_MS)

    if (!res.ok) {
      console.error(`[${new Date().toISOString()}] reconcile returned ${res.status}`)
      return null
    }

    return (await res.json()) as ReconcileResult
  } catch (e: any) {
    if (e?.code !== 'ECONNREFUSED' && e?.name !== 'AbortError') {
      console.error(`[${new Date().toISOString()}] reconcile error:`, e?.message || e)
    }
    return null
  }
}

/**
 * Auto-trade executor — calls POST /api/ai/auto-trade which:
 * 1. Checks autoTradingEnabled in DB
 * 2. Checks market open / session gate / circuit breaker
 * 3. Scans AI signals and executes trades for qualifying signals
 *
 * This makes auto-trading truly server-side, independent of the browser.
 */
async function executeAutoTrade(): Promise<AutoTradeResult | null> {
  try {
    const res = await fetchWithTimeout(`${API_BASE}/api/ai/auto-trade`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: 'server-cron' }),
    }, 15_000) // 15s timeout — trade execution can take longer

    if (!res.ok) {
      // 401 = not authenticated (expected if SERVICE_API_KEY not configured)
      if (res.status === 401) return null
      console.error(`[${new Date().toISOString()}] auto-trade returned ${res.status} ${res.statusText}`)
      return null
    }

    const data = (await res.json()) as AutoTradeResult
    return data
  } catch (e: any) {
    if (e?.name === 'AbortError') {
      console.warn(`[${new Date().toISOString()}] auto-trade timeout (15s)`)
    } else if (e?.code !== 'ECONNREFUSED') {
      console.error(`[${new Date().toISOString()}] auto-trade error:`, e?.message || e)
    }
    return null
  }
}

async function evaluateSignals(): Promise<EvaluateResult | null> {
  try {
    const res = await fetchWithTimeout(`${API_BASE}/api/ai/evaluate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }, API_TIMEOUT_MS)

    if (!res.ok) {
      console.error(`[${new Date().toISOString()}] evaluate returned ${res.status}`)
      return null
    }

    return (await res.json()) as EvaluateResult
  } catch (e: any) {
    if (e?.code !== 'ECONNREFUSED' && e?.name !== 'AbortError') {
      console.error(`[${new Date().toISOString()}] evaluate error:`, e?.message || e)
    }
    return null
  }
}

async function backupDatabase(): Promise<BackupResult | null> {
  try {
    const res = await fetchWithTimeout(`${API_BASE}/api/system/backup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, 30_000) // 30s timeout for backup (file copy can take time)

    if (!res.ok) {
      console.error(`[${new Date().toISOString()}] backup returned ${res.status}`)
      return null
    }

    return (await res.json()) as BackupResult
  } catch (e: any) {
    if (e?.code !== 'ECONNREFUSED' && e?.name !== 'AbortError') {
      console.error(`[${new Date().toISOString()}] backup error:`, e?.message || e)
    }
    return null
  }
}

function logSlTpResult(result: CheckResult): void {
  const ts = new Date().toISOString()
  const { closed, trailed, checked } = result

  if (closed.length === 0 && trailed.length === 0) {
    return // Only log when something happens
  }

  console.log(`\n[${ts}] ─── SL/TP Monitor ───`)
  console.log(`  Checked: ${checked} open trade(s)`)

  for (const c of closed) {
    const pnlStr = c.pnl !== undefined ? (c.pnl >= 0 ? `+$${c.pnl.toFixed(2)}` : `-$${Math.abs(c.pnl).toFixed(2)}`) : '?'
    const pipsStr = c.pips !== undefined ? `${c.pips >= 0 ? '+' : ''}${c.pips.toFixed(1)}p` : ''
    console.log(`  🔴 CLOSED: ${c.symbol} ${c.side?.toUpperCase()} — ${c.reason} @ ${c.closePrice} → ${pnlStr} (${pipsStr})`)
  }

  for (const t of trailed) {
    console.log(`  📈 TRAILED: ${t.symbol} — SL ${t.oldSl} → ${t.newSl}`)
  }
  console.log('')
}

function logReconcileResult(result: ReconcileResult): void {
  const r = result.report
  if (r.checked === 0 && r.orphaned === 0) return // Nothing to report

  const ts = new Date().toISOString()
  console.log(`[${ts}] ─── Reconciliation ───`)
  console.log(`  Checked: ${r.checked} | Synced: ${r.synced} | Updated: ${r.updated} | Orphaned: ${r.orphaned} | Errors: ${r.errors}`)
  if (r.synced > 0) {
    console.log(`  ⚠️  ${r.synced} trade(s) were closed externally on MT5 — synced locally`)
  }
  if (r.orphaned > 0) {
    console.log(`  ⚠️  ${r.orphaned} orphaned position(s) on bridge (not in local DB)`)
  }
  console.log('')
}

function logAutoTradeResult(result: AutoTradeResult): void {
  if (!result.enabled) return // auto-trading is disabled in DB

  const ts = new Date().toISOString()

  if (result.executed?.length) {
    console.log(`[${ts}] 🤖 Auto-Trade: ${result.executed.length} trade(s) executed`)
    for (const t of result.executed) {
      console.log(`  ✅ ${t.side.toUpperCase()} ${t.lot} ${t.symbol}`)
    }
    return
  }

  if (result.rejected?.length) {
    console.log(`[${ts}] 🤖 Auto-Trade: ${result.rejected.length} signal(s) rejected`)
    for (const r of result.rejected) {
      console.log(`  ❌ ${r.symbol}: ${r.violations.join('; ')}`)
    }
    return
  }

  // Log idle reason (but only occasionally to avoid spam)
  if (result.message) {
    const msg = result.message.toLowerCase()
    // Only log session/market blocked once per 5 minutes (not every 30s)
    if (msg.includes('session') || msg.includes('tutup') || msg.includes('market')) {
      console.log(`[${ts}] 🤖 Auto-Trade: idle — ${result.message.slice(0, 100)}`)
    }
    // Don't spam "no qualifying signals" — too frequent
  }
}

function logEvaluateResult(result: EvaluateResult): void {
  if (result.evaluated === 0) return // Nothing to report

  const ts = new Date().toISOString()
  console.log(`[${ts}] ─── AI Signal Evaluation ───`)
  console.log(`  Evaluated: ${result.evaluated} | Correct: ${result.correct} | Wrong: ${result.wrong} | Skipped: ${result.skipped}`)
  console.log('')
}

function logBackupResult(result: BackupResult): void {
  const ts = new Date().toISOString()
  console.log(`[${ts}] ─── Database Backup ───`)
  if (result.ok && result.backup) {
    console.log(`  ✅ ${result.backup.filename} (${result.backup.sizeMB} MB)`)
  } else {
    console.log(`  ❌ ${result.message}`)
  }
  console.log('')
}

async function runMonitorLoop(): Promise<void> {
  console.log(`[${new Date().toISOString()}] 🤖 FinexFX Monitor started (with auto-trade)`)
  console.log(`[${new Date().toISOString()}]    SL/TP check: every ${POLL_INTERVAL_MS / 1000}s`)
  console.log(`[${new Date().toISOString()}]    Reconciliation: every ${RECONCILE_INTERVAL_MS / 1000}s`)
  console.log(`[${new Date().toISOString()}]    Auto-trade: every ${AUTO_TRADE_INTERVAL_MS / 1000}s`)
  console.log(`[${new Date().toISOString()}]    AI evaluation: every ${EVALUATE_INTERVAL_MS / 60_000} min`)
  console.log(`[${new Date().toISOString()}]    DB backup: every ${BACKUP_INTERVAL_MS / 60_000} min`)
  console.log(`[${new Date().toISOString()}]    Target: ${API_BASE}`)
  console.log('')

  let pollCount = 0
  let lastReconcile = 0
  let lastAutoTrade = 0
  let lastEvaluate = 0
  let lastBackup = 0
  let lastHeartbeat = Date.now()

  while (true) {
    const now = Date.now()

    // ── 1. SL/TP check (every 5s) ──────────────────────────────────────────────
    const result = await checkSlTp()
    if (result) {
      logSlTpResult(result)
    }

    // ── 2. Reconciliation (every 30s) ──────────────────────────────────────────
    if (now - lastReconcile >= RECONCILE_INTERVAL_MS) {
      const reconcileResult = await reconcilePositions()
      if (reconcileResult) {
        logReconcileResult(reconcileResult)
      }
      lastReconcile = now
    }

    // ── 3. Auto-trade execution (every 30s) ──────────────────────────────────
    // Server-side auto-trade: works even when browser is closed.
    // The /api/ai/auto-trade endpoint checks:
    //   - autoTradingEnabled in DB
    //   - Market open (weekend check)
    //   - Session gate (London/Overlap/Tokyo etc.)
    //   - Daily circuit breaker
    //   - Risk enforcement per trade
    if (now - lastAutoTrade >= AUTO_TRADE_INTERVAL_MS) {
      const tradeResult = await executeAutoTrade()
      if (tradeResult) {
        logAutoTradeResult(tradeResult)
      }
      lastAutoTrade = now
    }

    // ── 4. AI signal evaluation (every 5 min) ──────────────────────────────────
    if (now - lastEvaluate >= EVALUATE_INTERVAL_MS) {
      const evalResult = await evaluateSignals()
      if (evalResult) {
        logEvaluateResult(evalResult)
      }
      lastEvaluate = now
    }

    // ── 5. Database backup (every 1 hour) ──────────────────────────────────────
    if (now - lastBackup >= BACKUP_INTERVAL_MS) {
      const backupResult = await backupDatabase()
      if (backupResult) {
        logBackupResult(backupResult)
      }
      lastBackup = now
    }

    // ── Heartbeat (every 5 min) ────────────────────────────────────────────────
    pollCount++
    if (now - lastHeartbeat > 5 * 60 * 1000) {
      console.log(`[${new Date().toISOString()}] 💓 Heartbeat: ${pollCount} polls completed`)
      lastHeartbeat = now
    }

    // Wait for next poll
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))
  }
}

// Start the monitor
runMonitorLoop().catch((e) => {
  console.error(`[${new Date().toISOString()}] Fatal error in monitor loop:`, e)
  process.exit(1)
})