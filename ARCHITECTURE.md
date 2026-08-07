# FINEX Indonesia Trading Dashboard — Architecture

## Overview

The FINEX Indonesia Trading Dashboard is an AI-powered forex trading platform. It provides real-time market analysis, automated trading signals, comprehensive risk management, backtesting, trade journaling, and performance analytics for four currency/metal pairs: **EUR/USD**, **USD/JPY**, **GBP/USD**, and **XAU/USD**.

The application is a single-page client-side trading dashboard with a supporting REST API layer and an optional Socket.IO-based price feed microservice.

---

## High-Level Architecture

```
┌─────────────┐     ┌──────────────────────────────────────────────┐
│   Caddy     │     │              Next.js 16 App                  │
│  (port 81)  │────▶│  ┌─────────┐  ┌──────────┐  ┌────────────┐  │
│  reverse    │     │  │ REST API │  │  Prisma  │  │  Standalone │  │
│  proxy      │     │  │ Routes   │  │  Client  │  │  Output     │  │
└─────────────┘     │  └────┬────┘  └────┬─────┘  └────────────┘  │
                          │             │                          │
│  ┌───────────────────┐  │      ┌──────┴──────┐                   │
│  │ mini-services/    │  │      │   SQLite    │                   │
│  │ price-feed        │──│──────│  (db/custom  │                   │
│  │ (Socket.IO:3003)  │  │      │   .db)      │                   │
│  └───────────────────┘  │      └─────────────┘                   │
                          │                                        │
│  ┌───────────────────┐  │  ┌─────────────────────────────────┐   │
│  │ usePriceSimulator │◀─│──│  Zustand Store (client-side)   │   │
│  │ (client-side hook)│  │  └──────────────┬──────────────┘   │
│  └───────────────────┘  │                 │                    │
                          │  ┌──────────────┴──────────────┐   │
                          │  │   React Components          │   │
                          │  │   (shadcn/ui + Radix +      │   │
                          │  │    Recharts + Framer Motion)│   │
                          │  └─────────────────────────────┘   │
                          └──────────────────────────────────────┘
```

---

## Technology Stack

| Layer            | Technology                                                              |
|------------------|-------------------------------------------------------------------------|
| Framework        | Next.js 16 (App Router, standalone output)                              |
| Language         | TypeScript 5                                                           |
| Runtime          | Bun (dev & production)                                                  |
| UI Primitives    | shadcn/ui (Radix UI primitives)                                         |
| Styling          | Tailwind CSS 4, tailwindcss-animate, tw-animate-css                     |
| State Management | Zustand 5                                                               |
| Charts           | Recharts 2                                                              |
| Animations       | Framer Motion 12                                                        |
| ORM              | Prisma 6 (client generation)                                            |
| Database         | SQLite (local file: `db/custom.db`)                                     |
| Icons            | Lucide React                                                            |
| Forms            | React Hook Form 7 + Zod 4 + @hookform/resolvers                         |
| Tables           | @tanstack/react-table 8                                                 |
| Drag & Drop      | @dnd-kit/core + @dnd-kit/sortable                                       |
| Real-time (opt.) | Socket.IO client 4 + standalone price-feed service (Bun, port 3003)     |
| Auth (dep.)      | next-auth 4                                                             |
| i18n (dep.)      | next-intl 4                                                             |
| Theming          | next-themes (dark mode default)                                         |
| Rich Text        | @mdxeditor/editor                                                      |
| Reverse Proxy    | Caddy (port 81, with XTransformPort query routing)                       |
| Fonts            | Geist Sans + Geist Mono (next/font/google)                              |

---

## Project Structure

