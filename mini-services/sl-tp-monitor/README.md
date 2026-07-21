# SL/TP Monitor Service

Background polling worker that runs independently of the browser. Ensures
critical trading operations continue even when the dashboard tab is closed.

## What It Does

This service performs 4 jobs on fixed schedules:

| Job | Interval | Endpoint | Description |
|---|---|---|---|
| **SL/TP Check** | 5s | `POST /api/trades/check-sl-tp` | Auto-close trades that hit stop-loss or take-profit. Apply trailing stop adjustments. |
| **Position Reconciliation** | 30s | `POST /api/mt5/reconcile` | Sync local Trade records with MT5 bridge positions. Detect trades closed externally on MT5 (e.g., SL hit on broker side) and update local DB. |
| **AI Signal Evaluation** | 5min | `POST /api/ai/evaluate` | Evaluate pending AI signals — compare predicted direction with actual price movement. Updates accuracy tracking. |
| **Database Backup** | 1hour | `POST /api/system/backup` | Create a timestamped copy of the SQLite database. Keeps last 24 backups. |

## Why It Exists

Without this service:
- Stop-loss and take-profit would only trigger when the dashboard tab is open
- If you close the browser, SL/TP wouldn't execute until you reopen it
- MT5 positions closed externally (manually on the terminal) wouldn't sync to the local DB
- AI signal accuracy tracking would lag behind
- Database backups wouldn't happen automatically

This service ensures monitoring continues 24/7 as long as the server is running.

## Running

```bash
cd mini-services/sl-tp-monitor
bun run dev   # starts polling (no port — this is a worker, not a server)
```

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `API_BASE` | `http://localhost:3000` | URL of the Next.js app (must be running) |

## Requirements

- The Next.js app must be running (this service polls its API routes)
- The MT5 bridge must be online for SL/TP checks and reconciliation (they fetch live prices)
- The database must be accessible for backup operations

## Logs

The service logs each job execution to stdout:
```
[sl-tp-monitor] SL/TP check: closed 2 trades, trailing adjusted 1
[sl-tp-monitor] Reconcile: 0 orphaned, 0 closed externally
[sl-tp-monitor] AI evaluate: 3 evaluated, 2 correct, 1 wrong
[sl-tp-monitor] Backup created: custom-20260708-123456.db (2.3 MB)
```

## Graceful Degradation

- If the Next.js app is down → polls fail silently, retries on next interval
- If the MT5 bridge is offline → SL/TP checks skip (can't fetch live prices), reconciliation skips
- If the database is locked → backup fails, retries next hour
- AI evaluation continues even if bridge is offline (uses stored `priceAtSignal` from DB)
