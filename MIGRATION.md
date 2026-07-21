# Migration History

This document records the major changes made to the FinexFX AI Trading System.

---

## Migration 4: v2.1.0 — Confidence Threshold Fix & LLM Usage Monitoring (July 2026)

### What Changed

**Bug Fix — Confidence Threshold "Stuck" at 70%**:
- `src/app/api/ai/auto-trade/route.ts` — Fixed hardcoded `"confidence ≥ 70"` message
  that always displayed 70% regardless of the user's actual threshold setting.
  The message now dynamically uses `${confidenceThreshold}%` from the database.
  Also added `confidenceThreshold` to the API response for UI visibility.
- `src/components/panels/risk-panel.tsx` — Confidence threshold slider now uses
  the `SliderRow` component (shows min/max labels: **30–95%**) instead of a raw
  `<Slider>` with no visible range. Previously the slider allowed 50–95 but had
  no labels, making users think 70 was the minimum. Range also extended to 30%.
- `src/app/api/risk/route.ts` — Added server-side validation & clamping for all
  numeric risk settings (confidence 30–95%, lot sizes, pips, margin, etc.).
  Prevents garbage values from being saved to the database.

**New Feature — LLM Provider Usage Monitoring**:
- `src/lib/llm-usage.ts` (NEW) — Shared in-memory usage tracker that records
  every `callLLM()` invocation: total calls, success/fail counts, latency,
  last call time, and last error message.
- `src/lib/llm-provider.ts` — Integrated `recordLLMCall()` into `callLLM()`
  to track every LLM invocation (success + failure + latency).
- `src/app/api/health/llm-info/route.ts` — Enhanced endpoint now returns
  `{ provider, model, available, usage: { totalCalls, successCalls, failedCalls,
  successRate, lastCallTime, lastCallLatencyMs, lastCallError } }`.
- `src/lib/api.ts` — Added `api.llmInfo()` typed method for the frontend.
- `src/components/panels/ai-panel.tsx` — New `LlmProviderStatus` card in the AI
  panel showing: provider name, model, online/offline badge, total calls with
  success rate, last call latency, success/fail breakdown, last call time,
  and last error (shown only when present). Auto-refreshes every 15 seconds.

### Root Cause Analysis: Confidence Threshold

Deep audit traced the full data flow:
1. **Slider UI** (`min={50}`) — ✅ Already allowed values below 70
2. **PATCH API** — ✅ No server-side blocking
3. **Auto-trade comparison** — ✅ Used actual DB value
4. **Auto-trade message (line 248)** — 🔴 **BUG**: Hardcoded `"confidence ≥ 70"`
   made users perceive the system was enforcing a 70% minimum

The system never actually blocked values below 70%. The issue was a
**perception bug** caused by a misleading hardcoded error message.

### Verification

- Slider now shows visible 30–95% range with labels
- Auto-trade message correctly reflects the user's configured threshold
- Server-side validation prevents out-of-range values in the database
- LLM status card shows real-time provider info and call statistics
- All changes committed: `e073381` (threshold fix) + `c48ba88` (LLM status)

### Patch: v2.1.1 — Decommissioned Model Handling (July 2026)

- `.env.example` — Updated `GROQ_MODEL` default from `llama-3.1-70b-versatile`
  (decommissioned by Groq) to `llama-3.3-70b-versatile`.
- `src/lib/llm-provider.ts` — Added actionable error hints when API returns
  "decommissioned" or "does not exist" errors. The hint suggests the correct
  default model name and which env var to set, e.g.:
  `→ Model "llama-3.1-70b-versatile" is no longer available. Try setting GROQ_MODEL=llama-3.3-70b-versatile in your .env file.`
- `DEPLOYMENT.md` — Added troubleshooting entry for decommissioned model errors.

---

## Migration 3: v2.0.0 — LLM Provider Abstraction & Safety Features (July 2026)

### What Changed

**Removed**:
- `z-ai-web-dev-sdk` from `package.json` dependencies (replaced by configurable LLM)
- `.z-ai-config.example` (no longer needed)
- `Caddyfile` (sandbox-only, not needed for Windows deployment)
- `.zscripts/` (sandbox-only build/start scripts)
- `examples/` (development reference files)
- 116 stale `.db-shm` / `.db-wal` files from `db/backups/`

**New Files**:
- `src/lib/llm-provider.ts` — Multi-provider LLM abstraction layer
  - Supports: Ollama (local), OpenAI, Groq, Z.AI sandbox (legacy)
  - Unified `callLLM()` API used by all AI features
  - Graceful fallback to rule-based heuristic when no provider is configured
- `src/lib/auto-close.ts` — Emergency close of all open positions
  - Handles both MT5-executed and locally-tracked trades
  - Triggered by heartbeat monitor on MT5 disconnect
- `src/lib/paper-trading.ts` — Simulated trading engine
  - Uses real price data, no MT5 execution
  - Paper trades stored with `source='paper'` in database
  - Enable via `PAPER_TRADING=true`
- `src/lib/daily-summary.ts` — Daily P&L report generator
  - Computes aggregate daily stats (win rate, P&L, best/worst trade)
  - Sends via Telegram/Discord/Slack webhook
  - Manual trigger: `POST /api/system/daily-summary`