```
my-project/
├── Caddyfile                          # Reverse proxy config (port 81)
├── next.config.ts                     # Standalone output, strict mode off
├── tailwind.config.ts                 # Tailwind CSS 4 configuration
├── postcss.config.mjs                 # PostCSS with @tailwindcss/postcss
├── tsconfig.json                      # TypeScript configuration
├── components.json                    # shadcn/ui component registry
├── package.json                       # Dependencies (v0.2.1)
├── bun.lock                           # Bun lockfile
├── db/
│   └── custom.db                      # SQLite database file
├── mini-services/
│   └── price-feed/
│       ├── index.ts                   # Socket.IO price feed server (port 3003)
│       └── package.json               # Price feed service dependencies
├── prisma/
│   └── schema.prisma                  # 11 Prisma models (SQLite)
├── public/
│   ├── logo.svg
│   └── robots.txt
└── src/
    ├── app/
    │   ├── layout.tsx                 # Root layout (dark theme, Geist fonts)
    │   ├── page.tsx                   # Main SPA entry — TradingDashboard
    │   ├── globals.css                # Global styles + glass-card utilities
    │   └── api/
    │       ├── route.ts               # Root API health check
    │       ├── seed/route.ts          # Database seeding
    │       ├── account/route.ts       # Trading account CRUD
    │       ├── trades/route.ts        # Trade CRUD (GET/POST/DELETE)
    │       ├── signals/route.ts       # Trading signals
    │       ├── alerts/route.ts        # Price alerts
    │       ├── news/route.ts          # News items
    │       ├── indicators/route.ts    # Indicator configurations
    │       ├── backtest/route.ts      # Backtesting engine
    │       └── risk/route.ts          # Risk settings
    ├── components/
    │   ├── ui/                        # 48 shadcn/ui primitive components
    │   └── trading/                   # 33 domain-specific components
    │       ├── DashboardView.tsx       # Account overview + P&L summary
    │       ├── TradingView.tsx         # Main chart + trade execution
    │       ├── PriceChart.tsx          # Candlestick price chart
    │       ├── AnalysisView.tsx        # Signal analysis + market conditions
    │       ├── IndicatorsView.tsx      # Technical indicator dashboard
    │       ├── NewsView.tsx            # Forex news feed
    │       ├── RiskView.tsx            # Risk management settings
    │       ├── BacktestingView.tsx     # Strategy backtesting
    │       ├── TradeJournalView.tsx    # Trade journal with MDX editor
    │       ├── PerformanceAnalyticsView.tsx  # Advanced performance metrics
    │       ├── SettingsView.tsx        # App configuration
    │       ├── Sidebar.tsx             # Navigation sidebar (collapsible)
    │       ├── QuickTradePanel.tsx     # Floating quick-trade widget
    │       ├── WatchlistPanel.tsx      # Symbol watchlist
    │       ├── MarketHeatmap.tsx       # Market correlation heatmap
    │       ├── MarketSentiment.tsx     # Sentiment gauges
    │       ├── OrderBookDepth.tsx      # Simulated order book
    │       ├── CorrelationMatrix.tsx   # Pair correlation matrix
    │       ├── EconomicCalendar.tsx    # Economic event calendar
    │       ├── SessionOverlapScanner.tsx # Trading session scanner
    │       ├── MultiTimeframePanel.tsx # Multi-timeframe analysis
    │       ├── CandlestickPatternRecognition.tsx # Pattern detection
    │       ├── TradingRulesEngine.tsx  # Automated rules engine
    │       ├── PerformanceScorecard.tsx # KPI scorecard
    │       ├── DrawdownChart.tsx       # Equity drawdown chart
    │       ├── TradeHistoryTable.tsx   # Trade history with sorting/filtering
    │       ├── TradeReplay.tsx         # Trade replay playback
    │       ├── TradeExecutionModal.tsx # Trade order modal
    │       ├── SignalDetailModal.tsx   # Signal detail overlay
    │       ├── EnhancedAlertPanel.tsx  # Alert management
    │       ├── AdvancedOrderTypes.tsx  # OCO, trailing stop orders
    │       ├── PositionSizeCalculator.tsx # Position sizing tool
    │       ├── SocialTradingLeaderboard.tsx # Leaderboard (social)
    │       ├── TradingPsychologyPanel.tsx # Trading psychology tracker
    │       ├── SoundNotificationPanel.tsx  # Audio notification config
    │       ├── TradeExportButton.tsx   # Export trades to CSV
    │       ├── ActivityFeed.tsx        # Real-time activity feed
    │       ├── KeyboardShortcutsHelp.tsx # Keyboard shortcuts overlay
    │       ├── OnboardingTour.tsx      # First-run onboarding
    │       └── Footer.tsx              # Status bar footer
    ├── hooks/
    │   ├── use-price-simulator.ts      # Client-side price simulation engine
    │   ├── use-mobile.ts              # Responsive breakpoint detection
    │   ├── use-toast.ts               # Toast notification hook
    │   └── use-keyboard-shortcuts.ts  # Global keyboard shortcuts
    ├── lib/
    │   ├── types.ts                   # All TypeScript types + constants
    │   ├── utils.ts                   # Utility functions (cn, formatters)
    │   ├── db.ts                      # Prisma client singleton
    │   └── sounds.ts                  # Web Audio API sound effects
    └── store/
        └── trading-store.ts           # Zustand global state (~460 lines)
```

