// Pure math functions for trading calculations.
// These are shared between client and server — no I/O, no server-only guard.
// Importable from Client Components (e.g. dashboard-panel.tsx needs calcPnl
// for inline P&L display).

import { SYMBOL_BASE } from './types'

/**
 * P&L in account currency for a position.
 * For quote-currency pairs (XXX/USD) pnl = (exit-entry) * sideMultiplier * lot * contractSize.
 * USDJPY handled by dividing by exit. XAUUSD contract 100oz.
 */
export function calcPnl(
  symbol: string,
  side: 'buy' | 'sell',
  lot: number,
  openPrice: number,
  closePrice: number,
): { pnl: number; pips: number } {
  const base = SYMBOL_BASE[symbol]
  const dir = side === 'buy' ? 1 : -1
  const diff = (closePrice - openPrice) * dir
  const pips = diff / base.pip
  let valuePerPip: number
  if (symbol === 'USDJPY') {
    valuePerPip = (lot * 100000 * base.pip) / closePrice
  } else if (symbol === 'XAUUSD') {
    valuePerPip = lot * 100 * base.pip
  } else {
    valuePerPip = lot * 100000 * base.pip
  }
  const pnl = pips * valuePerPip
  return { pnl: Number(pnl.toFixed(2)), pips: Number(pips.toFixed(1)) }
}

/**
 * Lot size from risk % of balance, stop-loss pips, and value-per-pip.
 * lot = riskAmount / (slPips * valuePerPipPerLot)
 *
 * @param currentPrice  Live price — REQUIRED for USDJPY (vpp is price-dependent).
 *                       For other pairs it's ignored.
 */
export function calcLotSize(
  symbol: string,
  balance: number,
  riskPct: number,
  slPips: number,
  currentPrice?: number,
): number {
  const base = SYMBOL_BASE[symbol]
  const riskAmount = balance * (riskPct / 100)
  let valuePerPipPerLot: number
  // USDJPY vpp depends on current price: vpp = (100000 * 0.01) / price
  const refPrice = (symbol === 'USDJPY' && currentPrice) ? currentPrice : base.price
  if (symbol === 'USDJPY') {
    valuePerPipPerLot = (100000 * base.pip) / refPrice
  } else if (symbol === 'XAUUSD') {
    valuePerPipPerLot = 100 * base.pip
  } else {
    valuePerPipPerLot = 100000 * base.pip
  }
  const lot = riskAmount / (slPips * valuePerPipPerLot)
  return Number(Math.max(0.01, Math.floor(lot * 100) / 100).toFixed(2))
}
