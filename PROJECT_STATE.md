# FINEX Indonesia — Forex Trading Dashboard

> **Version**: 0.2.1 · **Stack**: Next.js 16 + TypeScript 5 + Tailwind CSS 4 + shadcn/ui (New York) + Framer Motion + Recharts + Zustand 5

---

## 1. Build & Quality

| Metric | Value |
|--------|-------|
| Lint | **Zero errors** (`bun run lint`) |
| Compilation | **HTTP 200** in ~12s (`bun run dev`) |
| Total Source Lines (TS/TSX) | **34,123 lines** |
| CSS | **2,219 lines** (globals.css — glass-morphism theme) |
| Trading Components | **40 files** in `src/components/trading/` |
| UI Components | **48 files** in `src/components/ui/` (full shadcn/ui set) |
| Custom Hooks | **4 files** (824 lines) in `src/hooks/` |
| API Routes | **9 endpoints** (1,858 lines) in `src/app/api/` |
| Store | **1 file** (458 lines) — `trading-store.ts` |
| Lib | **4 files** (types.ts, sounds.ts, utils.ts, db.ts) |
| `use client` directives | **40/40** trading components (100%) |
| `console.log` statements | **0** in `src/` |
| `TODO`/`FIXME`/`HACK` comments | **0** in `src/` |
| Duplicate imports | **0** across all files |

---

## 2. Architecture

### Pattern
- **SPA** with 11 tab views, floating trade panel, premium footer
- **Route**: Single `/` route (`src/app/page.tsx`) — all navigation client-side via Zustand `activeTab`
- **Code Splitting**: Dynamic imports with `ViewSkeleton` loading states for all 10 tab views
- **State Management**: Zustand 5 single store (`trading-store.ts`) with selector pattern
- **Styling**: Dark glass-morphism theme, 120+ CSS animation/utility classes, mesh gradient backgrounds
- **Database**: Prisma ORM (SQLite) with 11 models — schema at `prisma/schema.prisma`, DB at `db/custom.db`

### Price Engine
- Client-side simulator via `use-price-simulator.ts` (500ms tick interval)
- **4 forex pairs**: EURUSD, USDJPY, GBPUSD, XAUUSD
- Generates realistic OHLCV candles with spread simulation
- Feeds into Zustand store for all components

### Key Formulas
- **P&L**: `pips × lotSize × pipMultiplier × pipSize`
- **Risk Guards**: Negative equity auto-close, daily trade/risk limits, 8-field clamping in QuickTradePanel

### Navigation Tabs (11)
1. **Dashboard** — Watchlist, Activity Feed, Session Overlap Scanner, Market Heatmap, Trading Psychology, Enhanced Alerts
2. **Trading** — Price Chart, Order Book Depth, Market Sentiment, Trade Export, Advanced Orders, Trade History, Execution Modal
3. **Analysis** — Multi-Timeframe Panel, Signal Detail Modal, Correlation Matrix, Candlestick Patterns, Social Trading Leaderboard
4. **Indicators** — 30 technical indicators configuration
5. **News** — Economic Calendar
6. **Risk** — Position Size Calculator
7. **Backtesting** — Trade Replay
8. **Journal** — Trade journal with mood/rating/mistakes/lessons
9. **Analytics** — Performance Scorecard, Drawdown Chart
10. **Settings** — Trading Rules Engine, Sound Notifications
11. **Error Logs** — System error diagnostics and resolution

---

## 3. Component Integration Map (40 components → 11 views + page.tsx)

| Parent | Child Components |
|--------|-----------------|
| `page.tsx` | Sidebar, Footer, QuickTradePanel, KeyboardShortcutsHelp, OnboardingTour, 10 dynamic views, ErrorLogsView (inline), NotificationToast (inline) |
| `DashboardView` | WatchlistPanel, ActivityFeed, SessionOverlapScanner, MarketHeatmap, TradingPsychologyPanel, EnhancedAlertPanel |
| `TradingView` | PriceChart, OrderBookDepth, MarketSentiment, TradeExportButton, AdvancedOrderTypes, TradeHistoryTable, TradeExecutionModal |
| `AnalysisView` | MultiTimeframePanel, SignalDetailModal, CorrelationMatrix, CandlestickPatternRecognition, SocialTradingLeaderboard |
| `IndicatorsView` | (standalone — uses store directly) |
| `NewsView` | EconomicCalendar |
| `RiskView` | PositionSizeCalculator |
| `BacktestingView` | TradeReplay |
| `TradeJournalView` | (standalone — uses store directly) |
| `PerformanceAnalyticsView` | PerformanceScorecard, DrawdownChart |
| `SettingsView` | TradingRulesEngine, SoundNotificationPanel |

