# Price-Feed WebSocket Service

Real-time price tick broadcaster for the FinexFX AI Trading dashboard.

**Real trading only** — fetches live prices from the MT5 bridge. No simulation.

## Architecture

```
┌─────────────────────┐         ┌─────────────────────┐         ┌─────────────────────┐
│  Browser Dashboard  │  WS     │  Price-Feed (3003)  │  HTTP   │  MT5 Bridge (3050)  │
│  - socket.io client │ ◄──────► │  - Polls bridge     │ ──────► │  - Real MT5 prices  │
│  - Live tick charts │         │  - Broadcasts ticks │         │  - Via Python bridge│
└─────────────────────┘         └─────────────────────┘         └─────────────────────┘
```

## How It Works

1. Every 1 second, the service fetches live ticks for all 4 symbols (EURUSD, USDJPY, GBPUSD, XAUUSD) from the MT5 bridge via HTTP (`GET /tick/{symbol}`)
2. Also fetches M1 bars (for sparkline) and H1 bars (for 24h change %) in parallel
3. Broadcasts the aggregated snapshot to all connected dashboard clients via socket.io
4. Emits system status (trading sessions, scalping window) every 15 seconds

## Running

```bash
cd mini-services/price-feed
bun run dev   # starts on port 3003
```

The service is self-contained (no imports from `src/lib`) and runs as a standalone process.

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `MT5_BRIDGE_URL` | `http://localhost:3050` | URL of the mt5-bridge mini-service |

## Socket.io Events

### Server → Client

| Event | Payload | Description |
|---|---|---|
| `welcome` | `{ connected, symbols, ts }` | Sent on connection — initial snapshot |
| `tick` | `{ symbols: SymbolQuote[], ts }` | Broadcast every 1s — live price updates |
| `system-status` | `{ sessions, scalpingWindow, uptime, connectedClients, ts }` | Broadcast every 15s |

### Client → Server

| Event | Payload | Description |
|---|---|---|
| `subscribe` | any | Ack — client subscribes to tick stream |
| `alert-check` | `{ symbol?, price?, condition? }` | Returns current price for alert evaluation |

## SymbolQuote Shape

```typescript
interface SymbolQuote {
  symbol: string         // 'EURUSD' | 'USDJPY' | 'GBPUSD' | 'XAUUSD'
  price: number          // mid price
  bid: number
  ask: number
  spread: number
  changePct: number      // 24h % change
  spark: number[]        // 40 M1 close prices
  updatedAt: number      // epoch ms
}
```

## Graceful Degradation

When the MT5 bridge is offline or a symbol is unavailable, the service returns
**zeroed quotes** (price=0, bid=0, ask=0, spark=[0,...]) instead of crashing.
The dashboard displays "no data" for affected symbols.

## Removed Features

The following demo features have been removed (real trading mode):
- ❌ Simulated trade events (every 25s)
- ❌ Simulated AI signals (every 40s)
- ❌ Simulated news events (every 60s)
- ❌ Deterministic price simulation formula

Real trade history, AI signals, and news come from the Next.js API routes
(which read from the database), not from this WebSocket service. This service
only broadcasts live price ticks.
