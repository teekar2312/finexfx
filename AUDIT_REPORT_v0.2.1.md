# FINEX Indonesia — In-Depth Integration Audit Report

**Version**: v0.2.1  
**Date**: July 2025  
**Scope**: Full-stack integration verification — config, database, API, state, UI, security, architecture  
**Auditor**: Automated Code Review Agent

---

## Executive Summary

After a thorough line-by-line audit of all core project files, the FINEX Indonesia Trading Dashboard v0.2.1 is **functionally integrated and operationally sound** for a demo/simulated environment. The lint check passes cleanly. However, the audit identified **27 findings** across 6 severity levels that need attention for production readiness.

| Severity | Count | Status |
|----------|-------|--------|
| 🔴 Critical | 3 | Must fix immediately |
| 🟠 High | 7 | Fix before any live usage |
| 🟡 Medium | 9 | Fix in next sprint |
| 🔵 Low | 5 | Technical debt — schedule | 
| ⚪ Info | 3 | Observations/optimizations |

---

## 🔴 CRITICAL FINDINGS (3)

### C1. `next.config.ts` — `ignoreBuildErrors: true` Silently Hides All Type Errors

**File**: `next.config.ts:8`
```typescript
typescript: {
  ignoreBuildErrors: true,
},
```

**Impact**: This masks **all** TypeScript compilation errors. Any type mismatch, missing import, or incorrect API usage will silently pass, potentially causing runtime crashes in production.

**Recommendation**: Set to `false`. Fix the resulting type errors iteratively. The project already has `"strict": true` in `tsconfig.json`, but `ignoreBuildErrors` completely bypasses the type checker at build time.

---

### C2. No Authentication / Authorization on Any API Route

**Files**: All files under `src/app/api/`  
**Impact**: Every API endpoint is completely unprotected. Anyone with network access can:
- Create/delete trades (`/api/trades`)
- Modify risk settings (`/api/risk`)
- Trigger database seeding (`/api/seed`)
- Create/delete price alerts (`/api/alerts`)
- Modify indicator configs (`/api/indicators`)
- Modify account settings (`/api/account`)

`next-auth` v4.24.11 is listed in `package.json` but has **zero configuration** — no `auth.ts`, no route handlers, no middleware.

**Recommendation**: Implement NextAuth.js with at minimum:
1. Credentials provider (email/password)  
2. API route middleware to validate sessions  
3. CSRF protection on mutating endpoints (POST/PUT/DELETE)

---

### C3. Seed Endpoint Has No Protection — Can Wipe/Overwrite Production Data

**File**: `src/app/api/seed/route.ts:380-538`  
**Impact**: The `/api/seed` POST endpoint creates account, risk settings, news, trades, and backtest data. While it checks `existingAccount` to prevent double-seeding, the `db:push` script uses `--accept-data-loss`, and there is no rate-limiting or auth guard. In a live deployment, this is a data integrity risk.

**Recommendation**: 
1. Guard with admin-only authentication
2. Remove `--accept-data-loss` from the default `db:push` script
3. Consider a separate CLI seed script instead of an HTTP endpoint

---

## 🟠 HIGH FINDINGS (7)

### H1. `reactStrictMode: false` Disables React Safety Checks

**File**: `next.config.ts:9`
```typescript
reactStrictMode: false,
```

**Impact**: StrictMode catches common mistakes (impure renders, missing cleanup in effects, deprecated APIs). Disabling it means:
- No double-render detection in development
- No warning about side effects in render
- No detection of deprecated string ref usage

**Note**: This was likely disabled because the price simulator's `useEffect` with `setInterval` causes double-firing in StrictMode (React 19 runs effects twice in dev). The correct fix is to handle this properly rather than disabling StrictMode globally.

**Recommendation**: Enable `reactStrictMode: true` and refactor `usePriceSimulator` to be idempotent (use a ref guard or move interval setup outside the effect dependency).

---

### H2. P&L Calculation Inconsistency Between Client and Server

**Files**:  
- Client: `src/hooks/use-price-simulator.ts:363-367`
- Server: `src/app/api/trades/route.ts:14-28`

**Client P&L formula**:
```typescript
const profit = pips * trade.lotSize * pipMultiplier * pipSize;
```

**Server P&L formula**:
```typescript
const profit = pips * trade.lotSize * pipMultiplier * pipSize - trade.commission + trade.swap;
```

