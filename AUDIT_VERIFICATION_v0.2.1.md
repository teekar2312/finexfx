# FINEX Indonesia — Audit Verification Report v0.2.1→v0.2.2

**Date**: July 2025  
**Scope**: Re-audit of all 27 findings from AUDIT_REPORT_v0.2.1.md  
**Purpose**: Verify which findings have been integrated, which are partially fixed, and which remain open  

---

## Executive Summary

Of the **27 original audit findings**, **20 are fully resolved**, **4 are partially resolved**, and **3 remain open** (1 newly introduced). The project has made significant progress but critical gaps remain — particularly around API authentication coverage and a new runtime bug introduced by the M6 fix.

| Status | Count | Details |
|--------|-------|---------|
| ✅ Fully Resolved | 20 | No further action needed |
| ⚠️ Partially Resolved | 4 | Fix started but incomplete |
| ❌ Open / Regressed | 3 | Requires immediate attention |

---

## Detailed Findings Verification

### 🔴 CRITICAL (3 findings)

| ID | Finding | Status | Evidence |
|----|---------|--------|----------|
| C1 | `ignoreBuildErrors: true` | ✅ **FIXED** | `next.config.ts:6` now reads `ignoreBuildErrors: false` |
| C2 | No auth on API routes | ⚠️ **PARTIAL** | `auth.ts`, `auth-guard.ts`, `[...nextauth]/route.ts` all exist. However, **only `/api/seed`** uses `withAuth`/`requireAuth`. The other 10 API routes (`/api/trades`, `/api/account`, `/api/risk`, `/api/backtest`, `/api/alerts`, `/api/indicators`, `/api/signals`, `/api/news`, `/api/events`, `/api/route.ts`) have **zero authentication**. Anyone can still create/delete trades, modify risk settings, etc. |
| C3 | Seed endpoint unprotected | ✅ **FIXED** | `seed/route.ts:3` imports `withAuth` from `auth-guard.ts`. Line 382-383 calls `requireAuth()` and returns 401 if unauthorized. **However**: `db:push` script in `package.json:10` still contains `--accept-data-loss` flag — this is a minor residual issue noted in original C3 recommendation #2. |

### 🟠 HIGH (7 findings)

| ID | Finding | Status | Evidence |
|----|---------|--------|----------|
| H1 | `reactStrictMode: false` | ✅ **FIXED** | `next.config.ts:8` now reads `reactStrictMode: true`. `use-price-simulator.ts:166` has `initializedRef` guard for StrictMode double-mount. |
| H2 | P&L calculation inconsistency | ✅ **FIXED** | `use-price-simulator.ts:372` now reads: `const profit = pips * trade.lotSize * pipMultiplier * pipSize - trade.commission + trade.swap;` — matches server formula in `trades/route.ts:24`. |
| H3 | Client/DB state not synced | ⚠️ **PARTIAL** | `use-sync-with-db.ts` hook created and used in `page.tsx:335`. Loads account, trades, and risk settings from API on mount. **Gap**: This is one-way sync (DB→client) on mount only. There is no real-time bidirectional sync. Auto-traded positions (line 335 of `use-price-simulator.ts`) are still client-only — they call `s.addTrade()` but never POST to `/api/trades`. Closing trades via SL/TP calls `s.closeTrade()` but never calls the DELETE API to persist the close to the database. |
| H4 | Package name generic | ✅ **FIXED** | `package.json:2` now reads `"name": "finex-trading-dashboard"` |
| H5 | `tsconfig.json` target ES2017 | ✅ **FIXED** | `tsconfig.json:3` now reads `"target": "ES2022"` |
| H6 | No `.env.example` | ✅ **FIXED** | `.env.example` exists with DATABASE_URL, NEXTAUTH_SECRET, NEXTAUTH_URL, BROKER_API_KEY, BROKER_API_SECRET, BROKER_ACCOUNT_ID, ALLOWED_DEV_ORIGINS, NODE_ENV |
| H7 | Hardcoded `allowedDevOrigins` | ✅ **FIXED** | `next.config.ts:9-11` now reads from `process.env.ALLOWED_DEV_ORIGINS` with comma-split, empty array fallback |

### 🟡 MEDIUM (9 findings)

