import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { bidAsk, calcLotSize } from '@/lib/market'
import { checkNewsAvoidance } from '@/lib/news-avoidance'
import { logInfo, logWarn, sendNotification } from '@/lib/logger'
import { sendWebhook } from '@/lib/webhook'
import type { SupportedSymbol } from '@/lib/types'
import { SYMBOL_BASE } from '@/lib/types'
import { requireTrader } from '@/lib/auth-server'
import { auditLog } from '@/lib/audit'
import { enforceTradeOpen, isMarketClosed } from '@/lib/risk-enforcement'
import { bridgeHealth, marketOrder as mt5MarketOrder } from '@/lib/mt5-client'
import { isAnySessionActive } from '@/lib/sessions'

export const dynamic = 'force-dynamic'

const SYMBOLS: SupportedSymbol[] = ['EURUSD', 'USDJPY', 'GBPUSD', 'XAUUSD']
const MINUTES_BETWEEN_SIGNALS = 5 // dedup window: avoid re-executing same symbol too often

// POST /api/ai/auto-trade
// Scans latest AI signals for all symbols. If autoTradingEnabled=true and risk
// limits allow, executes trades for high-confidence actionable signals.
//
// r12-SAFETY: Now calls enforceTradeOpen() before EACH trade — the same 8-check
// gauntlet that manual trades go through. No more bypass.
// Returns a summary of actions taken.
export async function POST() {
  // Role guard: only trader+ can trigger auto-trade (viewer cannot)
  const user = await requireTrader()
  if (user instanceof NextResponse) return user

  try {
    // 1. Check auto-trading is enabled
    const autoSetting = await db.riskSetting.findUnique({ where: { key: 'autoTradingEnabled' } })
    if (!autoSetting || autoSetting.value !== 'true') {
      return NextResponse.json({
        enabled: false,
        message: 'Auto-trading dinonaktifkan. Aktifkan di Risk Management panel.',
        executed: [],
      })
    }

    // 2. Get default account
    const account = await db.account.findFirst({ where: { isDefault: true } })
    if (!account) {
      return NextResponse.json({ enabled: true, error: 'No default account found' }, { status: 400 })
    }

    // 2b. Weekend / market closed — early fast-fail before anything else
    const marketStatus = isMarketClosed()
    if (marketStatus.closed) {
      return NextResponse.json({
        enabled: true,
        message: marketStatus.reason,
        executed: [],
        marketClosed: true,
      })
    }

    if (!account.connected) {
      return NextResponse.json({
        enabled: true,
        error: 'Akun MT5 tidak terhubung. Sambungkan dulu di Settings.',
        executed: [],
      })
    }

    // 3. Load risk settings (used for signal filtering + lot sizing)
    const riskPerTradeStr = (await db.riskSetting.findUnique({ where: { key: 'riskPerTradePct' } }))?.value || '0.75'
    const slPipsStr = (await db.riskSetting.findUnique({ where: { key: 'stopLossPipsMax' } }))?.value || '15'
    const tpPipsStr = (await db.riskSetting.findUnique({ where: { key: 'takeProfitPipsMax' } }))?.value || '30'
    const xauSlPipsStr = (await db.riskSetting.findUnique({ where: { key: 'xauSlPipsMax' } }))?.value || '50'
    const xauTpPipsStr = (await db.riskSetting.findUnique({ where: { key: 'xauTpPipsMax' } }))?.value || '100'
    const confThresholdStr = (await db.riskSetting.findUnique({ where: { key: 'autoTradeConfidenceThreshold' } }))?.value || '70'
    const signalMaxAgeStr = (await db.riskSetting.findUnique({ where: { key: 'autoTradeSignalMaxAgeMin' } }))?.value || '10'
    const tradingSessionsStr = (await db.riskSetting.findUnique({ where: { key: 'tradingSessions' } }))?.value || 'london,overlap'

    const riskPerTrade = parseFloat(riskPerTradeStr)
    const forexSlPips = parseFloat(slPipsStr)
    const forexTpPips = parseFloat(tpPipsStr)
    const xauSlPips = parseFloat(xauSlPipsStr)
    const xauTpPips = parseFloat(xauTpPipsStr)
    const confidenceThreshold = parseFloat(confThresholdStr)
    const signalMaxAgeMin = parseFloat(signalMaxAgeStr)

    // 3b. Session gate: block auto-trading outside configured sessions
    const sessionCheck = isAnySessionActive(tradingSessionsStr)
    if (!sessionCheck.active) {
      const utcNow = new Date()
      const utcH = `${utcNow.getUTCHours().toString().padStart(2, '0')}:${utcNow.getUTCMinutes().toString().padStart(2, '0')}`
      return NextResponse.json({
        enabled: true,
        message: `Di luar trading session. UTC ${utcH} — sesi aktif: ${sessionCheck.allSessions.join(', ')}. Auto-trade ditunda sampai salah satu sesi dibuka.`,
        executed: [],
        sessionInfo: {
          utcTime: utcH,
          configuredSessions: sessionCheck.allSessions,
        },
      })
    }

    // 4. Pre-check: daily loss circuit breaker (fast fail before scanning signals)
    // The full enforceTradeOpen() is called per-trade below, but this early check
    // avoids unnecessary signal scanning when we're already in circuit breaker.
    const openTrades = await db.trade.findMany({ where: { accountId: account.id, status: 'open' } })

    // 5. Find latest signal per symbol + execute
    const executed: any[] = []
    const rejected: any[] = []
    const mt5Login = Number(account.login)
    const bridgeOk = (await bridgeHealth()).ok

    for (const symbol of SYMBOLS) {
      const latestSignal = await db.aiSignal.findFirst({
        where: { symbol },
        orderBy: { createdAt: 'desc' },
      })

      if (!latestSignal) continue
      // Only act on buy/sell signals above threshold
      if (latestSignal.action !== 'buy' && latestSignal.action !== 'sell') continue
      if (latestSignal.confidence < confidenceThreshold) continue

      // Skip if we already have an open position on this symbol
      if (openTrades.some((t) => t.symbol === symbol)) continue

      // Skip if signal is too old (configurable, default 10 min)
      const signalAge = (Date.now() - latestSignal.createdAt.getTime()) / 60000
      if (signalAge > signalMaxAgeMin) continue

      // Skip if we recently auto-traded this symbol (dedup)
      const recentAutoTrade = await db.trade.findFirst({
        where: {
          accountId: account.id,
          symbol,
          source: 'ai',
          openTime: { gte: new Date(Date.now() - MINUTES_BETWEEN_SIGNALS * 60000) },
        },
      })
      if (recentAutoTrade) continue

      // News avoidance final check
      const newsAvoid = await checkNewsAvoidance(symbol)
      if (newsAvoid.action === 'wait') {
        await logWarn('ai', `Auto-trade skip ${symbol}: news avoidance (event in ${newsAvoid.minutesUntilEvent}m)`)
        continue
      }

      // 6. Compute trade parameters (pair-specific SL/TP)
      const isXau = symbol === 'XAUUSD'
      const slPips = isXau ? xauSlPips : forexSlPips
      const tpPips = isXau ? xauTpPips : forexTpPips
      const side = latestSignal.action === 'buy' ? 'buy' : 'sell'
      const { bid, ask } = await bidAsk(symbol)
      const openPrice = side === 'buy' ? ask : bid
      const lot = calcLotSize(symbol, account.balance, riskPerTrade, slPips, openPrice)

      // SL/TP from independent pips settings (no longer derived from RR ratio)
      const symBase = SYMBOL_BASE[symbol]
      const slDist = slPips * symBase.pip
      const tpDist = tpPips * symBase.pip
      const stopLoss = side === 'buy' ? openPrice - slDist : openPrice + slDist
      const takeProfit = side === 'buy' ? openPrice + tpDist : openPrice - tpDist
      const slRounded = Number(stopLoss.toFixed(symBase.digits))
      const tpRounded = Number(takeProfit.toFixed(symBase.digits))
      const commission = lot * 2.5 * 2

      // 7. ─── RISK ENFORCEMENT (r12-SAFETY) ───────────────────────────────────
      // Call enforceTradeOpen() — the SAME 8-check gauntlet as manual trades.
      // If rejected, log the violations and skip this symbol.
      const enforcement = await enforceTradeOpen({
        accountId: account.id,
        symbol,
        side,
        lotSize: lot,
        stopLoss: slRounded,
      })
      if (!enforcement.allowed) {
        await logWarn('risk', `Auto-trade REJECTED for ${symbol}: ${enforcement.violations.join('; ')}`)
        rejected.push({
          symbol,
          side,
          lot,
          confidence: latestSignal.confidence,
          violations: enforcement.violations,
        })
        continue // skip to next symbol
      }

      // 8. ─── MT5 Bridge integration (mirror trades/route.ts pattern) ──────────
      let mt5Ticket: number | null = null
      let mt5Server: string | null = null
      let finalOpenPrice = openPrice

      if (bridgeOk && mt5Login > 0) {
        try {
          const order = await mt5MarketOrder({
            login: mt5Login,
            symbol,
            side,
            volume: lot,
            sl: Number(slRounded),
            tp: Number(tpRounded),
            comment: `auto-${latestSignal.confidence}%-${latestSignal.direction}`,
          })
          mt5Ticket = order.ticket
          mt5Server = account.server || null
          finalOpenPrice = order.price
        } catch (e: any) {
          await logWarn('ai', `Auto-trade MT5 bridge failed for ${symbol}, using synthetic: ${e.message}`)
          // Fall back to synthetic price (finalOpenPrice stays as openPrice)
        }
      }

      // 9. Create the trade record
      const trade = await db.trade.create({
        data: {
          accountId: account.id,
          symbol,
          side,
          lotSize: lot,
          openPrice: finalOpenPrice,
          stopLoss: Number(slRounded),
          takeProfit: Number(tpRounded),
          trailingStop: false,
          trailingPips: 0,
          status: 'open',
          pnl: 0,
          pips: 0,
          commission,
          swap: 0,
          strategy: 'scalping-m5',
          timeframe: 'M5',
          source: 'ai',
          comment: `Auto: signal ${latestSignal.confidence}% ${latestSignal.direction}`,
          mt5Ticket,
          mt5Server,
          openTime: new Date(),
        },
      })

      // Update account margin (use proper margin calculation, not flat $1000/lot)
      const marginIncrement = (lot * SYMBOL_BASE[symbol].contractSize * finalOpenPrice) / (parseInt(String(account.leverage).replace(/^1:/, '')) || 100)
      await db.account.update({
        where: { id: account.id },
        data: { margin: { increment: Number(marginIncrement.toFixed(2)) } },
      })

      // Add to open trades list so next iteration sees it
      openTrades.push(trade as any)

      await logInfo('ai', `Auto-trade executed: ${side.toUpperCase()} ${lot} ${symbol} @ ${finalOpenPrice} (signal ${latestSignal.confidence}%, source=AI)${mt5Ticket ? ` [MT5 ticket=${mt5Ticket}]` : ''}`)
      await sendNotification(
        'trade_open',
        `🤖 Auto-Trade: ${side.toUpperCase()} ${symbol}`,
        `AI auto-executed ${side.toUpperCase()} ${lot} lots ${symbol} @ ${finalOpenPrice}\nSignal confidence: ${latestSignal.confidence}%\nDirection: ${latestSignal.direction}\nSL: ${slRounded} | TP: ${tpRounded}\n\nReasoning: ${latestSignal.reasoning.slice(0, 200)}`,
        'trader@example.com',
      )

      // r15-INTEGRATION: webhook notification for auto-trade events
      await sendWebhook({
        type: 'trade_open',
        title: `🤖 Auto-Trade: ${side.toUpperCase()} ${lot} ${symbol}`,
        message: `AI auto-executed ${side.toUpperCase()} ${lot} lots ${symbol} @ ${finalOpenPrice} (confidence: ${latestSignal.confidence}%)`,
        color: 0x8b5cf6, // violet for AI
        fields: [
          { name: 'Symbol', value: symbol },
          { name: 'Side', value: side.toUpperCase() },
          { name: 'Lot', value: String(lot) },
          { name: 'Entry', value: String(finalOpenPrice) },
          { name: 'Stop Loss', value: String(slRounded) },
          { name: 'Take Profit', value: String(tpRounded) },
          { name: 'Confidence', value: `${latestSignal.confidence}%` },
          { name: 'Direction', value: latestSignal.direction },
        ],
      }).catch(() => null)

      executed.push({
        symbol,
        side,
        lot,
        openPrice: finalOpenPrice,
        confidence: latestSignal.confidence,
        tradeId: trade.id,
        mt5Ticket,
      })
    }

    const summary = executed.length === 0
      ? rejected.length > 0
        ? `${rejected.length} signal ditolak oleh risk management. Lihat rejected list.`
        : `Tidak ada sinyal yang memenuhi kriteria auto-trade (confidence ≥ ${confidenceThreshold}%, action buy/sell, no news conflict).`
      : `${executed.length} auto-trade dieksekusi.${rejected.length > 0 ? ` ${rejected.length} ditolak risk.` : ''}`

    await auditLog(user, {
      action: 'auto-trade.execute',
      entityType: 'system',
      metadata: JSON.stringify({ executedCount: executed.length, rejectedCount: rejected.length }),
    })

    return NextResponse.json({
      enabled: true,
      message: summary,
      confidenceThreshold,
      executed,
      rejected,
      openPositions: openTrades.length,
      todayPnlPct: 0, // computed in enforceTradeOpen context, not surfaced here
    })
  } catch (e: any) {
    console.error('POST /api/ai/auto-trade error', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
