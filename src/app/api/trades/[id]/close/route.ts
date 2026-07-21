import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { logInfo } from '@/lib/logger'
import { sendNotification } from '@/lib/logger'
import { sendWebhook } from '@/lib/webhook'
import { bidAsk, calcPnl } from '@/lib/market'
import { closePosition as mt5ClosePosition } from '@/lib/mt5-client'
import { atomicCloseTrade } from '@/lib/db-transactions'
import { requireTrader } from '@/lib/auth-server'
import { auditLog } from '@/lib/audit'
import { canAccessTrade } from '@/lib/ownership'

export const dynamic = 'force-dynamic'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // Role guard: only trader+ can close trades
  const user = await requireTrader()
  if (user instanceof NextResponse) return user

  try {
    const { id } = await params
    const trade = await db.trade.findUnique({ where: { id }, include: { account: true } })
    if (!trade) {
      return NextResponse.json({ error: 'Trade not found' }, { status: 404 })
    }
    // P3: IDOR protection — check ownership
    if (!canAccessTrade(user, trade.account?.userId ?? null)) {
      return NextResponse.json({ error: 'Forbidden — not your trade' }, { status: 403 })
    }
    if (trade.status !== 'open') {
      return NextResponse.json({ error: 'Trade already closed' }, { status: 400 })
    }

    // ─── MT5 Bridge integration ──────────────────────────────────────────────
    // If this trade has an MT5 ticket, close it via the bridge to get the real
    // fill price + realized P&L. Falls back to live bridge price on failure.
    let closePrice: number
    let bridgePnl: number | null = null
    let bridgeUsed = false

    if (trade.mt5Ticket) {
      try {
        const result = await mt5ClosePosition(trade.mt5Ticket)
        closePrice = result.price
        bridgePnl = result.profit
        bridgeUsed = true
        await logInfo('mt5', `MT5 bridge close: ticket=${trade.mt5Ticket} @ ${closePrice} pnl=${bridgePnl}`, {
          tradeId: id,
        })
      } catch (e: any) {
        await logInfo('mt5', `MT5 bridge close failed, using synthetic: ${e.message}`, { tradeId: id })
        const { bid, ask } = await bidAsk(trade.symbol)
        closePrice = trade.side === 'buy' ? bid : ask
      }
    } else {
      const { bid, ask } = await bidAsk(trade.symbol)
      closePrice = trade.side === 'buy' ? bid : ask
    }

    const { pnl, pips } = calcPnl(
      trade.symbol,
      trade.side as 'buy' | 'sell',
      trade.lotSize,
      trade.openPrice,
      closePrice,
    )

    // Use bridge P&L if available (more accurate — includes slippage), else local calc
    const grossPnl = bridgeUsed && bridgePnl != null ? bridgePnl : pnl
    const netPnl = Number((grossPnl - trade.commission - trade.swap).toFixed(2))

    // ─── Atomic close (race-condition safe) ──────────────────────────────────
    // Uses conditional update (WHERE status='open') inside a transaction.
    // If SL/TP monitor closed this trade simultaneously, this returns
    // alreadyClosed=true and we respond gracefully without double-updating balance.
    const result = await atomicCloseTrade(id, {
      closePrice,
      pnl: netPnl,
      pips,
    })

    if (result.alreadyClosed) {
      return NextResponse.json(
        { error: 'Trade was already closed by another process (SL/TP monitor or concurrent request)' },
        { status: 409 }, // 409 Conflict
      )
    }

    const updated = result.trade
    const account = result.account

    await logInfo(
      'mt5',
      `Trade closed ${trade.side} ${trade.lotSize} ${trade.symbol} @ ${closePrice} pnl=${netPnl} (${pips} pips)${bridgeUsed ? ` [MT5]` : ' [live]'}`,
      { tradeId: id, accountId: trade.accountId, mt5Ticket: trade.mt5Ticket },
    )

    await sendNotification(
      'trade_close',
      `Position closed: ${trade.side.toUpperCase()} ${trade.lotSize} ${trade.symbol}`,
      `Trade #${id} closed at ${closePrice}. PnL=$${netPnl} (${pips} pips). Commission=$${trade.commission}.`,
      account ? `trader@${account.broker.toLowerCase().replace(/\s+/g, '')}.com` : 'trader@finex.com',
    ).catch(() => null)

    // Webhook notification (Discord/Telegram/Slack)
    await sendWebhook({
      type: 'trade_close',
      title: `${netPnl >= 0 ? '✅' : '🔴'} Position Closed: ${trade.side.toUpperCase()} ${trade.lotSize} ${trade.symbol}`,
      message: `Closed at ${closePrice}. P&L = $${netPnl} (${pips} pips)`,
      color: netPnl >= 0 ? 0x10b981 : 0xef4444,
      fields: [
        { name: 'Symbol', value: trade.symbol },
        { name: 'Side', value: trade.side.toUpperCase() },
        { name: 'Close Price', value: String(closePrice) },
        { name: 'P&L', value: `$${netPnl}` },
        { name: 'Pips', value: `${pips}` },
        { name: 'Commission', value: `$${trade.commission}` },
      ],
    }).catch(() => null)

    await auditLog(user, { action: 'trade.close', entityType: 'trade', entityId: id, metadata: { pnl: updated.pnl, pips: updated.pips, closePrice: updated.closePrice } })
    return NextResponse.json({ trade: updated })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
