<div align="center">

# 🏦 FINEX Indonesia

### Professional Forex Trading Dashboard

**Real-time price simulation · AI-powered signals · Advanced risk management · Backtesting engine**

[![Next.js 16](https://img.shields.io/badge/Next.js-16.1.1-black?logo=next.js)](https://nextjs.org/)
[![React 19](https://img.shields.io/badge/React-19.0.0-61dafb?logo=react)](https://react.dev/)
[![TypeScript 5](https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS 4](https://img.shields.io/badge/Tailwind_CSS-4-38bdf8?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Bun](https://img.shields.io/badge/Runtime-Bun-000?logo=bun)](https://bun.sh/)
[![Prisma 6](https://img.shields.io/badge/Prisma-6.11.1-2d3748?logo=prisma)](https://www.prisma.io/)
[![License](https://img.shields.io/badge/License-Private-red)]()
[![Version](https://img.shields.io/badge/Version-0.2.1-blue)]()

---

<p>
  <strong>40 trading components</strong> &middot;
  <strong>48 shadcn/ui components</strong> &middot;
  <strong>34,123 lines of code</strong> &middot;
  <strong>Zero lint errors</strong>
</p>

</div>

---

## 📑 Table of Contents

- [Overview](#-overview)
- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Project Stats](#-project-stats)
- [Quick Start](#-quick-start)
- [Available Scripts](#-available-scripts)
- [Environment Variables](#-environment-variables)
- [Architecture](#-architecture)
- [Database Schema](#-database-schema)
- [Trading Engine](#-trading-engine)
- [API Endpoints](#-api-endpoints)
- [Keyboard Shortcuts](#-keyboard-shortcuts)
- [License](#-license)

---

## 🌟 Overview

**FINEX Indonesia** is a comprehensive, full-featured forex trading dashboard built with a modern React stack. It simulates real-time market conditions for 4 major currency pairs with realistic OHLCV candle generation at 500ms tick intervals. The platform includes AI-powered trading signals, advanced order management, risk controls, backtesting with equity curves, a trade journal with psychological tracking, and performance analytics — all wrapped in a premium dark glass-morphism interface.

Designed for the Indonesian retail forex market with broker configuration matching FINEX Indonesia's specifications: **500x leverage**, **0.5 pip minimum spread**, **0.01–50 lot range**, **50% margin call**, and **20% stop-out** levels.

---

## ✨ Features

### 📊 Real-Time Market Simulation
- **4 currency pairs**: EURUSD, USDJPY, GBPUSD, XAUUSD
- **500ms tick interval** with realistic price movement
- **OHLCV candle generation** from tick data
- Candlestick pattern recognition engine
- Multi-timeframe analysis panel
- Correlation matrix across pairs
- Market heatmap visualization
- Market sentiment gauge
- Order book depth visualization
- Session overlap scanner (London/NY overlap detection)

### 🧭 11 Tab Views
| # | Tab | Description |
|---|-----|-------------|
| 1 | **Dashboard** | Overview with real-time prices, watchlist, and quick stats |
| 2 | **Trading** | Full order placement with advanced order types |
| 3 | **Analysis** | Multi-timeframe chart analysis with drawing tools |
| 4 | **Indicators** | 30 technical indicators with configurable parameters |
| 5 | **News** | Economic calendar with impact-based filtering |
| 6 | **Risk** | Position sizing, daily limits, margin guards |
| 7 | **Backtesting** | Strategy backtesting with equity curves and trade replay |
| 8 | **Trade Journal** | Mood tracking, mistakes/lessons, star ratings |
| 9 | **Performance Analytics** | Scorecards, drawdown charts, session analysis |
| 10 | **Settings** | Broker config, display preferences, risk parameters |
| 11 | **Error Logs** | Application error tracking and diagnostics |

### 🤖 AI Trading Signals
- **7 signal strategies**:
  - MA_Ribbon
  - Momentum_Scalping
  - Pivot_Points
  - EMA_Crossover
  - RMI_Trend_Sync
  - Linear_Regression
  - EMA_RSI_Filter
- **4 market condition types**: trending, range_bound, high_volatility, low_volatility
- Confidence scoring and signal aggregation

### 📋 Advanced Order Types
- Standard Market and Limit orders
- **OCO** (One-Cancels-the-Other) orders
- **Trailing Stop** with configurable step distance
- **Break-Even automation** — automatically moves stop-loss to entry price

### ⚙️ Trading Rules Engine
- If-then automation rules
- Configurable conditions and actions
- Real-time rule evaluation on price ticks

### 🛡️ Risk Management
- Position size calculator (based on account risk % and stop distance)
- Daily risk limits with automatic trading halt
- Maximum concurrent positions cap
- Margin call guard at 50%
- Stop-out guard at 20%

### 📈 Backtesting
- Historical strategy simulation
- Equity curve visualization with Recharts
- Trade-by-trade replay with chronological playback
- Performance metric calculation (win rate, profit factor, Sharpe ratio)

### 📝 Trade Journal
- Per-trade notes and annotations
- **Mood tracking** before and after each trade
- Mistakes and lessons learned log
- **5-star rating** system for trade quality
- Filterable and searchable history

### 🏆 Social Trading & Analytics
- Social trading leaderboard (mock data)
- Performance scorecards with multi-metric evaluation
- Drawdown charts (absolute, relative, maximum)
- Session analysis (Asian, London, New York breakdown)

### 🎨 Premium UI/UX
- **Dark glass-morphism theme** — 2,219 lines of custom CSS
- **120+ animation classes** with Framer Motion 12
- Floating quick-trade panel accessible from any tab
- Mobile responsive with Sheet-based sidebar navigation
- Custom notification toast system with progress bars
- Onboarding tour for new users
- Sound notifications for trade events

---

## 🛠️ Tech Stack

| Technology | Version | Purpose |
|-----------|---------|---------|
| **Next.js** | 16.1.1 | App Router, standalone output mode |
| **React** | 19.0.0 | UI library |
| **TypeScript** | 5 | Type-safe development |
| **Tailwind CSS** | 4 | Utility-first styling |
| **shadcn/ui** | — | New York style component library (48 components) |
| **Framer Motion** | 12.23.2 | Animation library |
| **Recharts** | 2.15.4 | Charting and data visualization |
| **Zustand** | 5.0.6 | Global state management |
| **Prisma** | 6.11.1 | ORM with SQLite |
| **Lucide React** | 0.525.0 | Icon library |
| **TanStack Table** | 8.21.3 | Headless table component |
| **TanStack Query** | 5.82.0 | Server state management |
| **Next Themes** | 0.4.6 | Theme provider |
| **Socket.IO Client** | 4.8.3 | WebSocket communication |
| **Zod** | 4.0.2 | Schema validation |
| **date-fns** | 4.1.0 | Date utilities |
| **Bun** | — | JavaScript runtime and package manager |

---

## 📐 Project Stats

| Metric | Count |
|--------|-------|
| Trading Components | 40 |
| shadcn/ui Components | 48 |
| TypeScript/TSX Lines | 34,123 |
| CSS Lines | 2,219 |
| API Routes | 9 (1,858 lines) |
| Custom Hooks | 4 (824 lines) |
| Prisma DB Models | 11 |
| Lint Errors | **0** |

---

## 🚀 Quick Start

### Prerequisites
- [Bun](https://bun.sh/) installed on your system

### Installation

```bash
# Clone the repository
git clone https://github.com/teekar2312/finexfx.git
cd finexfx

# Install dependencies
bun install

# Push database schema to SQLite
bun run db:push

# Start the development server
bun run dev
```

The application will be available at **http://localhost:3000**.

### Seed Demo Data

After starting the dev server, populate the database with sample trading data:

```bash
curl -X POST http://localhost:3000/api/seed
```

---

## 📜 Available Scripts

| Script | Command | Description |
|--------|---------|-------------|
| **Dev Server** | `bun run dev` | Start development server on port 3000 |
| **Production Build** | `bun run build` | Create optimized standalone build |
| **Start Production** | `bun run start` | Launch production server |
| **Lint** | `bun run lint` | Run ESLint checks |
| **Push Schema** | `bun run db:push` | Push Prisma schema to SQLite |
| **Generate Client** | `bun run db:generate` | Generate Prisma client from schema |
| **Run Migrations** | `bun run db:migrate` | Apply pending database migrations |
| **Reset Database** | `bun run db:reset` | Drop and recreate the database |

---

## 🔑 Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `file:./db/custom.db` | SQLite connection string |

Set environment variables in a `.env` file at the project root. Example:

```env
DATABASE_URL=file:./db/custom.db
```

The default database file is located at `db/custom.db`.

---

## 🏗️ Architecture

```
finexfx/
├── app/                    # Next.js App Router
│   ├── (tabs)/            # Tab-based route group (11 views)
│   ├── api/               # 9 REST API routes
│   ├── layout.tsx         # Root layout with providers
│   └── page.tsx           # Dashboard entry point
├── components/            # 40 trading + 48 shadcn/ui components
│   ├── trading/           # Domain-specific trading components
│   ├── ui/                # shadcn/ui components (New York style)
│   └── shared/            # Shared layout and navigation
├── hooks/                 # 4 custom React hooks (824 lines)
├── lib/                   # Utilities, stores, types
│   ├── stores/            # Zustand state stores
│   ├── types/             # TypeScript type definitions
│   └── utils/             # Helper functions
├── db/                    # SQLite database
│   └── custom.db
├── prisma/                # Prisma schema and migrations
│   └── schema.prisma      # 11 DB models
├── public/                # Static assets
└── styles/                # 2,219 lines of custom CSS
```

### Code Splitting
All tab views and heavy components use dynamic imports to minimize initial bundle size and improve time-to-interactive.

### State Management
- **Zustand 5** manages global trading state (positions, orders, account balance, settings)
- **TanStack Query 5** handles server state and API caching
- Component-local state for UI concerns

---

## 🗄️ Database Schema

11 Prisma models powering the application:

| Model | Purpose |
|-------|---------|
| **Account** | Trading account balance and currency |
| **Position** | Open trading positions |
| **Order** | Pending and filled orders (market, limit, OCO) |
| **Trade** | Closed trade history with P&L |
| **JournalEntry** | Trade journal entries with mood and ratings |
| **Signal** | AI-generated trading signals |
| **Candle** | OHLCV candle data per pair and timeframe |
| **EconomicEvent** | Calendar events with impact levels |
| **BacktestResult** | Backtesting run results and metrics |
| **TradingRule** | User-defined automation rules |
| **ErrorLog** | Application error records |

---

## 💹 Trading Engine

### Broker Configuration

| Parameter | Value |
|-----------|-------|
| **Broker** | FINEX Indonesia |
| **Leverage** | 500x |
| **Min Spread** | 0.5 pips |
| **Lot Range** | 0.01 – 50.00 |
| **Margin Call** | 50% |
| **Stop Out** | 20% |

### P&L Formula

```
P&L = pips × lotSize × pipMultiplier × pipSize
```

### Traded Instruments

| Pair | Description |
|------|-------------|
| **EURUSD** | Euro / US Dollar |
| **USDJPY** | US Dollar / Japanese Yen |
| **GBPUSD** | British Pound / US Dollar |
| **XAUUSD** | Gold / US Dollar |

---

## 🔌 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/prices` | Real-time prices for all pairs |
| `GET/POST` | `/api/trades` | Retrieve and create trades |
| `POST` | `/api/orders` | Place new orders |
| `PATCH` | `/api/orders/[id]` | Modify or cancel orders |
| `GET` | `/api/account` | Account balance and margin info |
| `GET` | `/api/signals` | AI trading signals |
| `GET` | `/api/candles` | Historical OHLCV data |
| `GET` | `/api/calendar` | Economic calendar events |
| `POST` | `/api/seed` | Seed database with demo data |

All endpoints return JSON responses with consistent error handling. Total API implementation: **1,858 lines** across 9 route handlers.

---

## ⌨️ Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `B` | Open Buy order panel |
| `S` | Open Sell order panel |
| `1` – `9`, `0` | Switch to tabs 1–10 (Dashboard, Trading, …) |
| `?` | Open keyboard shortcuts help overlay |

---

## 📄 License

This project is **Private** — all rights reserved. Unauthorized distribution or commercial use is prohibited.

---

<div align="center">

**Built with ❤️ for the Indonesian forex trading community**

**FINEX Indonesia** &middot; v0.2.1

</div>