---

## 4. Component File Sizes (Top 15)

| File | Lines | Role |
|------|-------|------|
| `TradingRulesEngine.tsx` | 1,190 | If-then automation rules |
| `TradeJournalView.tsx` | 1,133 | Trade journal with rich entries |
| `PositionSizeCalculator.tsx` | 1,080 | Risk-based lot sizing |
| `AdvancedOrderTypes.tsx` | 997 | OCO, trailing stop, break-even |
| `DashboardView.tsx` | 979 | Main dashboard layout |
| `PerformanceScorecard.tsx` | 973 | KPI cards and metrics |
| `SocialTradingLeaderboard.tsx` | 892 | Mock social trading data |
| `TradingView.tsx` | 890 | Main trading layout |
| `TradingPsychologyPanel.tsx` | 858 | Mood tracking and insights |
| `PerformanceAnalyticsView.tsx` | 840 | Analytics dashboard |
| `CandlestickPatternRecognition.tsx` | 785 | Pattern detection display |
| `SettingsView.tsx` | 782 | Settings container |
| `AnalysisView.tsx` | 769 | Analysis container |
| `SignalDetailModal.tsx` | 747 | AI signal detail view |
| `TradeReplay.tsx` | 745 | Bar-by-bar trade replay |

---

## 5. API Routes (9 endpoints)

| Endpoint | Lines | Purpose |
|----------|-------|---------|
| `POST /api/seed` | 538 | Seed demo data (trades, signals, news, events, backtest results) |
| `POST/GET /api/trades` | 269 | Open/close/list trades with P&L calculation |
| `GET /api/news` | 200 | Fetch and cache forex news (web search fallback) |
| `POST /api/backtest` | 189 | Run strategy backtests on price history |
| `POST/GET /api/alerts` | 179 | Create/manage price alerts |
| `POST/GET /api/risk` | 142 | Get/update risk settings |
| `GET /api/account` | 126 | Trading account info and equity calculation |
| `POST/GET /api/indicators` | 109 | Indicator configuration CRUD |
| `GET /api/signals` | 106 | AI-generated trading signals |

---

## 6. Database Schema (Prisma — 11 models)

| Model | Purpose |
|-------|---------|
| `User` | User accounts (email, name) |
| `TradingAccount` | Account balance, equity, margin, leverage (500x default) |
| `Trade` | Open/closed trades with SL/TP/trailing stop, AI confidence, market condition |
| `TradingSignal` | AI-generated signals with strategy, confidence, R:R ratio |
| `PriceAlert` | Conditional price alerts (above/below/crosses) |
| `NewsItem` | Forex news with impact level and currency tagging |
| `EconomicEvent` | Calendar events with actual/forecast/previous values |
| `BacktestResult` | Backtest results with Sharpe ratio, max drawdown, trade list (JSON) |
| `RiskSettings` | Per-trade risk %, SL/TP pips, daily limits, max positions |
| `ErrorLog` | Error/warning/info logging with resolve tracking |
| `NotificationLog` | Notification delivery tracking (email/push/in-app) |
| `IndicatorConfig` | Indicator settings (trend/momentum/volatility/volume) |

---

## 7. Custom Hooks

| Hook | Lines | Purpose |
|------|-------|---------|
| `use-price-simulator.ts` | 402 | Real-time price generation (500ms ticks), OHLCV candle creation, spread simulation |
| `use-keyboard-shortcuts.ts` | 210 | Global hotkeys (B=Buy, S=Sell, 1-0=tabs, ?=help, Esc=close) |
| `use-toast.ts` | 193 | Custom toast notification system |
| `use-mobile.ts` | 19 | Responsive breakpoint detection |

