import 'server-only'
import { db } from './db'
import { closePosition, bridgeHealth } from './mt5-client'
import { logWarn, logError } from './logger'
import { sendWebhook } from './webhook'
import { bidAsk, calcPnl } from './market'
import { atomicCloseTrade } from './db-transactions'

export interface AutoCloseResult {
  closed: number
  failed: number
  skipped: number
}

interface ClosedTradeInfo {
  id: string
  symbol: string
  side: string
  lotSize: number
  closePrice: number
  pnl: number
  pips: number
  mt5Ticket: number | null
}

interface FailedTradeInfo {
  id: string
  symbol: string
  reason: string
}

/**
 * Auto-close all open positions — server-side utility for kill-switch,
 * daily session end, or circuit-breaker scenarios.
 *
 * @param accountId - If provided, only close trades for this account.
 *                    If omitted, closes open trades across ALL accounts.
 *
 * For each open trade:
 *   - With mt5Ticket → closes via MT5 bridge, then atomically updates DB.
 *   - Without mt5Ticket (local-only) → fetches live price and atomically updates DB.
 *
 * Logs each close action via logWarn. Sends a single webhook summary at the end.
 */
export async function autoCloseAllPositions(accountId?: string): Promise<AutoCloseResult> {
  const result: AutoCloseResult = { closed: 0, failed: 0, skipped: 0 }
  const closedTrades: ClosedTradeInfo[] = []
  const failedTrades: FailedTradeInfo[] = []
  let totalPnl = 0

  // Build the query — optionally filter by accountId
  const where: any = { status: 'open' }
  if (accountId) {
    where.accountId = accountId
  }

  // Fetch all open trades
  const openTrades = await db.trade.findMany({
    where,
    orderBy: { openTime: 'asc' },
  })

  if (openTrades.length === 0) {
    return result
  }

  // Check MT5 bridge health once (avoid repeated health checks per trade)
  const health = await bridgeHealth()
  const bridgeOnline = health.ok

  for (const trade of openTrades) {
    try {
      let closePrice: number
      let bridgePnl: number | null = null
      let bridgeUsed = false

      // ── MT5 bridge close (if ticket exists and bridge is online) ──────────
      if (trade.mt5Ticket && bridgeOnline) {
        try {
          const mt5Result = await closePosition(trade.mt5Ticket)
          closePrice = mt5Result.price
          bridgePnl = mt5Result.profit
          bridgeUsed = true
        } catch (e: any) {
          // Bridge close failed — fall back to live price
          await logWarn('mt5', `auto-close: MT5 bridge close failed for ticket ${trade.mt5Ticket}, falling back to live price`, {
            tradeId: trade.id,
            ticket: trade.mt5Ticket,
            error: e.message,
          })
          const { bid, ask } = await bidAsk(trade.symbol)
          closePrice = trade.side === 'buy' ? bid : ask
        }
      } else {
        // Local-only trade or bridge offline — use live price
        const { bid, ask } = await bidAsk(trade.symbol)
        closePrice = trade.side === 'buy' ? bid : ask
      }

      // Compute P&L
      const { pnl, pips } = calcPnl(
        trade.symbol,
        trade.side as 'buy' | 'sell',
        trade.lotSize,
        trade.openPrice,
        closePrice,
      )
      const grossPnl = bridgeUsed && bridgePnl != null ? bridgePnl : pnl
      const netPnl = Number((grossPnl - trade.commission - trade.swap).toFixed(2))

      // Atomically close the trade + update account balance
      const closeResult = await atomicCloseTrade(trade.id, {
        closePrice,
        pnl: netPnl,
        pips,
      })

      if (closeResult.alreadyClosed) {
        // Trade was closed by another process (SL/TP monitor, concurrent request)
        result.skipped++
        await logWarn('auto-close', `Trade ${trade.id} (${trade.symbol}) already closed by another process, skipped`)
        continue
      }

      // Log the close action
      await logWarn('auto-close', `Closed ${trade.side} ${trade.lotSize} ${trade.symbol} @ ${closePrice} pnl=$${netPnl}${bridgeUsed ? ' [MT5]' : ' [local]'}${trade.mt5Ticket && !bridgeUsed ? ' [MT5-ticket but bridge offline, used live price]' : ''}`, {
        tradeId: trade.id,
        accountId: trade.accountId,
        mt5Ticket: trade.mt5Ticket,
        closePrice,
        pnl: netPnl,
        pips,
        bridgeUsed,
      })

      result.closed++
      totalPnl += netPnl
      closedTrades.push({
        id: trade.id,
        symbol: trade.symbol,
        side: trade.side,
        lotSize: trade.lotSize,
        closePrice,
        pnl: netPnl,
        pips,
        mt5Ticket: trade.mt5Ticket,
      })
    } catch (e: any) {
      result.failed++
      failedTrades.push({
        id: trade.id,
        symbol: trade.symbol,
        reason: e.message,
      })
      await logError('auto-close', `Failed to close trade ${trade.id} (${trade.symbol}): ${e.message}`, e.stack, {
        tradeId: trade.id,
        accountId: trade.accountId,
        mt5Ticket: trade.mt5Ticket,
      })
    }
  }

  // ── Send a single webhook notification summarizing all closes ───────────
  if (closedTrades.length > 0 || failedTrades.length > 0) {
    const scopeLabel = accountId ? `account ${accountId.slice(-6)}` : 'all accounts'

    await sendWebhook({
      type: 'risk',
      title: `Auto-Close: ${closedTrades.length} position(s) closed`,
      message: `Automatic close executed across ${scopeLabel}.\nClosed: ${closedTrades.length}\nFailed: ${failedTrades.length}\nSkipped: ${result.skipped}\nTotal P&L: $${totalPnl.toFixed(2)}`,
      color: totalPnl >= 0 ? 0x10b981 : 0xef4444,
      fields: [
        { name: 'Scope', value: scopeLabel },
        { name: 'Closed', value: String(closedTrades.length) },
        { name: 'Failed', value: String(failedTrades.length) },
        { name: 'Skipped', value: String(result.skipped) },
        { name: 'Total P&L', value: `$${totalPnl.toFixed(2)}` },
        ...(failedTrades.length > 0
          ? [{ name: 'Failures', value: failedTrades.map((f) => `${f.symbol}: ${f.reason}`).join(', ') }]
          : []),
      ],
    }).catch(() => null)
  }

  return result
}