---

## Data Flow

### Primary Data Path (Client-Side Simulation)

The app uses a **client-side price simulation hook** (`usePriceSimulator`) as its primary real-time data source, with no server dependency for live pricing:

```
usePriceSimulator (React hook)
  │
  ├── 500ms interval  → Price ticks (bid/ask/spread) → Zustand store → UI
  ├── 5s interval     → OHLCV candle updates              → Zustand store → PriceChart
  ├── 3s interval     → Technical indicator values         → Zustand store → IndicatorsView
  ├── 10s interval    → Market condition detection         → Zustand store → AnalysisView
  ├── 30s interval    → Trading signal generation          → Zustand store → Signals panel
  └── 500ms interval  → Open trade P&L + SL/TP auto-close  → Zustand store → TradingView
```

### Auto-Trading Flow

When auto-trading is enabled, the 30s signal interval includes trade execution logic:

```
Signal generated (confidence ≥ 70%)
  → Check risk limits (daily risk, max positions, max trades)
  → Check no duplicate symbol position
   → Check market condition ≠ low_volatility
  → Execute trade with risk-based lot sizing
  → Add notification toast
```

### REST API Data Path (Persistence)

```
React Component → fetch('/api/trades') → Next.js API Route → Prisma Client → SQLite
```

API routes handle CRUD operations for trades, signals, alerts, news, indicators, backtest results, risk settings, and account data. These are used for persistent storage and seeding, while the live UI operates primarily from the Zustand store.

### Optional Socket.IO Data Path

A standalone microservice (`mini-services/price-feed/`) can be run on port 3003 to provide the same simulated data via Socket.IO. The client includes `socket.io-client` as a dependency. In the current configuration, the client-side hook is the active data source.

---

## State Management

### Zustand Store (`trading-store.ts`)

The entire application state lives in a single Zustand store with these domains:

| Domain              | State Fields                                                       |
|---------------------|--------------------------------------------------------------------|
| Navigation          | `activeTab` (11 tabs), `sidebarOpen`                               |
| Prices              | `prices`, `selectedSymbol`, `priceHistory` (per-symbol candle data) |
| Market Conditions   | `marketConditions` (per-symbol: trending/range_bound/volatility)  |
| Indicators          | `indicatorValues`, `indicatorConfigs`                              |
| Trades              | `openTrades`, `closedTrades`, CRUD actions                         |
| Signals             | `signals` list, `addSignal`, `clearSignals`                       |
| News                | `newsItems`, `economicEvents`                                      |
| Alerts              | `priceAlerts` with add/remove/toggle                               |
| Risk                | `riskSettings`, `balance`, `equity`, `dailyPnl`, `isAutoTrading`  |
| Backtesting         | `backtestResults`                                                  |
| Journal             | `journalEntries` (client-side `JournalEntry` type)                |
| Notifications       | `notifications` with add/remove/auto-dismiss                       |
| Error Logs          | `errorLogs` with resolve/clear                                     |
| Connection          | `isConnected` status                                               |

---

## Navigation / Views

The app is a **single-page application** with tab-based navigation. All views are loaded via `next/dynamic` with `ssr: false` and skeleton loading states:

| Tab ID       | Component                    | Description                           |
|--------------|------------------------------|---------------------------------------|
| dashboard    | `DashboardView`              | Account overview, P&L, equity chart   |
| trading      | `TradingView`                | Price chart + trade execution         |
| analysis     | `AnalysisView`               | AI signals + market conditions        |
| indicators   | `IndicatorsView`             | Technical indicator dashboard         |
| news         | `NewsView`                   | Forex news + economic calendar        |
| risk         | `RiskView`                   | Risk management configuration         |
| backtesting  | `BacktestingView`            | Strategy backtesting engine           |
| journal      | `TradeJournalView`           | Trade journal with rich text notes    |
| analytics    | `PerformanceAnalyticsView`   | Advanced performance metrics          |
| settings     | `SettingsView`               | Application settings                  |
| errors       | `ErrorLogsView` (inline)     | System error/warning logs             |