**Impact**: The client-side P&L display does NOT subtract commission or add swap. When a trade is closed via the API (server-side), the final P&L includes commission and swap, creating a **visible discrepancy** between the displayed unrealized P&L and the realized P&L after close. For XAUUSD, the pipMultiplier is 100 (not 100000), which is correct, but the client never accounts for commission.

**Recommendation**: Align the client P&L calculation to include commission and swap.

---

### H3. Client State and Database Are Not Synchronized

**Impact**: The Zustand store maintains its own `openTrades`, `closedTrades`, `balance`, `equity`, etc., which are completely separate from the database. When trades are opened/closed:
1. The client calls `s.addTrade()` (Zustand) — client-side only
2. The client may also call `fetch('/api/trades', { method: 'POST' })` — server-side only
3. **There is no mechanism to sync these two sources of truth**

This means:
- Refreshing the page loses all client-side trades (unless they were also persisted via API)
- The account balance in the store and the database can diverge
- Auto-trading creates trades only in Zustand (not in the database)

**Recommendation**: Choose one source of truth. Either:
- Make the database the single source and use TanStack Query to fetch/sync
- Or persist all Zustand mutations to the API (event sourcing pattern)

---

### H4. `package.json` Name Is Still Generic

**File**: `package.json:2`
```json
"name": "nextjs_tailwind_shadcn_ts"
```

**Impact**: Package name does not reflect the project. This is cosmetic but affects:
- NPM/Bun audit reports showing a meaningless name
- Deployment tooling that may use the package name
- Professional appearance in dependency trees

**Recommendation**: Rename to `"finex-trading-dashboard"` or `"@finex/dashboard"`.

---

### H5. `tsconfig.json` Target Is ES2017 — Missing Modern JS Features

**File**: `tsconfig.json:3`
```json
"target": "ES2017"
```

**Impact**: The project uses Next.js 16 with React 19, which require at minimum ES2020 for features like `globalThis`, optional chaining (already used), and nullish coalescing. While `module: "esnext"` handles most output, the `target` affects some type-checking behavior.

**Recommendation**: Update to `"target": "ES2022"` or `"ESNext"`.

---

### H6. No `.env.example` File for Developer Onboarding

**Impact**: The only `.env` file contains the database URL. New developers have no reference for what environment variables the project expects. The broker API key, next-auth secret, and other config values are undocumented.

**Recommendation**: Create `.env.example` with:
```
DATABASE_URL=file:./db/custom.db
NEXTAUTH_SECRET=
NEXTAUTH_URL=http://localhost:3000
BROKER_API_KEY=
BROKER_API_SECRET=
BROKER_ACCOUNT_ID=
```

---

### H7. `allowedDevOrigins` Hardcodes a Single Session ID

**File**: `next.config.ts:11-12`
```typescript
allowedDevOrigins: [
  "preview-chat-7858aae1-24d0-4301-9fbe-baaaebfb9979.space-z.ai",
],
```

**Impact**: This is a sandbox-specific configuration that won't work in any other environment (local dev, staging, production). It's not harmful but is a deployment blocker if the config is not removed or generalized.

**Recommendation**: Use an environment variable or remove for non-sandbox deployments.

---

## 🟡 MEDIUM FINDINGS (9)

### M1. Zustand Store — Monolithic 490-Line Single File

**File**: `src/store/trading-store.ts` (490 lines)

