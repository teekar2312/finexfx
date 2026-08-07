# API Reference

> FINEX Indonesia Trading Dashboard — REST API Documentation
> Base URL: `http://localhost:3000/api`

---

## Overview

All endpoints return JSON. The API uses standard HTTP methods and status codes:

| Code | Meaning |
|------|---------|
| `200` | Success |
| `400` | Bad Request (validation error) |
| `404` | Not Found |
| `500` | Internal Server Error |

---

## 1. Trades

### `GET /api/trades`

List all trades with open/closed separation.

**Response:**

```json
{
  "trades": [Trade],
  "openTrades": [Trade],
  "closedTrades": [Trade],
  "totalOpen": 2,
  "totalClosed": 15
}
```

**Trade object:**

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Unique trade ID (cuid) |
| `accountId` | `string` | Associated account ID |
| `symbol` | `"EURUSD" \| "USDJPY" \| "GBPUSD" \| "XAUUSD"` | Trading pair |
| `direction` | `"BUY" \| "SELL"` | Trade direction |
| `lotSize` | `number` | Lot size (0.01–50) |
| `entryPrice` | `number` | Entry price |
| `currentPrice` | `number` | Current market price |
| `stopLoss` | `number \| null` | Stop loss price |
| `takeProfit` | `number \| null` | Take profit price |
| `trailingStop` | `number \| null` | Trailing stop distance |
| `isTrailingStop` | `boolean` | Trailing stop active flag |
| `pips` | `number` | Pips gained/lost |
| `profit` | `number` | P&L in USD |
| `commission` | `number` | Commission in USD ($1/lot) |
| `spread` | `number` | Spread cost |
| `swap` | `number` | Overnight swap |
| `status` | `"open" \| "closed" \| "pending"` | Trade status |
| `strategy` | `string \| null` | Strategy used |
| `aiConfidence` | `number \| null` | AI signal confidence (0–100) |
| `marketCondition` | `string \| null` | Market condition at entry |
| `openedAt` | `string` | ISO 8601 timestamp |
| `closedAt` | `string \| null` | ISO 8601 timestamp |

---

### `POST /api/trades`

Open a new trade. If `lotSize` is not provided, it is auto-calculated from risk settings.

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `symbol` | `string` | Yes | One of: `EURUSD`, `USDJPY`, `GBPUSD`, `XAUUSD` |
| `direction` | `string` | Yes | `BUY` or `SELL` |
| `lotSize` | `number` | No | Lot size (auto-calculated if omitted, range: 0.01–50) |
| `entryPrice` | `number` | Yes | Entry price |
| `stopLoss` | `number` | No | Stop loss price |
| `takeProfit` | `number` | No | Take profit price |
| `strategy` | `string` | No | Strategy name |
| `aiConfidence` | `number` | No | AI confidence (0–100) |
| `marketCondition` | `string` | No | Market condition at entry |

**Lot size auto-calculation formula:**

```
riskAmount = balance × (riskPerTrade / 100)
contractSize = symbol === 'XAUUSD' ? 100 : 100000
pipValue = stopLossPips × pipSize × contractSize
lotSize = clamp(riskAmount / pipValue, 0.01, 50)
```

**Response:** Returns the created `Trade` object.

---

### `DELETE /api/trades?id={tradeId}`

Close an open trade. Updates account balance with realized P&L.

**Query params:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `string` | Yes | Trade ID to close |

**Response:**

```json
{
  "message": "Trade closed successfully",
  "trade": {
    "id": "clx...",
    "symbol": "EURUSD",
    "direction": "BUY",
    "profit": 12.50,
    "status": "closed",
    "closedAt": "2025-08-07T09:00:00.000Z"
  }
}
```

**Errors:**
- `400` — Trade ID missing or trade already closed
- `404` — Trade not found

---

## 2. Account

### `GET /api/account`

Get trading account info with live equity/margin calculation. Auto-creates a default demo account if none exists.

**Response:**

```json
{
  "id": "clx...",
  "accountType": "demo",
  "broker": "FINEX Indonesia",
  "balance": 10000,
  "equity": 10050.25,
  "margin": 200.00,
  "freeMargin": 9850.25,
  "marginLevel": 5025.13,
  "leverage": 500,
  "currency": "USD",
  "dailyPnl": 50.25,
  "totalPnl": 150.75,
  "isAutoTrading": false,
  "openPositions": 2,
  "unrealizedPnl": 50.25
}
```

**Equity calculation:**

```
equity = balance + sum(openTrade.profit)
margin = sum(lotSize × contractSize / leverage)
freeMargin = equity - margin
marginLevel = (equity / margin) × 100
```

---

### `POST /api/account`

Update account settings (partial update supported).

**Request body (any combination):**

