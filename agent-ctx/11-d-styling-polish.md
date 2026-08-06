# Task 11-d: Premium Styling Polish for TradingView.tsx & PriceChart.tsx

## Status: COMPLETE

## Changes Applied

### TradingView.tsx (CSS-only, no logic changes)
1. **Symbol selector pills** - `inset-highlight` on active pill (verified from 11-c)
2. **Buy/Sell buttons** - `card-press` on all 4 BUY/SELL buttons (verified from 11-c)
3. **Open trades list** - `table-row-hover` on open trade rows (verified from 11-c)
4. **History trades list** - `table-row-hover` added to closed trade rows (NEW - line 494)
5. **P&L summary bar** - `glow-pulse-emerald`/`glow-pulse-red` on Total P&L stat card (NEW - line 410)
6. **Quick trade info** - `text-label` on Risk Amount and Potential Profit labels (NEW - lines 701, 709)

### PriceChart.tsx (CSS-only, no logic changes)
1. **Chart container** - `inset-highlight` on main wrapper (NEW - line 251)
2. **Volume bars** - opacity transition style on VolumeShape rect (NEW - line 85)
3. **Current price line label** - `neon-text-emerald`/`neon-text-red` className on both mode labels (NEW - lines 321, 396)
4. **Timeframe buttons** - Skipped (no timeframe buttons present, per 'if any' condition)
5. **Loading state** - `shimmer-subtle` on loading container (NEW - line 229)

## Verification
- `bun run lint`: zero errors
- No functionality, logic, or data changes
