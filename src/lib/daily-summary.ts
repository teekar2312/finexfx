import 'server-only'
import { db } from './db'
import { sendWebhook } from './webhook'
import { logInfo, logError } from './logger'

export interface PairBreakdown {
  symbol: string
  count: number
  winCount: number
  totalPnl: number
  winRate: number
}

export interface DailySummaryData {
  date: string
  totalTrades: number
  winCount: number
  lossCount: number
  winRate: number
  totalPnl: number
  bestTrade: { id: string; symbol: string; side: string; pnl: number; pips: number } | null
  worstTrade: { id: string; symbol: string; side: string; pnl: number; pips: number } | null
  byPair: PairBreakdown[]
  message: string
}

/**
 * Generate and send a daily P&L summary.
 *
 * Queries all trades closed today from the DB, computes aggregate stats
 * (total P&L, win rate, best/worst trade, per-pair breakdown), formats
 * a human-readable summary, sends it via webhook, and saves a notification
 * record in the DB.
 *
 * Returns the summary data object for programmatic use.
 */
export async function generateDailySummary(): Promise<DailySummaryData> {
  const today = new Date()
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const dateLabel = startOfDay.toISOString().slice(0, 10)

  // Default empty summary
  const emptySummary: DailySummaryData = {
    date: dateLabel,
    totalTrades: 0,
    winCount: 0,
    lossCount: 0,
    winRate: 0,
    totalPnl: 0,
    bestTrade: null,
    worstTrade: null,
    byPair: [],
    message: `No trades closed on ${dateLabel}.`,
  }

  try {
    // Query all trades closed today
    const closedTrades = await db.trade.findMany({
      where: {
        status: 'closed',
        closeTime: { gte: startOfDay },
      },
      orderBy: { closeTime: 'desc' },
    })

    if (closedTrades.length === 0) {
      await logInfo('system', `Daily summary: no trades closed on ${dateLabel}`)

      // Still send a webhook so the daily schedule is visible
      await sendWebhook({
        type: 'system',
        title: `Daily Summary — ${dateLabel}`,
        message: emptySummary.message,
        fields: [
          { name: 'Date', value: dateLabel },
          { name: 'Trades', value: '0' },
        ],
        color: 0x6366f1,
      }).catch(() => null)

      // Save notification record
      await db.notification.create({
        data: {
          type: 'system',
          subject: `Daily Summary — ${dateLabel}`,
          body: emptySummary.message,
          recipient: 'system',
          sent: true,
          sentAt: new Date(),
        },
      }).catch(() => null)

      return emptySummary
    }

    // ── Compute aggregate stats ──────────────────────────────────────────────
    let totalPnl = 0
    let winCount = 0
    let lossCount = 0
    let bestTrade: { id: string; symbol: string; side: string; pnl: number; pips: number } | null = null
    let worstTrade: { id: string; symbol: string; side: string; pnl: number; pips: number } | null = null

    // Per-pair accumulator
    const pairMap: Record<string, { count: number; winCount: number; totalPnl: number }> = {}

    for (const trade of closedTrades) {
      const pnl = Number(trade.pnl) || 0
      const pips = Number(trade.pips) || 0
      totalPnl += pnl

      if (pnl > 0) {
        winCount++
      } else if (pnl < 0) {
        lossCount++
      }

      // Track best/worst
      if (!bestTrade || pnl > bestTrade.pnl) {
        bestTrade = { id: trade.id, symbol: trade.symbol, side: trade.side, pnl, pips }
      }
      if (!worstTrade || pnl < worstTrade.pnl) {
        worstTrade = { id: trade.id, symbol: trade.symbol, side: trade.side, pnl, pips }
      }

      // Pair breakdown
      if (!pairMap[trade.symbol]) {
        pairMap[trade.symbol] = { count: 0, winCount: 0, totalPnl: 0 }
      }
      pairMap[trade.symbol].count++
      pairMap[trade.symbol].totalPnl += pnl
      if (pnl > 0) pairMap[trade.symbol].winCount++
    }

    const totalTrades = closedTrades.length
    const winRate = totalTrades > 0 ? Number(((winCount / totalTrades) * 100).toFixed(1)) : 0
    const breakevenCount = totalTrades - winCount - lossCount

    // Build sorted pair breakdown
    const byPair: PairBreakdown[] = Object.entries(pairMap)
      .map(([symbol, data]) => ({
        symbol,
        count: data.count,
        winCount: data.winCount,
        totalPnl: Number(data.totalPnl.toFixed(2)),
        winRate: data.count > 0 ? Number(((data.winCount / data.count) * 100).toFixed(1)) : 0,
      }))
      .sort((a, b) => b.totalPnl - a.totalPnl)

    // ── Format the summary message ───────────────────────────────────────────
    const pnlSign = totalPnl >= 0 ? '+' : ''
    const emoji = totalPnl >= 0 ? '📈' : '📉'

    let message = `${emoji} Daily P&L Summary — ${dateLabel}\n\n`
    message += `Total P&L: ${pnlSign}$${totalPnl.toFixed(2)}\n`
    message += `Trades: ${totalTrades} (${winCount}W / ${lossCount}L / ${breakevenCount}BE)\n`
    message += `Win Rate: ${winRate}%\n`

    if (bestTrade) {
      message += `\nBest: ${bestTrade.side.toUpperCase()} ${bestTrade.symbol} +$${bestTrade.pnl.toFixed(2)} (${bestTrade.pips > 0 ? '+' : ''}${bestTrade.pips} pips)`
    }
    if (worstTrade) {
      message += `\nWorst: ${worstTrade.side.toUpperCase()} ${worstTrade.symbol} $${worstTrade.pnl.toFixed(2)} (${worstTrade.pips} pips)`
    }

    if (byPair.length > 0) {
      message += `\n\nBy Pair:`
      for (const pair of byPair) {
        const pairSign = pair.totalPnl >= 0 ? '+' : ''
        message += `\n  ${pair.symbol}: ${pair.count} trades, ${pair.winRate}% WR, P&L ${pairSign}$${pair.totalPnl.toFixed(2)}`
      }
    }

    // ── Build webhook fields ─────────────────────────────────────────────────
    const fields: Array<{ name: string; value: string }> = [
      { name: 'Date', value: dateLabel },
      { name: 'Total P&L', value: `${pnlSign}$${totalPnl.toFixed(2)}` },
      { name: 'Trades', value: `${totalTrades} (${winCount}W / ${lossCount}L / ${breakevenCount}BE)` },
      { name: 'Win Rate', value: `${winRate}%` },
    ]
    if (bestTrade) {
      fields.push({
        name: 'Best Trade',
        value: `${bestTrade.side.toUpperCase()} ${bestTrade.symbol} +$${bestTrade.pnl.toFixed(2)} (${bestTrade.pips > 0 ? '+' : ''}${bestTrade.pips} pips)`,
      })
    }
    if (worstTrade) {
      fields.push({
        name: 'Worst Trade',
        value: `${worstTrade.side.toUpperCase()} ${worstTrade.symbol} $${worstTrade.pnl.toFixed(2)} (${worstTrade.pips} pips)`,
      })
    }
    if (byPair.length > 0) {
      fields.push({
        name: 'By Pair',
        value: byPair
          .map((p) => {
            const s = p.totalPnl >= 0 ? '+' : ''
            return `${p.symbol}: ${p.count}t / ${p.winRate}%WR / ${s}$${p.totalPnl.toFixed(2)}`
          })
          .join('\n'),
      })
    }

    // ── Send webhook ─────────────────────────────────────────────────────────
    await sendWebhook({
      type: 'system',
      title: `${emoji} Daily Summary — ${pnlSign}$${totalPnl.toFixed(2)}`,
      message,
      color: totalPnl >= 0 ? 0x10b981 : 0xef4444,
      fields,
    }).catch(() => null)

    // ── Save notification record in DB ───────────────────────────────────────
    await db.notification.create({
      data: {
        type: 'system',
        subject: `Daily Summary — ${dateLabel}`,
        body: message,
        recipient: 'system',
        sent: true,
        sentAt: new Date(),
      },
    }).catch(() => null)

    // ── Log ──────────────────────────────────────────────────────────────────
    await logInfo('system', `Daily summary generated: ${totalTrades} trades, P&L ${pnlSign}$${totalPnl.toFixed(2)}, WR ${winRate}%`, {
      date: dateLabel,
      totalTrades,
      winCount,
      lossCount,
      winRate,
      totalPnl,
      byPair: byPair.map((p) => `${p.symbol}:$${p.totalPnl.toFixed(2)}`),
    })

    return {
      date: dateLabel,
      totalTrades,
      winCount,
      lossCount,
      winRate,
      totalPnl: Number(totalPnl.toFixed(2)),
      bestTrade,
      worstTrade,
      byPair,
      message,
    }
  } catch (e: any) {
    await logError('system', `Failed to generate daily summary: ${e.message}`, e.stack)
    return emptySummary
  }
}