A floating `QuickTradePanel` is accessible from any tab. Mobile uses a `Sheet`-based slide-out sidebar.

---

## Database Schema (Prisma / SQLite)

11 models in `prisma/schema.prisma`:

| Model            | Purpose                                    |
|------------------|--------------------------------------------|
| `User`           | User accounts (email, name)                |
| `TradingAccount` | Broker account (balance, equity, margin, P&L) |
| `Trade`          | Trade records (open/closed/pending)        |
| `TradingSignal`  | AI-generated trading signals               |
| `PriceAlert`     | User-defined price alerts                  |
| `NewsItem`       | Forex news articles                        |
| `EconomicEvent`  | Economic calendar events                   |
| `BacktestResult` | Strategy backtest results (JSON trades)    |
| `RiskSettings`   | Per-trade risk parameters                  |
| `ErrorLog`       | System error/warning logs                  |
| `NotificationLog`| Notification delivery records              |
| `IndicatorConfig`| Technical indicator configurations (JSON)  |

Primary key strategy: CUID. All timestamps use `DateTime @default(now())`.

---

## Trading Engine Details

### Supported Symbols

| Symbol  | Type  | Pip Size | Digits | Leverage |
|---------|-------|----------|--------|----------|
| EURUSD  | Forex | 0.0001   | 5      | 500:1    |
| USDJPY  | Forex | 0.01     | 3      | 500:1    |
| GBPUSD  | Forex | 0.0001   | 5      | 500:1    |
| XAUUSD  | Metal | 0.01     | 2      | 500:1    |

### Strategies

Seven predefined scalping strategies: MA Ribbon, Momentum Scalping, Pivot Points, EMA Crossover, RMI Trend Sync, Linear Regression, EMA/RSI Filter. Each maps to optimal market conditions and timeframes (M1–M5).

### Risk Management

- Configurable risk per trade (% of balance), stop-loss/take-profit pips, risk-reward ratio
- Max simultaneous positions, daily risk limit, daily target, max daily trades
- Automatic lot size calculation from risk parameters
- High-impact news avoidance flag

### Position Sizing

Calculated server-side in the trades API route:
- Contract size: 100,000 (forex) or 100 (XAUUSD)
- Pip value varies by quote currency
- Lot size clamped to [0.01, 50], rounded to 0.01

---

## Deployment

### Build & Run

```bash
bun install
bun run db:push          # Push Prisma schema to SQLite
bun run build            # next build → standalone output
bun run start            # NODE_ENV=production bun .next/standalone/server.js
```

### Reverse Proxy

Caddy listens on port 81 and reverse-proxies to `localhost:3000`. The `XTransformPort` query parameter allows routing to alternative ports (e.g., the price-feed service on port 3003).

### Production Output

Next.js is configured with `output: "standalone"`. The build script copies `.next/static`, `public/`, and the standalone server into `.next/standalone/` for self-contained deployment.

---

## Key Design Decisions

1. **Client-side simulation over real data**: The `usePriceSimulator` hook generates all price data, indicators, and signals client-side using random-walk algorithms. This enables full demo functionality without external API dependencies.

2. **Single Zustand store**: All application state is centralized in one store file (~460 lines). This simplifies state access but increases coupling between domains.

3. **Dynamic imports with SSR disabled**: All 11 view components are loaded with `next/dynamic({ ssr: false })` since they depend on browser APIs (canvas, audio, timers).

4. **SQLite for persistence**: Chosen for zero-configuration local development. The Prisma schema supports migration to PostgreSQL or MySQL for production.

5. **Dual data paths**: The app supports both client-side simulation (active) and Socket.IO server-side simulation (available via `mini-services/price-feed/`). The two implementations share identical simulation logic.

6. **Dark-first UI**: The root layout sets `className="dark"` with `enableSystem={false}`, establishing a dark glassmorphism design as the default and only theme.