---

## 8. Dependencies (Key)

| Package | Version | Purpose |
|---------|---------|---------|
| `next` | 16.1.1 | Framework (App Router) |
| `react` | 19.0.0 | UI library |
| `typescript` | 5.x | Type safety |
| `tailwindcss` | 4.x | Styling |
| `framer-motion` | 12.23.2 | Animations |
| `recharts` | 2.15.4 | Charts/graphs |
| `zustand` | 5.0.6 | State management |
| `prisma` | 6.11.1 | ORM (SQLite) |
| `lucide-react` | 0.525.0 | Icons |
| `@tanstack/react-table` | 8.21.3 | Data tables |
| `@tanstack/react-query` | 5.82.0 | Server state |
| `@dnd-kit/core` | 6.3.1 | Drag and drop |
| `date-fns` | 4.1.0 | Date utilities |
| `socket.io-client` | 4.8.3 | WebSocket support |
| `z-ai-web-dev-sdk` | 0.0.18 | AI capabilities SDK |
| `next-themes` | 0.4.6 | Theme support |
| `sonner` | 2.0.6 | Toast notifications |

---

## 9. Known Limitations

### Data Limitations
1. **PerformanceAnalyticsView**: Mock historical charts (equity curve, daily P&L, heatmap, session data) — real data requires persistent DB history accumulation
2. **SocialTradingLeaderboard**: Mock trader profiles/performances — social feature requires real backend with user data
3. **BacktestingView**: Mock backtest results — needs real `priceHistory` wiring from price simulator
4. **IndicatorsView**: Indicator values simulated client-side (not from real market data API)

### Technical Debt
5. **32/40 components use full `useTradingStore()`** without selectors — causes unnecessary re-renders on any state change (8 use selectors: page.tsx, OrderBookDepth, MarketSentiment, NewsView, CorrelationMatrix, TradeExportButton, SessionOverlapScanner, SoundNotificationPanel)
6. **21 `transition: all` CSS rules** in globals.css — should use specific properties for better performance
7. **No React Error Boundaries** per tab — unhandled errors crash entire app
8. **No `aria-live` regions** for price/P&L updates — screen readers miss real-time changes
9. **No loading skeletons** for Dashboard/Trading/Analysis view internals (only page-level `ViewSkeleton` exists)

### Infrastructure
10. **OOM risk**: agent-browser + Next.js dev server simultaneous in container
11. **No persistent WebSocket** — price simulation is client-side only, no server push
12. **No real API integration** — all market data simulated (no Finnhub, MARKETAUX, etc.)

---

## 10. Unresolved Items (Non-blocking, Future Work)

### High Priority
- [ ] Migrate 32 components from `useTradingStore()` to selector pattern
- [ ] Add React Error Boundaries per tab view
- [ ] Replace 21 `transition: all` with specific CSS properties
- [ ] Add `aria-live` regions for real-time price/P&L updates

### Medium Priority
- [ ] Customizable dashboard layout (drag-and-drop with @dnd-kit)
- [ ] Multi-language support (i18n — `next-intl` already installed)
- [ ] PWA / mobile push notifications
- [ ] Real API integration (Finnhub, MARKETAUX, etc.)
- [ ] Persistent WebSocket price feed (mini-service)
- [ ] Real backtesting engine (wire to actual price history)
- [ ] Loading skeletons for Dashboard/Trading/Analysis internal sections

### Low Priority
- [ ] Email/SMS notification delivery (schema exists, no provider)
- [ ] MT5 platform integration
- [ ] ML model integration (beyond simulated AI signals)
- [ ] Social trading backend (real user data, following system)
- [ ] Performance analytics with persistent historical data

---

## 11. File Tree