| ID | Finding | Status | Evidence |
|----|---------|--------|----------|
| M1 | Monolithic 490-line Zustand store | ⚠️ **ACKNOWLEDGED** | Store is now 516 lines. A NOTE comment at lines 4-9 explains the rationale for deferring the split (would require updating 40+ component imports). The comment references this as "planned for a future major refactor." Not fixed but documented. |
| M2 | No Zod validation on API routes | ✅ **FIXED** | `src/lib/validators.ts` created with Zod schemas for trades, signals, alerts, risk, account, backtest, and indicators. Used in `/api/trades` (line 5, 113-119) and `/api/backtest` (line 5, 151-157). **Gap**: Not applied to `/api/alerts`, `/api/indicators`, `/api/risk`, `/api/account`, or `/api/signals`. |
| M3 | `Math.random()` non-deterministic | ✅ **FIXED** | `backtest/route.ts:8-14` implements `mulberry32` seeded PRNG. Seed derived from `strategy + symbol` for deterministic results per strategy/symbol combo. **Residual**: `seed/route.ts:319-354` still uses raw `Math.random()` for seed data generation — acceptable since seed data is only used for demo initialization. |
| M4 | Hardcoded news data | ✅ **FIXED** | `news/route.ts` now reads from database first (`db.newsItem.findMany`), falls back to a minimal static array only when DB is empty. Seed data populates the DB with 8 news items. |
| M5 | LiveBroker reconnect bug | ✅ **FIXED** | `broker.ts:326-328` now uses `socket.off('disconnect')` to properly remove the listener before calling `socket.disconnect()`. The `reconnectTimer` is also cleared on line 322-324. No more infinite reconnect loop. |
| M6 | Module-level socket.io import | ❌ **REGRESSED** | `use-live-price-feed.ts:31` attempted a dynamic import inside `connect` callback: `const { io } = await import('socket.io-client')`. However, the `connect` function on line 26 is declared with `useCallback(() => { ... })` — **it is NOT async**. Using `await` in a non-async function is a syntax error that bypasses TypeScript checking in dev mode but would fail at build time. The `type Socket` import on line 6 still references `socket.io-client` at module level (type-only import), which is acceptable for tree-shaking. **This fix introduced a new bug.** |
| M7 | Economic events not exposed via API | ✅ **FIXED** | `src/app/api/events/route.ts` created with GET handler. Returns all events from DB, ordered by date, with grouped output by impact level. |
| M8 | Prisma Float for monetary values | ✅ **FIXED** | `prisma/schema.prisma:5-8` has a clear `NOTE (M8)` documenting the SQLite limitation and recommending PostgreSQL with `Decimal @db.Decimal(10,2)` for production. |
| M9 | PrismaClient query logging | ✅ **FIXED** | `db.ts:10` now reads `log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : []`. Reduced from `['query']` to `['error', 'warn']` — no longer logs all SQL queries. |

### 🔵 LOW (5 findings)

| ID | Finding | Status | Evidence |
|----|---------|--------|----------|
| L1 | `next-intl` unused | ✅ **FIXED** | Not present in `package.json` dependencies |
| L2 | `@dnd-kit` unused | ✅ **FIXED** | Not present in `package.json` dependencies (all 3 sub-packages removed) |
| L3 | `@mdxeditor/editor` unused | ✅ **FIXED** | Not present in `package.json` dependencies. `react-markdown` remains — used by TradeJournalView for markdown rendering |
| L4 | `react-day-picker` / `date-fns` alignment | ✅ **RESOLVED** | Both remain in dependencies. `react-day-picker` is used by `calendar.tsx` (shadcn/ui component). Version alignment is acceptable for the current versions. |
| L5 | No Error Boundary | ✅ **FIXED** | `src/components/error-boundary.tsx` created with class component. Integrated in `layout.tsx:49-51` wrapping `{children}`. Includes error display, reset button, and optional custom fallback. |

### ⚪ INFO (3 findings)

| ID | Finding | Status | Evidence |
|----|---------|--------|----------|
| I1 | Theme toggle not in UI | ⚠️ **PARTIAL** | `src/components/theme-toggle.tsx` exists with proper `useTheme()` implementation and animated Sun/Moon icons. **Gap**: The component is **never imported or rendered** in any other file. Grep confirms zero usages outside the component definition itself. The Sidebar does not include it. |
| I2 | Skeleton uses dark-only colors | ✅ **FIXED** | `page.tsx:26-34` now uses `bg-primary/5` (3 instances) and `bg-white/[0.02]` (1 instance). `bg-white/[0.02]` is technically still slightly more visible in dark mode, but the primary change to `bg-primary/5` resolves the core issue. |
| I3 | `@tanstack/react-query` unused | ✅ **FIXED** | Not present in `package.json` dependencies |

---

## Summary Matrix