**Impact**: Every component that imports `useTradingStore` triggers a dependency on the entire store. With 40+ properties and selectors, this creates:
- Large bundle sizes (tree-shaking can't help with a single file)
- Potential for unnecessary re-renders if selectors aren't granular
- Difficult testing of individual store slices

**Recommendation**: Split into multiple slices using Zustand's `combine` or separate stores:
- `usePriceStore`
- `useTradeStore` 
- `useAccountStore`
- `useNavigationStore`
- `useNotificationStore`

---

### M2. No Input Validation Using Zod on API Routes

**Impact**: The project has `zod` v4.0.2 installed but **zero usage** across any API route. Input validation is done manually with inline `if` checks (e.g., `SYMBOLS.includes(symbol)`). This is:
- Inconsistent (some routes validate, others don't)
- Not type-safe (no inference from schema)
- Missing validation for numeric ranges, string formats, etc.

**Example** — `/api/trades` POST does not validate:
- `lotSize` range (could send 999999)
- `stopLoss`/`takeProfit` logical consistency
- `strategy` against `StrategyName` enum

**Recommendation**: Create Zod schemas for each endpoint and use them for validation.

---

### M3. `backtest/route.ts` and `seed/route.ts` Use `Math.random()` — Non-Deterministic Results

**Impact**: Every backtest run produces different results because `Math.random()` is used without seeding. This makes:
- Backtesting unreliable for strategy comparison
- Seed data non-reproducible across environments
- Debugging difficult (can't reproduce a specific result)

**Recommendation**: Use a seeded PRNG (e.g., `mulberry32` or `seedrandom`) for deterministic results, or use real historical data.

---

### M4. Hardcoded News Data — Never Updated

**File**: `src/app/api/news/route.ts:4-185`

**Impact**: News is a static array of 18 hardcoded items with timestamps relative to `Date.now()`. This means:
- News is regenerated on every server restart (different relative timestamps)
- No real market data — useless for actual trading decisions
- The `NewsItem` Prisma model exists but the API never reads from it

**Recommendation**: Either use the `z-ai-web-dev-sdk` web-search skill to fetch real news, or at minimum read from the database and add a cron job to refresh.

---

### M5. `liveBroker` Socket Reconnect Logic Has a Bug

**File**: `src/lib/broker.ts:300-304`
```typescript
socket.on('disconnect', () => {
  this._status = 'disconnected';
  this.onConnectionChange?.(this._status);
  this.reconnectTimer = setTimeout(() => this.connect(), 5000);
});
```

**Issue**: When `disconnect()` is called manually, the `on('disconnect')` handler fires and schedules a reconnect, which then tries to connect again — creating an infinite reconnect loop. Line 324 tries to prevent this with `socket.on('disconnect', null)` but this is **not valid Socket.IO API** — it does not remove the listener.

**Recommendation**: Use `socket.off('disconnect')` to properly remove the listener before disconnecting, or use a `isManualDisconnect` flag.

---

### M6. `use-live-price-feed.ts` Imports `socket.io-client` at Module Level

**File**: `src/hooks/use-live-price-feed.ts:5`
```typescript
import { io, Socket } from 'socket.io-client';
```

**Impact**: Even though the hook only connects when `priceFeedMode === 'live'`, the `socket.io-client` library is always bundled into the client. The `broker.ts` correctly uses dynamic import (`await import('socket.io-client')`), but this hook doesn't.

**Recommendation**: Use dynamic import inside the `connect` callback, consistent with `broker.ts`.

---

### M7. Economic Events Not Exposed via API

**Impact**: The `EconomicEvent` Prisma model exists, seed data populates it, but there is **no API route** to fetch economic events. The `NewsView` component and `EconomicCalendar` component likely need this data.

**Recommendation**: Create `src/app/api/events/route.ts` with GET support.

---

### M8. Prisma Schema Uses `Float` for Monetary Values

**File**: `prisma/schema.prisma` (multiple models)

**Impact**: SQLite stores `Float` as 64-bit floating point. For financial calculations, this can introduce rounding errors (e.g., `0.1 + 0.2 !== 0.3`). While the impact is small for display purposes, it becomes problematic for:
- Balance comparisons
- Commission calculations at scale
- Regulatory audit trails

**Note**: Prisma with SQLite does not natively support `Decimal`. This is a known limitation. For production, consider PostgreSQL with `Decimal` type.

**Recommendation**: For now, ensure all monetary calculations round to 2 decimal places (already done in most places). Document the SQLite limitation in the architecture docs.

---

### M9. `PrismaClient` Query Logging in Development May Leak Sensitive Data

**File**: `src/lib/db.ts:10`
```typescript
log: process.env.NODE_ENV === 'development' ? ['query'] : [],
```

**Impact**: All SQL queries are logged to console in development. This includes all trade data, account balances, and potentially API keys stored in the database.

**Recommendation**: This is acceptable for development but ensure it's disabled in staging/production (already gated by `NODE_ENV`). Consider reducing to `['error']` or `['warn']`.

---

## 🔵 LOW FINDINGS (5)

### L1. `next-intl` Installed but Never Configured

**File**: `package.json:62` — `"next-intl": "^4.3.4"`  
**Impact**: Dead dependency. The entire UI is in English with no i18n infrastructure.  
**Recommendation**: Remove from `package.json` if i18n is not planned, or configure properly.

---

### L2. `@dnd-kit` Installed but Usage Unclear

**File**: `package.json:16-18` — Three `@dnd-kit` packages  
**Impact**: 80KB+ of dependencies. No clear drag-and-drop usage in the main trading views.  
**Recommendation**: Audit if used in any component; remove if unused.

---

### L3. `@mdxeditor/editor` and `react-markdown` — Potential Duplication

**Files**: `package.json:20,69`  
**Impact**: Both are markdown rendering libraries. The trade journal likely uses one of them. If both are used, consider consolidating.  
**Recommendation**: Verify which components use which; remove the unused one.

---

### L4. `react-day-picker` and `date-fns` — Check for Version Alignment

**Impact**: `react-day-picker` v9.x has specific `date-fns` version requirements. Both are installed.  
**Recommendation**: Verify compatibility; pin `date-fns` to the range expected by `react-day-picker`.

---

### L5. No Error Boundary Component

**Impact**: If any component throws during render, the entire application crashes with a white screen. There is no React Error Boundary wrapping the trading views.  
**Recommendation**: Add an `ErrorBoundary` component at the layout level to catch and display errors gracefully.

---

## ⚪ INFO OBSERVATIONS (3)

### I1. Theme Toggle Not Present in the UI

**Observation**: `next-themes` is properly configured in `layout.tsx` with `ThemeProvider` (attribute="class", defaultTheme="dark", enableSystem=true). The `globals.css` has both light and dark CSS variables defined. However, there is no visible theme toggle button in the sidebar or header for users to switch themes.

**Recommendation**: Add a `ThemeToggle` component (using `useTheme()` from next-themes) to the Sidebar or header.

---

### I2. ViewSkeleton Uses Hardcoded Dark-Theme-Only Colors

**File**: `src/app/page.tsx:28`
```tsx
<div className="h-5 w-32 bg-white/5 rounded animate-pulse" />
```

**Observation**: Skeleton placeholders use `bg-white/5` which is only visible on dark backgrounds. In light mode, these would be invisible.

**Recommendation**: Use theme-aware classes like `bg-primary/5` or `bg-foreground/5`.

---

### I3. `@tanstack/react-query` Installed but Not Used

**File**: `package.json:50`  
**Observation**: The project uses `@tanstack/react-query` v5.82.0 but all data fetching is done via raw `fetch()` calls in components and the broker abstraction. There are no QueryClient providers or `useQuery` hooks.  
**Recommendation**: Either adopt React Query for server state management (recommended for the API sync issue in H3) or remove the dependency.

---

## Architecture Strengths ✅

1. **Clean broker abstraction** (`src/lib/broker.ts`) — `IBroker` interface with Demo/Live implementations is well-designed
2. **Proper Prisma singleton pattern** (`src/lib/db.ts`) — prevents connection leaks in development
3. **Dynamic imports for all views** — excellent code splitting strategy
4. **Comprehensive type system** (`src/lib/types.ts`) — well-structured types for symbols, trades, signals, strategies
5. **Sound system** (`src/lib/sounds.ts`) — clean Web Audio API usage with enable/disable
6. **Risk validation in the store** — `setRiskSettings` enforces valid ranges with `Math.max/Math.min`
7. **SL/TP auto-close logic** — properly handles both BUY and SELL directions
8. **Mobile responsiveness** — Sheet-based sidebar for mobile, responsive grid layouts
9. **Skeleton loading states** — all views have loading skeletons
10. **Keyboard shortcuts** — dedicated hook and help overlay

---

## Priority Remediation Roadmap

### Phase 1 — Immediate (Before Any Live Usage)
1. **C1**: Set `ignoreBuildErrors: false` in next.config.ts
2. **C2**: Implement NextAuth.js authentication
3. **C3**: Protect `/api/seed` endpoint
4. **H1**: Enable `reactStrictMode: true`
5. **H2**: Align client/server P&L calculations

### Phase 2 — Next Sprint
6. **H3**: Design state sync strategy (DB as source of truth)
7. **M2**: Add Zod validation to all API routes
8. **M5**: Fix LiveBroker reconnect bug
9. **M6**: Dynamic import socket.io-client in use-live-price-feed.ts
10. **I1**: Add theme toggle to the UI

### Phase 3 — Technical Debt
11. **M1**: Split monolithic Zustand store into slices
12. **M3**: Replace Math.random() with seeded PRNG for backtesting
13. **M4**: Integrate real news feed (web-search skill)
14. **L1-L4**: Remove unused dependencies
15. **L5**: Add React Error Boundary
16. **H4-H7**: Minor config improvements

---

*Report generated as part of FINEX Indonesia v0.2.1 deep integration audit.*