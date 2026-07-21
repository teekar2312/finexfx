// Paper trading mode — simulates trades using real price data without executing on MT5.
// All paper trades are stored in the DB with source='paper' so they can be
// filtered and identified separately from live trades.
//
// Enable via env: PAPER_TRADING=true

import 'server-only'
import { db } from './db'
import { priceAt } from './market'
import { calcPnl } from './market-math'
import { logInfo } from './logger'

// ─────────────────────────────────────────────────────────────────────────────
// Paper mode check
// ─────────────────────────────────────────────────────────────────────────────

/** Returns true when PAPER_TRADING=true is set in environment variables. */
export function isPaperMode(): boolean {
  return process.env.PAPER_TRADING === 'true'
}

// ─────────────────────────────────────────────────────────────────────────────
// Paper trade open
// ─────────────────────────────────────────────────────────────────────────────

interface PaperOpenParams {
  accountId: string
  symbol: string
  side: 'buy' | 'sell'
  lotSize: number
  stopLoss?: number | null
  takeProfit?: number | null
  trailingStop?: boolean
  trailingPips?: number
  strategy?: string
  timeframe?: string
  comment?: string
}

/**
 * Open a paper trade — creates a DB record with source='paper' but does NOT
 * call the MT5 bridge. Uses the live mid-price from `priceAt` as the open price.
 */
export async function paperOpenTrade(params: PaperOpenParams) {
  const {
    accountId,
    symbol,
    side,
    lotSize,
    stopLoss = null,
    takeProfit = null,
    trailingStop = false,
    trailingPips = 0,
    strategy = 'scalping-m5',
    timeframe = 'M5',
    comment = null,
  } = params

  // Fetch real-time price from the MT5 bridge (same feed, no order execution)
  const openPrice = await priceAt(symbol)

  // Round-turn commission: $2.5/lot x 2 sides
  const commission = Number((lotSize * 2.5 * 2).toFixed(2))

  const trade = await db.trade.create({
    data: {
      accountId,
      symbol,
      side,
      lotSize,
      openPrice,
      closePrice: null,
      stopLoss: stopLoss != null ? Number(stopLoss) : null,
      takeProfit: takeProfit != null ? Number(takeProfit) : null,
      trailingStop,
      trailingPips: Number(trailingPips),
      status: 'open',
      pnl: 0,
      pips: 0,
      commission,
      swap: 0,
      strategy,
      timeframe,
      source: 'paper',
      comment,
      mt5Ticket: null,
      mt5Server: null,
      openTime: new Date(),
      closeTime: null,
    },
  })

  await logInfo('system', `Paper trade opened ${side} ${lotSize} ${symbol} @ ${openPrice}`, {
    tradeId: trade.id,
    accountId,
    symbol,
    side,
    lotSize,
    openPrice,
    stopLoss: trade.stopLoss,
    takeProfit: trade.takeProfit,
  })

  return trade
}

// ─────────────────────────────────────────────────────────────────────────────
// Paper trade close
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Close a paper trade — calculates P&L using `calcPnl`, updates the DB record
 * with close price, close time, P&L, pips, and sets status='closed'.
 * Does NOT call the MT5 bridge or update the account balance (paper trades
 * don't affect real equity).
 */
export async function paperCloseTrade(tradeId: string) {
  const trade = await db.trade.findUnique({ where: { id: tradeId } })

  if (!trade) {
    throw new Error(`Paper trade ${tradeId} not found`)
  }

  if (trade.status !== 'open') {
    throw new Error(`Paper trade ${tradeId} is not open (status: ${trade.status})`)
  }

  if (trade.source !== 'paper') {
    throw new Error(`Trade ${tradeId} is not a paper trade (source: ${trade.source})`)
  }

  // Fetch current live price for the close
  const closePrice = await priceAt(trade.symbol)

  const { pnl: grossPnl, pips } = calcPnl(
    trade.symbol,
    trade.side as 'buy' | 'sell',
    trade.lotSize,
    trade.openPrice,
    closePrice,
  )

  // Net P&L after commission and swap
  const netPnl = Number((grossPnl - trade.commission - trade.swap).toFixed(2))

  const updated = await db.trade.update({
    where: { id: tradeId },
    data: {
      closePrice,
      closeTime: new Date(),
      pnl: netPnl,
      pips,
      status: 'closed',
    },
  })

  await logInfo('system', `Paper trade closed ${trade.side} ${trade.lotSize} ${trade.symbol} @ ${closePrice} pnl=${netPnl} (${pips} pips)`, {
    tradeId,
    accountId: trade.accountId,
    openPrice: trade.openPrice,
    closePrice,
    grossPnl,
    commission: trade.commission,
    swap: trade.swap,
    netPnl,
    pips,
  })

  return updated
}

// ─────────────────────────────────────────────────────────────────────────────
// Paper trade SL/TP modification
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Modify the stop-loss and/or take-profit on an open paper trade.
 * Does NOT call the MT5 bridge.
 */
export async function paperModifySLTP(
  tradeId: string,
  sl: number | null,
  tp: number | null,
) {
  const trade = await db.trade.findUnique({ where: { id: tradeId } })

  if (!trade) {
    throw new Error(`Paper trade ${tradeId} not found`)
  }

  if (trade.status !== 'open') {
    throw new Error(`Paper trade ${tradeId} is not open (status: ${trade.status})`)
  }

  if (trade.source !== 'paper') {
    throw new Error(`Trade ${tradeId} is not a paper trade (source: ${trade.source})`)
  }

  const updated = await db.trade.update({
    where: { id: tradeId },
    data: {
      stopLoss: sl != null ? Number(sl) : null,
      takeProfit: tp != null ? Number(tp) : null,
    },
  })

  await logInfo('system', `Paper trade SL/TP modified: ${trade.symbol} SL=${sl} TP=${tp}`, {
    tradeId,
    accountId: trade.accountId,
    symbol: trade.symbol,
    previousSL: trade.stopLoss,
    previousTP: trade.takeProfit,
    newSL: sl,
    newTP: tp,
  })

  return updated
}

// ─────────────────────────────────────────────────────────────────────────────
// Paper trading stats
// ─────────────────────────────────────────────────────────────────────────────

interface PaperStats {
  openCount: number
  todayPnl: number
  totalTrades: number
}

/**
 * Returns aggregate paper trading statistics:
 *   - openCount:  number of currently open paper trades
 *   - todayPnl:   net P&L of paper trades closed today
 *   - totalTrades: total number of paper trades (open + closed)
 */
export async function getPaperStats(): Promise<PaperStats> {
  // Start of today (UTC midnight)
  const todayStart = new Date()
  todayStart.setUTCHours(0, 0, 0, 0)

  const [openCount, todayClosed, totalCount] = await Promise.all([
    db.trade.count({
      where: { source: 'paper', status: 'open' },
    }),
    db.trade.findMany({
      where: {
        source: 'paper',
        status: 'closed',
        closeTime: { gte: todayStart },
      },
      select: { pnl: true },
    }),
    db.trade.count({
      where: { source: 'paper' },
    }),
  ])

  const todayPnl = Number(
    todayClosed.reduce((sum, t) => sum + (t.pnl ?? 0), 0).toFixed(2),
  )

  return {
    openCount,
    todayPnl,
    totalTrades: totalCount,
  }
}