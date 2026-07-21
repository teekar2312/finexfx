# MT5 Bridge Service

Production bridge between the FinexFX AI Trading System (Next.js) and MetaTrader 5.

**Real trading only** — the mock adapter has been removed. This service always
connects to a real MT5 terminal via the Python bridge.

## Architecture

```
┌─────────────────────┐         ┌─────────────────────┐         ┌─────────────────────┐
│  Next.js App (3000) │  HTTP   │  MT5 Bridge (3050)  │  HTTP   │  Python Bridge      │
│  - src/lib/         │ ──────► │  - Node.js/TS       │ ──────► │  - mt5_bridge.py    │
│    mt5-client.ts    │         │  - RealPython adapter│        │  - MetaTrader5 pkg  │
│  - /api/trades/*    │         │  - Port 3050        │         │  - Windows + MT5    │
└─────────────────────┘         └─────────────────────┘         └─────────────────────┘
                                        │
                                        └─► Always uses RealPythonMT5Adapter
                                            (mock adapter removed — real trading only)
```

## Requirements

This bridge requires a **Windows machine** with:
- MetaTrader 5 terminal installed and logged in to your FINEX Indonesia account
- Python 3.10+
- `pip install MetaTrader5 flask flask-cors`

The Python script (`python/mt5_bridge.py`) runs as an HTTP service on the Windows
machine. The Node.js bridge (this service) calls it via HTTP.

**Real money trades are executed** — use with caution and test with small lots first.

## Deployment

### Step 1: Set up the Windows machine

1. Install MetaTrader 5 from your broker (FINEX Indonesia)
2. Log in to your trading account in the MT5 terminal
3. Install Python 3.10+ from python.org
4. Open Command Prompt:
   ```cmd
   pip install MetaTrader5 flask flask-cors
   ```

### Step 2: Copy the Python bridge

Copy `mini-services/mt5-bridge/python/mt5_bridge.py` to your Windows machine (e.g., `C:\finexfx\mt5_bridge.py`).

### Step 3: Run the Python bridge

```cmd
python C:\finexfx\mt5_bridge.py --port 5050 --host 0.0.0.0
```

This exposes the bridge on all network interfaces. Note the Windows machine's IP (e.g., `192.168.1.50`).

### Step 4: Configure the Node.js bridge

On the machine running the Next.js app + Node.js bridge, set environment variables:

```bash
# In the Next.js project .env file:
MT5_PYTHON_BRIDGE_URL=http://192.168.1.50:5050
MT5_BRIDGE_URL=http://localhost:3050
```

### Step 5: Start the Node.js bridge

```bash
cd mini-services/mt5-bridge
bun run dev   # starts on port 3050
```

Verify it's running and can reach the Python bridge:
```bash
curl http://localhost:3050/health
# → { "status": "ok", "adapter": "real-python", "isLive": true, ... }
```

### Step 6: Connect your MT5 account in the dashboard

Open the app → Settings → "MT5 Connection" tab → enter your MT5 login, server, and password → click "Connect to MT5".

## API Reference

### Health
```http
GET /health
→ { "status": "ok", "adapter": "real-python", "isLive": true, "uptime": 12.3, "timestamp": "..." }
```

### Connect / Disconnect
```http
POST /connect
Body: { "login": 12345678, "server": "FINEX-Live", "password": "xxx" }
→ { "account": { "login": 12345678, "balance": 10000, "equity": 10000, ... } }

POST /disconnect/12345678
→ { "ok": true }
```

### Account Info
```http
GET /account/12345678
→ { "account": { "login": 12345678, "balance": 10050.25, "equity": 10062.50, "margin": 100, ... } }
```

### Tick (current price)
```http
GET /tick/EURUSD
→ { "tick": { "symbol": "EURUSD", "bid": 1.08512, "ask": 1.08516, "spread": 0.00004, "time": "..." } }
```

### Historical Bars
```http
GET /bars/EURUSD?tf=M5&count=100
→ { "bars": [ { "time": "...", "open": 1.0850, "high": 1.0855, "low": 1.0848, "close": 1.0852, "volume": 245 }, ... ] }
```

### Open Positions
```http
GET /positions/12345678
→ { "positions": [ { "ticket": 500000001, "symbol": "EURUSD", "type": "buy", "volume": 0.10, ... } ] }
```

### Market Order (open trade)
```http
POST /order/market
Body: { "login": 12345678, "symbol": "EURUSD", "side": "buy", "volume": 0.10, "sl": 1.0840, "tp": 1.0870, "comment": "scalp-m5" }
→ { "order": { "ticket": 500000002, "symbol": "EURUSD", "price": 1.08516, "retcode": 10009, ... } }
```

### Close Position
```http
POST /position/500000002/close
→ { "result": { "ticket": 500000002, "price": 1.08555, "profit": 3.90, "retcode": 10009 } }
```

### Modify SL/TP
```http
POST /position/500000002/modify
Body: { "sl": 1.0845, "tp": 1.0880 }
→ { "result": { "ticket": 500000002, "sl": 1.0845, "tp": 1.0880, "retcode": 10009 } }
```

## Graceful Degradation

The Next.js app (`src/lib/mt5-client.ts`) handles bridge failures gracefully:

- **Bridge offline** → API routes that need prices (`/api/dashboard`, `/api/dashboard/aggregate`) return zeroed quotes (price=0) so the UI stays functional. Direct price endpoints (`/api/symbols`) return 500 with a clear error.
- **Bridge online, Python bridge unreachable** → same as offline (the Node.js bridge reports `ok: false`).
- **Bridge online, Python bridge reachable** → real MT5 orders are sent. The `mt5Ticket` field on the Trade record links to the broker's position ticket.

Trade operations (open, close, partial-close) require the bridge to be online — they throw clear errors if it's offline. There is no synthetic fallback.

## Security Notes

1. **The Python bridge has NO authentication.** Only run it on a trusted internal network, or put it behind a VPN.
2. **MT5 credentials are passed through the bridge.** The bridge does not store them — they're forwarded to `mt5.login()` and discarded.
3. **For production internet-facing deployments**, add an API key header check to both the Python bridge and the Node.js bridge.
4. **Real money is at stake** — test with small lot sizes (0.01) and verify all risk settings before scaling up.
