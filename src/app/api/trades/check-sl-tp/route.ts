import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { bidAsk, calcPnl } from '@/lib/market'
import { closePosition, modifyPosition } from '@/lib/mt5-client'
import { logInfo, logWarn, sendNotification } from '@/lib/logger'
import { sendWebhook } from '@/lib/webhook'
import { atomicCloseTrade } from '@/lib/db-transactions'
import { requireAuth } from '@/lib/auth-server'

export const dynamic = 'force-dynamic'

// POST /api/trades/check-sl-tp
// Checks all open trades against current market prices. Closes any that hit
// stop-loss or take-profit. Also applies trailing stop adjustments.
//
// This endpoint is called by the SL/TP monitor background service (which
// authenticates via X-Service-Key header). It requires auth to prevent
// anonymous attackers from triggering mass trade closes.
export async function POST() {
  const user = await requireAuth()
  if (user instanceof NextResponse) return user

  const closed: any[] = []
  const trailed: any[] = []
  const skipped: any[] = []

  try {
    const openTrades = await db.trade.findMany({
      where: { status: 'open' },
      include: { account: true },
    })

    if (openTrades.length === 0) {
      return NextResponse.json({ closed: [], trailed: [], skipped: [], checked: 0 })
    }

    for (const trade of openTrades) {
      const { bid, ask } = await bidAsk(trade.symbol)
      const currentPrice = trade.side === 'buy' ? bid : ask

      // ── Trailing stop: move SL as price moves favorably ──
      if (trade.trailingStop && trade.stopLoss) {
        const pip = trade.symbol === 'USDJPY' ? 0.01 : trade.symbol === 'XAUUSD' ? 0.1 : 0.0001
        const trailDist = trade.trailingPips * pip
        let newSl: number | null = null

        if (trade.side === 'buy') {
          newSl = currentPrice - trailDist
          // Only move SL up (never down)
          if (newSl > trade.stopLoss) {
            const roundedSl = Number(newSl.toFixed(5))
            await db.trade.update({ where: { id: trade.id }, data: { stopLoss: roundedSl } })
            trailed.push({ id: trade.id, symbol: trade.symbol, side: trade.side, oldSl: trade.stopLoss, newSl: roundedSl })
            // Sync trailing stop to MT5
            if (trade.mt5Ticket) {
              try {
                await modifyPosition(trade.mt5Ticket, roundedSl, trade.takeProfit)
              } catch (e: any) {
                await logWarn('mt5', `Trailing stop MT5 sync failed (trade ${trade.id}): ${e.message}`)
              }
            }
          }
        } else {
          newSl = currentPrice + trailDist
          // Only move SL down (never up) for sells
          if (newSl < trade.stopLoss) {
            const roundedSl = Number(newSl.toFixed(5))
            await db.trade.update({ where: { id: trade.id }, data: { stopLoss: roundedSl } })
            trailed.push({ id: trade.id, symbol: trade.symbol, side: trade.side, oldSl: trade.stopLoss, newSl: roundedSl })
            // Sync trailing stop to MT5
            if (trade.mt5Ticket) {
              try {
                await modifyPosition(trade.mt5Ticket, roundedSl, trade.takeProfit)
              } catch (e: any) {
                await logWarn('mt5', `Trailing stop MT5 sync failed (trade ${trade.id}): ${e.message}`)
              }
            }
          }
        }
      }

      // ── Check SL/TP hit ──
      let hitSl = false
      let hitTp = false

      if (trade.stopLoss) {
        if (trade.side === 'buy' && currentPrice <= trade.stopLoss) hitSl = true
        if (trade.side === 'sell' && currentPrice >= trade.stopLoss) hitSl = true
      }
      if (trade.takeProfit) {
        if (trade.side === 'buy' && currentPrice >= trade.takeProfit) hitTp = true
        if (trade.side === 'sell' && currentPrice <= trade.takeProfit) hitTp = true
      }

      if (hitSl || hitTp) {
        const closePrice = hitSl ? trade.stopLoss! : trade.takeProfit!
        const { pnl, pips } = calcPnl(trade.symbol, trade.side as 'buy' | 'sell', trade.lotSize, trade.openPrice, closePrice)
        const netPnl = Number((pnl - trade.commission - trade.swap).toFixed(2))

        // ─── Close MT5 position first (if trade has mt5Ticket) ──────────────
        // This ensures the broker position is closed at the real market price
        // before we update the local DB. If bridge is offline or close fails,
        // we still close locally (local DB reflects intended state).
        let mt5AlreadyClosed = false
        if (trade.mt5Ticket) {
          try {
            await closePosition(trade.mt5Ticket)
          } catch (e: any) {
            const msg = String(e.message)
            // 404 = position already closed by MT5/broker externally — expected
            if (msg.includes('404') || msg.includes('not found')) {
              mt5AlreadyClosed = true
              await logInfo('mt5', `Position already closed on MT5 (trade ${trade.id}, ticket ${trade.mt5Ticket}). Reconciling locally.`, {
                tradeId: trade.id, mt5Ticket: trade.mt5Ticket, reason: hitSl ? 'SL' : 'TP',
              })
            } else {
              await logWarn('mt5', `MT5 closePosition failed for SL/TP close (trade ${trade.id}, ticket ${trade.mt5Ticket}): ${msg}`, {
                tradeId: trade.id, mt5Ticket: trade.mt5Ticket, reason: hitSl ? 'SL' : 'TP',
              })
            }
          }
        }

        // ─── Atomic close (race-condition safe) ──────────────────────────────
        // Uses conditional update (WHERE status='open') inside a transaction.
        // If manual close happened between fetch and update, this returns
        // alreadyClosed=true and we skip without double-updating balance.
        const result = await atomicCloseTrade(trade.id, {
          closePrice,
          pnl: netPnl,
          pips,
        })

        if (result.alreadyClosed) {
          // Trade was closed by another process (manual close or another SL/TP check)
          // — skip it gracefully, don't double-update balance.
          skipped.push({
            id: trade.id,
            symbol: trade.symbol,
            reason: 'already closed by another process',
          })
          continue
        }

        const reason = hitSl ? 'Stop Loss' : 'Take Profit'
        if (mt5AlreadyClosed) {
          await logInfo('mt5', `Reconciled: ${trade.symbol} ${trade.side} closed on MT5 externally (${reason}). Local DB updated.`, {
            tradeId: trade.id, mt5Ticket: trade.mt5Ticket, closePrice, pnl: netPnl,
          })
        } else {
          await logInfo('mt5', `Trade closed (${reason}): ${trade.symbol} ${trade.side} ${trade.lotSize} @ ${closePrice} | P&L ${netPnl.toFixed(2)}`)
        }

        await sendNotification(
          'trade_close',
          `${hitSl ? '🛑 SL Hit' : '🎯 TP Hit'}: ${trade.symbol} ${trade.side.toUpperCase()}`,
          `Trade ${trade.symbol} ${trade.side.toUpperCase()} ${trade.lotSize} lots ditutup di ${reason}.\nOpen: ${trade.openPrice}\nClose: ${closePrice}\nPips: ${pips}\nP&L: $${netPnl.toFixed(2)}\n\nReason: ${reason}`,
          'trader@example.com',
        )

        // Webhook notification (Discord/Telegram/Slack)
        await sendWebhook({
          type: 'trade_close',
          title: `${hitSl ? '🛑 SL Hit' : '🎯 TP Hit'}: ${trade.symbol} ${trade.side.toUpperCase()}`,
          message: `Closed at ${closePrice} (${reason}). P&L = $${netPnl.toFixed(2)} (${pips} pips)`,
          color: hitSl ? 0xef4444 : 0x10b981,
          fields: [
            { name: 'Symbol', value: trade.symbol },
            { name: 'Side', value: trade.side.toUpperCase() },
            { name: 'Lot', value: String(trade.lotSize) },
            { name: 'Open', value: String(trade.openPrice) },
            { name: 'Close', value: String(closePrice) },
            { name: 'Reason', value: reason },
            { name: 'Pips', value: String(pips) },
            { name: 'P&L', value: `$${netPnl.toFixed(2)}` },
          ],
        }).catch(() => null)

        closed.push({
          id: trade.id,
          symbol: trade.symbol,
          side: trade.side,
          reason,
          closePrice,
          pnl: netPnl,
          pips,
        })
      }
    }

    return NextResponse.json({
      closed,
      trailed,
      skipped,
      checked: openTrades.length,
    })
  } catch (e: any) {
    console.error('POST /api/trades/check-sl-tp error', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