```
/home/z/my-project/
├── prisma/
│   └── schema.prisma              # 11 DB models (SQLite)
├── db/
│   └── custom.db                  # SQLite database
├── public/
├── src/
│   ├── app/
│   │   ├── layout.tsx             # Root layout (54 lines)
│   │   ├── page.tsx               # Main SPA entry (398 lines)
│   │   ├── globals.css            # Glass-morphism theme (2,219 lines)
│   │   └── api/
│   │       ├── route.ts           # Health check
│   │       ├── trades/route.ts    # Trade CRUD (269 lines)
│   │       ├── signals/route.ts   # AI signals (106 lines)
│   │       ├── alerts/route.ts    # Price alerts (179 lines)
│   │       ├── news/route.ts      # News feed (200 lines)
│   │       ├── risk/route.ts      # Risk settings (142 lines)
│   │       ├── indicators/route.ts # Indicator config (109 lines)
│   │       ├── backtest/route.ts  # Backtesting (189 lines)
│   │       ├── account/route.ts   # Account info (126 lines)
│   │       └── seed/route.ts      # Demo data seeder (538 lines)
│   ├── components/
│   │   ├── trading/               # 40 custom components
│   │   │   ├── DashboardView.tsx
│   │   │   ├── TradingView.tsx
│   │   │   ├── AnalysisView.tsx
│   │   │   ├── IndicatorsView.tsx
│   │   │   ├── NewsView.tsx
│   │   │   ├── RiskView.tsx
│   │   │   ├── BacktestingView.tsx
│   │   │   ├── TradeJournalView.tsx
│   │   │   ├── PerformanceAnalyticsView.tsx
│   │   │   ├── SettingsView.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   ├── Footer.tsx
│   │   │   ├── QuickTradePanel.tsx
│   │   │   ├── PriceChart.tsx
│   │   │   ├── WatchlistPanel.tsx
│   │   │   ├── TradeHistoryTable.tsx
│   │   │   ├── TradeExecutionModal.tsx
│   │   │   ├── ActivityFeed.tsx
│   │   │   ├── EnhancedAlertPanel.tsx
│   │   │   ├── MarketHeatmap.tsx
│   │   │   ├── TradingPsychologyPanel.tsx
│   │   │   ├── SessionOverlapScanner.tsx
│   │   │   ├── MultiTimeframePanel.tsx
│   │   │   ├── SignalDetailModal.tsx
│   │   │   ├── CorrelationMatrix.tsx
│   │   │   ├── CandlestickPatternRecognition.tsx
│   │   │   ├── SocialTradingLeaderboard.tsx
│   │   │   ├── EconomicCalendar.tsx
│   │   │   ├── PositionSizeCalculator.tsx
│   │   │   ├── TradeReplay.tsx
│   │   │   ├── PerformanceScorecard.tsx
│   │   │   ├── DrawdownChart.tsx
│   │   │   ├── AdvancedOrderTypes.tsx
│   │   │   ├── OrderBookDepth.tsx
│   │   │   ├── MarketSentiment.tsx
│   │   │   ├── TradeExportButton.tsx
│   │   │   ├── TradingRulesEngine.tsx
│   │   │   ├── SoundNotificationPanel.tsx
│   │   │   ├── KeyboardShortcutsHelp.tsx
│   │   │   └── OnboardingTour.tsx
│   │   └── ui/                    # 48 shadcn/ui components
│   ├── hooks/
│   │   ├── use-price-simulator.ts  # Price engine (402 lines)
│   │   ├── use-keyboard-shortcuts.ts # Hotkeys (210 lines)
│   │   ├── use-toast.ts           # Toast system (193 lines)
│   │   └── use-mobile.ts          # Breakpoint detection (19 lines)
│   ├── store/
│   │   └── trading-store.ts       # Zustand store (458 lines)
│   └── lib/
│       ├── types.ts               # TypeScript types (321 lines)
│       ├── sounds.ts              # Sound effects (71 lines)
│       ├── utils.ts               # Utilities (6 lines)
│       └── db.ts                  # Prisma client (12 lines)
├── package.json                   # v0.2.1
├── tsconfig.json
├── tailwind.config.ts
├── next.config.ts
└── worklog.md                     # Development history (3,604 lines)
```

---

## 12. Quick Start

```bash
cd /home/z/my-project
bun install
bun run db:push          # Push Prisma schema to SQLite
bun run dev             # Start dev server on port 3000
```

Seed demo data:
```bash
curl -X POST http://localhost:3000/api/seed
```

---

*Last updated: Auto-generated from live project scan. All metrics reflect actual file counts and line numbers.*