# Changelog

All notable changes to the FINEX Indonesia Trading Dashboard.

---

## [0.2.1] - 2025-08-07

### Added
- **Trade Journal** — Full trade journaling system with mood tracking (great/good/neutral/bad/terrible), star ratings, mistake/lesson recording, tag system, and rich text notes
- **Session Overlap Scanner** — Detects London/NY overlap windows with live countdown timers
- **Trading Rules Engine** — If-then automation system for auto-executing trades based on market conditions, time, and indicator thresholds
- **Sound Notifications** — Configurable sound effects for trade open/close, alerts, errors with volume/pitch controls
- **Performance Scorecard** — Comprehensive KPI cards: win rate, avg win/loss, profit factor, Sharpe ratio, best/worst trade, streaks
- **Drawdown Chart** — Visual equity drawdown visualization using closed trade data
- **Trading Psychology Panel** — Mood distribution charts, trading mistake patterns, discipline scoring, emotional trend analysis
- **Enhanced Alert Panel** — Advanced price alert management with multiple condition types and batch operations
- **Trade Execution Modal** — Confirmation dialog with SVG price visualization, risk metrics display, one-click bypass option
- **Error Logs Tab** — 11th tab for system error diagnostics with resolve tracking and level filtering (error/warning/info)
- **Onboarding Tour** — First-visit guided tour highlighting key UI areas
- **Dismiss All** — Bulk dismiss for notification toasts (3+)
- **PROJECT_STATE.md** — Standalone project state document with live-scanned metrics

### Changed
- Component count: 39 → 40 (added TradeJournalView)
- UI component count: 13 → 48 (expanded shadcn/ui set)
- Total source lines: ~18,000 → 34,123 (TS/TSX)
- API routes: 8 → 9 (added seed endpoint)
- Hooks: 3 → 4 (added use-keyboard-shortcuts)

### Fixed
- **TradeExecutionModal orphan component** — Was defined but never rendered in TradingView JSX. Added render with `onConfirm` prop wiring
- **Duplicate imports** in TradingView (TradeExecutionModal types imported twice)
- **Duplicate state declarations** in TradeExecutionModal
- All 40/40 components now have `'use client'` directive (was 38/39)
- Zero console.log statements in `src/`
- Zero duplicate imports across all files
- Zero lint errors

---

## [0.2.0] - 2025-08-06

### Added
- **11-tab SPA** — Dashboard, Trading, Analysis, Indicators, News, Risk, Backtesting, Journal, Analytics, Settings
- **Real-time price simulation** — 500ms tick interval for EURUSD, USDJPY, GBPUSD, XAUUSD
- **OHLCV candle generation** — Client-side price engine with realistic bid/ask spread
- **30 technical indicators** — Trend, momentum, volatility, volume categories
- **7 AI trading strategies** — MA_Ribbon, Momentum_Scalping, Pivot_Points, EMA_Crossover, RMI_Trend_Sync, Linear_Regression, EMA_RSI_Filter
- **4 market conditions** — Trending, range_bound, high_volatility, low_volatility
- **Zustand store** — Single store with 12 state domains
- **9 REST API endpoints** — Trades, Account, Signals, Alerts, Risk, Indicators, News, Backtest, Seed
- **11 Prisma DB models** — User, TradingAccount, Trade, TradingSignal, PriceAlert, NewsItem, EconomicEvent, BacktestResult, RiskSettings, ErrorLog, NotificationLog, IndicatorConfig
- **Quick Trade Panel** — Floating panel accessible from any tab, one-click BUY/SELL
- **Price Chart** — Candlestick chart with Recharts
- **Order Book Depth** — Simulated order book visualization
- **Market Sentiment** — Bull/bear sentiment gauge
- **Correlation Matrix** — Cross-pair correlation heatmap
- **Candlestick Pattern Recognition** — Pattern detection display
- **Multi-Timeframe Panel** — Multi-TF analysis view
- **Social Trading Leaderboard** — Mock trader rankings
- **Economic Calendar** — Event schedule with impact filtering
- **Position Size Calculator** — Risk-based lot sizing
- **Trade Replay** — Bar-by-bar backtest visualization
- **Performance Analytics** — Charts and KPIs
- **Advanced Order Types** — OCO, trailing stop, break-even
- **Trade History Table** — Sortable/filterable trade log
- **Trade Export** — CSV export functionality
- **Market Heatmap** — Currency strength visualization
- **Activity Feed** — Real-time event stream
- **Watchlist Panel** — Favorite pairs with quick stats
- **Keyboard Shortcuts** — B=Buy, S=Sell, 1-0=tabs, ?=help, Esc=close
- **Mobile Responsive** — Sheet-based sidebar, touch-friendly targets
- **Custom Toast System** — Animated notifications with progress bars
- **Dark Glass-Morphism Theme** — 2,219 lines CSS, 120+ animation classes
- **Code Splitting** — Dynamic imports for all tab views with loading skeletons
- **Sticky Footer** — Premium footer with broker info

### Infrastructure
- Next.js 16 with App Router, standalone output
- TypeScript 5 with strict mode
- Tailwind CSS 4
- shadcn/ui (New York style)
- Framer Motion 12 for animations
- Recharts 2.15 for charts
- Zustand 5 for state
- Prisma 6 with SQLite
- Bun runtime

---

## [0.1.0] - 2025-08-05

### Added
- Initial project scaffolding
- Next.js 16 + TypeScript + Tailwind CSS 4
- shadcn/ui component library setup
- Basic page layout
- SQLite database with Prisma
- Health check API endpoint (`GET /api`)

---