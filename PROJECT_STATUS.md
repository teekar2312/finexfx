# FINEX Forex Trading System — Project Status

> **Last Updated:** $(date -u '+%Y-%m-%d %H:%M UTC')  
> **Repository:** [github.com/teekar2312/finexfx](https://github.com/teekar2312/finexfx)  
> **Branch:** main  
> **Commits:** 25  

---

## Overview

FINEX is a production-ready, single-page forex trading dashboard built with Next.js 16. It features a dark glass-morphism theme, real-time price simulation, 11 tabbed views, a floating quick-trade panel, and 40 trading-specific components. All trading is client-side simulated with deterministic price feeds — no external API keys required to run.

---

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript 5 (strict) |
| Styling | Tailwind CSS 4 + 120+ custom CSS classes (2,219 lines) |
| UI Components | shadcn/ui (48 components, New York style) |
| Icons | Lucide React |
| Animations | Framer Motion |
| Charts | Recharts |
| State Management | Zustand with shallow selectors |
| Database | Prisma ORM + SQLite (12 models) |
| Server | Bun runtime |
| Gateway | Caddy reverse proxy |

---

## Project Statistics

| Metric | Value |
|--------|-------|
| Total source files | 110 |
| Trading components | 40 |
| UI components (shadcn) | 48 |
| Custom hooks | 4 |
| API routes | 10 |
| Total lines of code | ~36,300 |
| CSS (globals.css) | 2,219 lines |
| Store (trading-store.ts) | 458 lines |
| Runtime dependencies | 67 |
| Dev dependencies | 9 |
| Prisma models | 12 |

---

## Architecture

```
src/
├── app/
│   ├── page.tsx              # SPA root (dynamic imports, toast system, error logs)
│   ├── layout.tsx             # Root layout (dark theme, fonts)
│   ├── globals.css            # 2,219 lines of custom CSS
│   └── api/                   # 10 REST endpoints
│       ├── account/route.ts
│       ├── alerts/route.ts
│       ├── backtest/route.ts
│       ├── indicators/route.ts
│       ├── news/route.ts
│       ├── risk/route.ts
│       ├── seed/route.ts
│       ├── signals/route.ts
│       └── trades/route.ts
├── components/
│   ├── trading/               # 40 trading components (see map below)
│   └── ui/                    # 48 shadcn/ui components
├── hooks/
│   ├── use-price-simulator.ts # 500ms tick price simulation (replaces WebSocket)
│   ├── use-keyboard-shortcuts.ts
│   ├── use-mobile.ts
│   └── use-toast.ts
├── lib/
│   ├── types.ts               # All TypeScript interfaces, constants, symbol configs
│   ├── utils.ts               # cn() utility
│   ├── sounds.ts              # Web Audio API sound effects
│   └── db.ts                  # Prisma client singleton
├── store/
│   └── trading-store.ts       # Zustand store (458 lines)
└── mini-services/
    └── price-feed/            # Socket.IO price feed (port 3003, fallback to simulator)
```

---

## Application Tabs (11 Views)

| # | Tab | Component | Description |
|---|-----|-----------|-------------|
| 1 | Dashboard | DashboardView | Watchlist, activity feed, market heatmap, psychology, alerts, session scanner |
| 2 | Trading | TradingView | Price chart, order book, market sentiment, trade execution, history, advanced orders |
| 3 | Analysis | AnalysisView | Multi-timeframe, signals, correlation matrix, candlestick patterns, social leaderboard |
| 4 | Indicators | IndicatorsView | 30 technical indicators with configuration |
| 5 | News | NewsView | Forex news feed, economic calendar (22 events) |
| 6 | Risk | RiskView | Risk dashboard, position size calculator (4 tabs) |
| 7 | Backtesting | BacktestingView | Strategy backtesting, trade replay |
| 8 | Journal | TradeJournalView | Trade journal with mood tracking |
| 9 | Analytics | PerformanceAnalyticsView | Performance scorecard, drawdown chart, equity curves, heatmaps |
| 10 | Settings | SettingsView | Account, notifications, sound panel, trading rules engine |
| 11 | Error Logs | ErrorLogsView (inline) | System error diagnostics |

---

## Component Integration Map (40 Components)

### Page-Level Components
| Component | Location | Purpose |
|-----------|----------|---------|
| Sidebar | page.tsx | 11-tab navigation with ARIA roles |
| Footer | page.tsx | Session indicator, equity sparkline, spread display |
| QuickTradePanel | page.tsx | Floating quick-trade FAB |
| KeyboardShortcutsHelp | page.tsx | Keyboard shortcuts overlay |
| OnboardingTour | page.tsx | 7-step guided onboarding tour |
| NotificationToast | page.tsx | Custom animated toast system |

### Dashboard Sub-Components (6)
| Component | Data Source |
|-----------|-----------|
| WatchlistPanel | Store: prices, priceHistory |
| ActivityFeed | Store: notifications |
| SessionOverlapScanner | Config: TRADING_SESSIONS |
| MarketHeatmap | Store: prices |
| TradingPsychologyPanel | Store: journalEntries, closedTrades |
| EnhancedAlertPanel | Store: priceAlerts |

### Trading Sub-Components (7)
| Component | Data Source |
|-----------|-----------|
| PriceChart | Store: priceHistory |
| OrderBookDepth | Store: prices (simulated depth) |
| MarketSentiment | Simulated sentiment data |
| TradeExportButton | Store: closedTrades (CSV export) |
| AdvancedOrderTypes | Store: openTrades (OCO, trailing) |
| TradeHistoryTable | Store: closedTrades |
| TradeExecutionModal | Props from TradingView (confirmation dialog) |

### Analysis Sub-Components (5)
| Component | Data Source |
|-----------|-----------|
| MultiTimeframePanel | Store: prices, indicators |
| SignalDetailModal | Props from parent |
| CorrelationMatrix | Simulated correlation data |
| CandlestickPatternRecognition | Store: priceHistory |
| SocialTradingLeaderboard | Mock trader data (20 traders) |

### Other Sub-Components (8)
| Component | Parent View | Data Source |
|-----------|-------------|-----------|
| EconomicCalendar | NewsView | Mock events (22 items) |
| PositionSizeCalculator | RiskView | Config: BROKER_CONFIG, SYMBOL_INFO |
| TradeReplay | BacktestingView | Store: priceHistory |
| PerformanceScorecard | PerformanceAnalyticsView | Store: closedTrades |
| DrawdownChart | PerformanceAnalyticsView | Store: closedTrades |
| TradingRulesEngine | SettingsView | Store: prices, trades |
| SoundNotificationPanel | SettingsView | Standalone (localStorage) |

---

## Trading Features

### Price Feed
- 4 currency pairs: **EUR/USD, USD/JPY, GBP/USD, XAU/USD**
- 500ms tick simulation with realistic spread, bid/ask
- Falls back to client-side simulator (use-price-simulator.ts) if WebSocket unavailable
- WebSocket mini-service available on port 3003 (Socket.IO)

### Trade Execution
- BUY/SELL with configurable lot size, stop-loss (pips), take-profit (pips)
- **Trade Execution Modal** with SVG price visualization, risk metrics grid, R:R display
- **One-click trading** mode (bypasses confirmation modal)
- **Quick Trade Panel** — floating FAB for fast trading from any tab
- **Advanced Order Types**: OCO, Break-Even Stop, Trailing Limit
- Daily trade count limit & daily risk limit enforcement
- Negative equity auto-close guard
- Margin call warning at 50% equity level

### Risk Management
- Position Size Calculator (4 tabs: Size, Pip Value, R:R Visualizer, Swap)
- Risk settings with 8 validated/clamped fields
- Account risk exposure tracking
- Session overlap scanner with volatility prediction

### Analysis
- 30 technical indicators (RSI, MACD, Bollinger, Stochastic, ATR, ADX, etc.)
- 7 AI strategies: MA Ribbon, Momentum Scalping, Pivot Points, EMA Crossover, RMI Trend Sync, Linear Regression, EMA RSI Filter
- 4 market conditions: Trending, Range-Bound, High Volatility, Low Volatility
- Multi-timeframe analysis
- Correlation Matrix (4×4 heatmap with insights)
- Candlestick Pattern Recognition (8 patterns with custom SVG)
- Signal detail modals

### Performance & Analytics
- Performance Scorecard (weekly/monthly, A+–F grading, real closedTrades data)
- Drawdown Chart (equity curve + drawdown with timeframe filters)
- Daily P&L, win rate, profit factor, Sharpe-like score
- P&L heatmap by day/week
- Symbol performance breakdown

### Social & Psychology
- Social Trading Leaderboard (20 mock Indonesian traders, podium, follow system)
- Trading Psychology Panel (discipline gauge, mood timeline, emotion chart, streaks)

### News & Calendar
- Forex news feed with impact badges, category filters
- Economic Calendar (22 events, countdown timers, value comparison bars, pulse animation)

### Automation
- Trading Rules Engine (10 conditions, 6 actions, 8 templates, localStorage persistence)
- Price alerts with live distance tracking
- Keyboard shortcuts (B=Buy, S=Sell, 1-4=Symbols, Esc=Close)

### Other
- Trade journal with mood tagging
- CSV trade export
- Sound notification panel (8 categories, volume control, quiet hours)
- 7-step onboarding tour
- Trade replay (tick-by-tick playback with practice mode)
- Backtesting (strategy simulation)

---

## Design System

### Theme
- Dark glass-morphism (bg-background with glass-card-premium pattern)
- No indigo/blue — primary accent is emerald-500
- Error/danger: red-500, Warning: amber-500
- All 15 views use `glass-card-premium` (unified card style)

### CSS (globals.css — 2,219 lines)
- **120+ custom utility classes** including:
  - `glass-card-premium` — main card style with backdrop blur
  - `card-hover-lift` — hover elevation effect
  - `card-press` — active press feedback
  - `neon-text-emerald` / `neon-text-red` — glowing text
  - `badge-glow-emerald` / `badge-glow-amber` / `badge-glow-red` — pulsing badge glow
  - `glow-pulse-emerald` / `amber` / `red` — animated glow keyframes
  - `text-gradient-emerald` / `warm` / `cool` — gradient text
  - `glass-tag` variants — reusable tag pills
  - `breathe` — subtle opacity pulse for live elements
  - `shimmer-subtle` — loading shimmer
  - `custom-scrollbar` — thin styled scrollbar
  - `mesh-gradient-bg` — subtle background gradient

### Animations
- Framer Motion on all views: staggered entry, tab transitions, modal slide-up
- `as const` on all variant objects (TypeScript type safety)
- CSS @keyframes for: pulse, shimmer, glow, badge-pulse, equalizer bars

---

## State Management (Zustand)

### Store: trading-store.ts (458 lines)
- **All components use individual selectors** (useShallow) — no full-store re-renders
- **Zero `any` types** remaining
- **Key state**: activeTab, selectedSymbol, prices, priceHistory, openTrades, closedTrades, balance, equity, margin, riskSettings, priceAlerts, notifications, errorLogs, journalEntries
- **Key actions**: addTrade, closeTrade, updateTrade, addPriceAlert, removePriceAlert, setRiskSettings, updateAccountPnl, addNotification, removeNotification
- **Safety guards**: negative equity auto-close, margin call warning, daily trade/risk limits, risk settings validation (8 clamped fields)

### P&L Formula
```
pips = (currentPrice - entryPrice) / pipSize * directionMultiplier
profit = pips * lotSize * pipMultiplier * pipSize
```

---

## Data Layer

### Prisma Models (12)
TradingAccount, Trade, TradingSignal, PriceAlert, NewsItem, EconomicEvent, BacktestResult, RiskSettings, ErrorLog, NotificationLog, IndicatorConfig

### Data Sources
| Source | Status |
|--------|--------|
| Price feed | Client-side simulator (500ms ticks) |
| Trade data | In-memory Zustand store (session-based) |
| Technical indicators | Computed from price history |
| AI signals | Simulated (rule-based, not ML) |
| News | Mock data (17 articles) |
| Economic calendar | Mock data (22 events) |
| Social leaderboard | Mock data (20 traders) |
| Backtest results | Mock data |
| Journal entries | In-memory store |

---

## Known Limitations

### Architecture
- All data is session-based (lost on refresh) — no persistent trade history
- WebSocket gateway routing requires Caddy proxy for external access
- OOM risk when agent-browser and Next.js run simultaneously in container

### Mock Data (requires backend for real data)
- Social Trading Leaderboard (needs user accounts backend)
- Backtesting results (needs historical price database)
- PerformanceAnalyticsView charts (equity curve, daily P&L, heatmap use seeded PRNG)
- News feed and Economic Calendar (needs Finhub/MARKETAUX API)

### Future Enhancements
- Customizable dashboard layout (drag-and-drop)
- Multi-language support (i18n)
- PWA / mobile push notifications
- Email/SMS notification delivery
- MT5 platform integration
- Real API integration (Finnhub, MARKETAUX)
- ML model integration (beyond simulated AI)
- React Error Boundaries per tab
- aria-live regions for price/P&L updates
- Replace 22 `transition: all` CSS with specific properties

---

## Development

### Commands
```bash
bun install              # Install dependencies
bun run dev             # Start dev server (port 3000)
bun run lint            # ESLint check
bun run db:push         # Push Prisma schema to SQLite
```

### Code Quality
- **ESLint**: Zero errors
- **TypeScript**: Strict mode, no `any` types in store
- **All 40 components**: `'use client'` directive, proper typing
- **Accessibility**: ARIA roles on sidebar, footer, buttons; keyboard navigation

### Commit History
```
4349263 fix: integrate TradeExecutionModal into TradingView
17a8a9f feat: 6 major improvements — Rules Engine, live data, code splitting, leaderboard
e0e9b13 feat: 5 new features — Position Calculator, Drawdown Chart, Alert Panel, Tour, Replay
c7b122c fix: deep integration audit — 4 critical + 22 type errors
a8ac1c9 feat: critical optimizations — store safety, performance, accessibility
```

---

## File Structure (Production Files Only)

```
finexfx/
├── .gitignore
├── Caddyfile
├── components.json
├── eslint.config.mjs
├── next.config.ts
├── package.json
├── bun.lock
├── postcss.config.mjs
├── tailwind.config.ts
├── tsconfig.json
├── worklog.md                    # Development handover document (3,600+ lines)
├── PROJECT_STATUS.md             # This file
├── prisma/
│   └── schema.prisma
├── db/
│   └── custom.db
├── public/
│   ├── robots.txt
│   └── logo.svg
├── mini-services/
│   └── price-feed/
│       ├── index.ts
│       ├── package.json
│       └── bun.lock
└── src/
    ├── app/                      # Next.js App Router
    ├── components/
    │   ├── trading/              # 40 components
    │   └── ui/                   # 48 shadcn/ui components
    ├── hooks/                    # 4 custom hooks
    ├── lib/                      # Types, utils, DB, sounds
    └── store/                    # Zustand store
```