| Field | Type | Description |
|-------|------|-------------|
| `isAutoTrading` | `boolean` | Toggle auto-trading |
| `leverage` | `number` | Account leverage |
| `accountType` | `"live" \| "demo"` | Account type |

---

## 3. Signals

### `GET /api/signals`

List AI-generated trading signals (most recent 50).

**Response:**

```json
{
  "signals": [Signal],
  "recent": [Signal],
  "total": 50
}
```

**Signal object:**

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Unique signal ID |
| `symbol` | `string` | Trading pair |
| `direction` | `"BUY" \| "SELL" \| "HOLD"` | Signal direction |
| `confidence` | `number` | Confidence (0–100) |
| `strategy` | `string` | Strategy name (see list below) |
| `marketCondition` | `string` | `trending` / `range_bound` / `high_volatility` / `low_volatility` |
| `entryPrice` | `number` | Suggested entry price |
| `stopLoss` | `number \| null` | Suggested stop loss |
| `takeProfit` | `number \| null` | Suggested take profit |
| `riskReward` | `number \| null` | Risk-reward ratio |
| `aiAnalysis` | `string \| null` | AI analysis text |
| `isExecuted` | `boolean` | Whether signal was executed |
| `executedTradeId` | `string \| null` | Linked trade ID |
| `createdAt` | `string` | ISO 8601 timestamp |

**Available strategies:**
`MA_Ribbon`, `Momentum_Scalping`, `Pivot_Points`, `EMA_Crossover`, `RMI_Trend_Sync`, `Linear_Regression`, `EMA_RSI_Filter`

---

### `POST /api/signals`

Create a new trading signal.

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `symbol` | `string` | Yes | Trading pair |
| `direction` | `string` | Yes | `BUY`, `SELL`, or `HOLD` |
| `confidence` | `number` | Yes | 0–100 (clamped) |
| `strategy` | `string` | Yes | Strategy name |
| `marketCondition` | `string` | No | Defaults to `"trending"` |
| `entryPrice` | `number` | No | Defaults to `0` |
| `stopLoss` | `number` | No | |
| `takeProfit` | `number` | No | |
| `riskReward` | `number` | No | |
| `aiAnalysis` | `string` | No | Analysis text |

---

## 4. Alerts

### `GET /api/alerts`

List all price alerts.

**Response:**

```json
{
  "alerts": [Alert],
  "activeAlerts": [Alert],
  "triggeredAlerts": [Alert],
  "total": 8,
  "activeCount": 5
}
```

**Alert object:**

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Alert ID |
| `symbol` | `string` | Trading pair |
| `condition` | `string` | `above`, `below`, `crosses_above`, `crosses_below` |
| `price` | `number` | Target price |
| `isActive` | `boolean` | Alert active flag |
| `message` | `string \| null` | Custom message |
| `triggeredAt` | `string \| null` | When triggered (ISO 8601) |
| `createdAt` | `string` | Creation time (ISO 8601) |

---

### `POST /api/alerts`

Create a new price alert.

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `symbol` | `string` | Yes | Trading pair |
| `condition` | `string` | Yes | `above`, `below`, `crosses_above`, `crosses_below` |
| `price` | `number` | Yes | Target price |
| `message` | `string` | No | Custom notification message |

---

### `DELETE /api/alerts?id={alertId}`

Delete a price alert.

**Query params:** `id` (required) — Alert ID

---

### `PUT /api/alerts`

Toggle an alert's active status.

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `string` | Yes | Alert ID |
| `isActive` | `boolean` | Yes | New active state |

---

## 5. Risk Settings

### `GET /api/risk`

Get current risk settings. Returns defaults if none exist in DB.

**Response:**

```json
{
  "id": "clx..." \| null,
  "riskPerTrade": 0.5,
  "stopLossPips": 10,
  "takeProfitPips": 15,
  "riskRewardRatio": 1.5,
  "maxSimultaneousPositions": 3,
  "dailyRiskLimit": 3.0,
  "avoidMajorNews": true,
  "dailyTargetPercent": 2.0,
  "maxDailyTrades": 10,
  "isDefault": false,
  "updatedAt": "2025-08-07T..."
}
```

**Defaults (when `isDefault: true`):**

| Setting | Default | Validation |
|---------|---------|------------|
| `riskPerTrade` | 0.5% | 0.1–10 |
| `stopLossPips` | 10 | 1–100 |
| `takeProfitPips` | 15 | — |
| `riskRewardRatio` | 1.5 | — |
| `maxSimultaneousPositions` | 3 | — |
| `dailyRiskLimit` | 3.0% | — |
| `avoidMajorNews` | true | — |
| `dailyTargetPercent` | 2.0% | — |
| `maxDailyTrades` | 10 | — |

---

### `POST /api/risk`

Create or update risk settings (upsert). Only provided fields are updated.

**Request body:** Any subset of the fields above.