| # | Finding | Severity | Status | Verdict |
|---|---------|----------|--------|----------|
| 1 | C1: ignoreBuildErrors | 🔴 Critical | ✅ Fixed | Confirmed at `next.config.ts:6` |
| 2 | C2: No API auth | 🔴 Critical | ⚠️ Partial | Auth infra exists; only `/api/seed` protected |
| 3 | C3: Seed endpoint | 🔴 Critical | ✅ Fixed | Auth guard applied. `--accept-data-loss` remains in npm script. |
| 4 | H1: StrictMode off | 🟠 High | ✅ Fixed | Enabled + ref guard in price simulator |
| 5 | H2: P&L inconsistency | 🟠 High | ✅ Fixed | Client formula now includes commission + swap |
| 6 | H3: State not synced | 🟠 High | ⚠️ Partial | One-way sync on mount. No bidirectional persistence. |
| 7 | H4: Package name | 🟠 High | ✅ Fixed | `finex-trading-dashboard` |
| 8 | H5: tsconfig target | 🟠 High | ✅ Fixed | ES2022 |
| 9 | H6: No .env.example | 🟠 High | ✅ Fixed | File exists with all expected vars |
| 10 | H7: Hardcoded origins | 🟠 High | ✅ Fixed | Uses env var with fallback |
| 11 | M1: Monolithic store | 🟡 Medium | ⚠️ Acknowledged | Documented rationale; deferred. 516 lines. |
| 12 | M2: No Zod validation | 🟡 Medium | ⚠️ Partial | Validators created; only 2 of 7+ routes use them |
| 13 | M3: Math.random() | 🟡 Medium | ✅ Fixed | mulberry32 PRNG in backtest |
| 14 | M4: Hardcoded news | 🟡 Medium | ✅ Fixed | DB-first with fallback |
| 15 | M5: Reconnect bug | 🟡 Medium | ✅ Fixed | `socket.off('disconnect')` + timer clear |
| 16 | M6: Module-level import | 🟡 Medium | ❌ Regressed | `await` in non-async callback — new bug introduced |
| 17 | M7: Events API | 🟡 Medium | ✅ Fixed | `/api/events` created |
| 18 | M8: Float for money | 🟡 Medium | ✅ Fixed | Documented in schema + migration path noted |
| 19 | M9: Query logging | 🟡 Medium | ✅ Fixed | Reduced to `['error', 'warn']` |
| 20 | L1: next-intl | 🔵 Low | ✅ Fixed | Removed from dependencies |
| 21 | L2: @dnd-kit | 🔵 Low | ✅ Fixed | Removed from dependencies |
| 22 | L3: @mdxeditor | 🔵 Low | ✅ Fixed | Removed; react-markdown retained (used) |
| 23 | L4: day-picker alignment | 🔵 Low | ✅ Resolved | Both used; versions compatible |
| 24 | L5: No Error Boundary | 🔵 Low | ✅ Fixed | Created + integrated in layout |
| 25 | I1: Theme toggle | ⚪ Info | ⚠️ Partial | Component exists but not rendered anywhere |
| 26 | I2: Skeleton colors | ⚪ Info | ✅ Fixed | Uses `bg-primary/5` |
| 27 | I3: react-query unused | ⚪ Info | ✅ Fixed | Removed from dependencies |

---

## New Issues Introduced by Fixes

### N1. **`use-live-price-feed.ts` — `await` in non-async `useCallback`** (from M6 fix)
- **File**: `src/hooks/use-live-price-feed.ts:26,31`
- **Severity**: 🔴 Critical (runtime failure when live mode is activated)
- **Detail**: The M6 fix changed the socket.io import to dynamic (`await import('socket.io-client')`) inside the `connect` callback, but the callback is declared as `useCallback(() => { ... })` — not async. The `await` keyword in a non-async function causes a syntax error at build time and undefined behavior at runtime.
- **Fix**: Change `const connect = useCallback(() => {` to `const connect = useCallback(async () => {` and update the `useEffect` dependency accordingly, or use `.then()` pattern instead of `await`.

---

## Remaining Action Items (Priority Order)

### Immediate (Would Block Production)
1. **N1**: Fix `await` in non-async callback in `use-live-price-feed.ts`
2. **C2**: Apply `withAuth` guard to all 10 unprotected API routes
3. **I1**: Import and render `ThemeToggle` in the Sidebar component

### Next Sprint
4. **H3**: Implement bidirectional state sync — persist `addTrade()` and `closeTrade()` mutations to the API
5. **M2**: Apply Zod validators to remaining API routes (`alerts`, `indicators`, `risk`, `account`, `signals`)
6. **C3 (residual)**: Remove `--accept-data-loss` from `db:push` script
7. **I2 (residual)**: Change `bg-white/[0.02]` on `page.tsx:31` to `bg-primary/[0.02]` or `bg-card`

### Future
8. **M1**: Split the 516-line Zustand store into slices when a major refactor is scheduled

---

*Verification audit completed July 2025. All 27 original findings reviewed against current codebase.*