- `mini-services/heartbeat-monitor/` — MT5 bridge health monitor (port 3060)
  - Pings MT5 bridge every 10 seconds
  - Triggers auto-close after 30 seconds offline
  - Sends webhook notifications on disconnect/reconnect
- `src/app/api/health/llm-info/route.ts` — Exposes LLM provider info to UI
- `src/app/api/health/mt5-disconnect/route.ts` — Emergency close endpoint
- `src/app/api/system/daily-summary/route.ts` — Manual/scheduled daily summary

**Modified Files**:
- `src/lib/ai.ts` — Uses `callLLM()` from llm-provider instead of z-ai-web-dev-sdk
- `src/app/api/news/refresh/route.ts` — Uses `callLLM()` for news synthesis
- `src/app/api/economic-calendar/refresh/route.ts` — Uses `callLLM()` for calendar synthesis
- `src/lib/mt5-client.ts` — Enforces `BRIDGE_API_KEY` in production, all requests include Authorization header
- `src/lib/db.ts` — Added `PRAGMA journal_mode=WAL` for SQLite
- `.env.example` — Comprehensive LLM provider docs, paper trading, heartbeat, daily summary config
- `package.json` — Version bumped to 2.0.0, removed z-ai-web-dev-sdk
- `.gitignore` — Added rules for sandbox-only files, db backup WAL/SHM files

### Why This Change?

The `z-ai-web-dev-sdk` only works inside the Z.AI sandbox platform (requires
auto-provisioned credentials from `/etc/.z-ai-config`). Since the app is designed
to run on Windows trader machines, the SDK was fundamentally incompatible with
the production deployment target.

The new `llm-provider.ts` abstraction allows users to choose any OpenAI-compatible
LLM provider (Ollama, OpenAI, Groq) via simple environment variables, while
maintaining full backward compatibility with the Z.AI sandbox as a legacy option.

### Verification

- All AI analysis functions use the new `callLLM()` API
- Fallback to heuristic analysis when LLM is unavailable
- `BRIDGE_API_KEY` enforcement tested in production mode
- SQLite WAL mode verified for concurrent read/write performance
- Paper trading mode tested with real price data

---

## Migration 2: Remove Demo Mode — Real Trading Only (July 2026)

### What Changed

**Removed**:
- `mini-services/mt5-bridge/adapters/mock.ts` — mock adapter deleted
- `MT5_ADAPTER` env var — no longer used (always `real-python`)
- Price simulation formula in `src/lib/market.ts` — replaced with live bridge fetch
- Price simulation in `mini-services/price-feed/index.ts` — replaced with bridge polling
- Demo account seed ("Demo Scalper" with `accountType='demo'`)
- Fake news items, fake AI signals, fake log entries from seed
- `accountType` field from schema, types, DB, API, and UI
- Demo mode toggle from UI (always LIVE now)

**Added/Changed**:
- `src/lib/market.ts` — completely rewritten. All price functions now async and fetch from MT5 bridge.
- `src/lib/market-math.ts` (NEW) — `calcPnl` and `calcLotSize` (sync, pure math, client-safe)
- Dashboard routes — graceful degradation (zeroed quotes when bridge offline)

### Bugs Found & Fixed
1. `dashboard-panel.tsx` imported `calcPnl` from `market.ts` which has `import 'server-only'` → would break `next build`. Fixed by splitting into `market-math.ts`.
2. `db.ts` used `__dirname` (not available in ESM) → replaced with `process.cwd()`.

---

## Migration 1: Prisma → Drizzle ORM (July 2026)

### What Changed
- Replaced `@prisma/client` + `prisma` with `drizzle-orm` + `drizzle-kit` + `better-sqlite3`
- Created `src/lib/db/schema.ts` (Drizzle schema, 16 tables)
- Rewrote `src/lib/db.ts` as a Prisma-compatible facade over Drizzle
- 45+ API route files continue working without modification

### Why a Facade?
The codebase has 45+ API route files originally written with Prisma's query API.
Rather than rewrite every call site, a thin facade maps Prisma-style calls
to native Drizzle queries. Native Drizzle available via `db.$drizzle`.

### Bugs Found & Fixed
1. `$queryRaw` tagged template not supported → fixed (dual-mode)
2. `{ not: null }` emitted broken SQL → fixed (`isNotNull()`)
3. `$transaction(async tx)` threw error (better-sqlite3 sync-only) → manual BEGIN/COMMIT
4. Multi-field `orderBy` only used last field → fixed (spread)
5. `count()` executed 2 SQL queries (dead code) → fixed

---

## Lessons Learned

1. **`server-only` guard**: No client component can import from a module with `import 'server-only'`. Split pure math into a separate file.
2. **ESM vs CJS**: `__dirname` is not available in ESM. Use `process.cwd()`.
3. **better-sqlite3 sync transactions**: For async interactive transactions, drive BEGIN/COMMIT manually.
4. **Drizzle `orderBy`**: `.orderBy()` replaces (not appends). Use `.orderBy(...ords)` for multi-field sort.
5. **`{ not: null }` in SQL**: `col != NULL` always evaluates to NULL. Use `isNotNull(col)`.
6. **SDK sandbox lock-in**: Never couple core business logic to platform-specific SDKs. Use abstraction layers.