**Validation:**
- `riskPerTrade` must be 0.1–10
- `stopLossPips` must be 1–100

---

## 6. Indicators

### `GET /api/indicators`

List all indicator configurations, grouped by category.

**Response:**

```json
{
  "indicators": [IndicatorConfig],
  "byCategory": {
    "trend": [IndicatorConfig],
    "momentum": [IndicatorConfig],
    "volatility": [IndicatorConfig],
    "volume": [IndicatorConfig]
  },
  "total": 30
}
```

**IndicatorConfig object:**

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Config ID |
| `name` | `string` | Indicator name |
| `category` | `string` | `trend`, `momentum`, `volatility`, or `volume` |
| `enabled` | `boolean` | Whether enabled |
| `settings` | `object` | Indicator-specific parameters (parsed JSON) |
| `createdAt` | `string` | ISO 8601 |
| `updatedAt` | `string` | ISO 8601 |

---

### `POST /api/indicators`

Create or update an indicator configuration (upsert).

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `string` | No | If provided, updates existing config |
| `name` | `string` | No* | Indicator name (required for create) |
| `category` | `string` | No* | `trend`, `momentum`, `volatility`, `volume` |
| `enabled` | `boolean` | No | Enable/disable |
| `settings` | `object` | No | Settings object (serialized to JSON) |

---

## 7. News

### `GET /api/news`

Get forex news feed. Returns curated news items from in-file dataset (Reuters, Bloomberg, FX Street, Nikkei Asia).

**Response:**

```json
{
  "news": [NewsItem],
  "total": 20
}
```

**NewsItem object:**

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | News ID |
| `source` | `string` | Source name (Reuters, Bloomberg, etc.) |
| `title` | `string` | Headline |
| `summary` | `string \| null` | Summary text |
| `url` | `string \| null` | Source URL |
| `category` | `string \| null` | Category (Monetary Policy, Economic Data, etc.) |
| `impact` | `"high" \| "medium" \| "low" \| null` | Impact level |
| `currency` | `string \| null` | Related currency |
| `publishedAt` | `string \| null` | ISO 8601 timestamp |
| `createdAt` | `string` | ISO 8601 timestamp |

---

## 8. Backtest

### `POST /api/backtest`

Run a strategy backtest. Generates simulated results with realistic equity curves.

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `strategy` | `string` | Yes | Strategy name |
| `symbol` | `string` | Yes | Trading pair |
| `startDate` | `string` | No | ISO 8601 (defaults to 30 days ago) |
| `endDate` | `string` | No | ISO 8601 (defaults to now) |

**Response:**

```json
{
  "id": "bt-...",
  "name": "MA_Ribbon - EURUSD",
  "symbol": "EURUSD",
  "strategy": "MA_Ribbon",
  "startDate": "2025-07-08T...",
  "endDate": "2025-08-07T...",
  "initialBalance": 10000,
  "finalBalance": 11250.50,
  "totalTrades": 87,
  "winRate": 63.2,
  "profitFactor": 1.85,
  "maxDrawdown": 8.4,
  "sharpeRatio": 1.95,
  "totalProfit": 1500.50,
  "totalLoss": -250.00,
  "avgWin": 27.40,
  "avgLoss": -12.50,
  "equityCurve": [{ "trade": 1, "equity": 10025.00 }],
  "trades": [{ "trade": 1, "symbol": "EURUSD", "direction": "BUY", "entryPrice": 1.0845, "exitPrice": 1.0867, "pips": 22.0, "profit": 22.00, "lotSize": 0.1, "equity": 10022.00, "isWin": true }]
}
```

---

## 9. Seed

### `POST /api/seed`

Seed the database with demo data. Creates: 1 trading account, 1 risk settings, 20+ news items, 10 economic events, 30 indicator configs, 5 open trades, 15 closed trades, 5 backtest results.

**Request body:** None

**Response:**

```json
{
  "success": true,
  "message": "Database seeded successfully",
  "data": {
    "account": { "id": 1, "balance": 10000, "equity": 10000, "accountType": "demo" },
    "riskSettings": { "id": 1, "riskPerTrade": 0.5, "stopLossPips": 10, "takeProfitPips": 15 },
    "newsItems": 20,
    "economicEvents": 10,
    "indicatorConfigs": 30,
    "trades": 20,
    "backtestResults": 5
  }
}
```

---

## Supported Symbols

| Symbol | Name | Pip Size | Digits | Category |
|--------|------|----------|--------|----------|
| `EURUSD` | EUR/USD | 0.0001 | 5 | forex |
| `USDJPY` | USD/JPY | 0.01 | 3 | forex |
| `GBPUSD` | GBP/USD | 0.0001 | 5 | forex |
| `XAUUSD` | XAU/USD | 0.01 | 2 | metal |

---

## Error Format

All errors follow this structure:

```json
{
  "error": "Human-readable error message"
}
```