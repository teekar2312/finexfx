import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { logInfo } from '@/lib/logger'
import { sendNotification } from '@/lib/logger'
import { sendWebhook } from '@/lib/webhook'
import { bidAsk } from '@/lib/market'
import { SUPPORTED_SYMBOLS, SYMBOL_BASE } from '@/lib/types'
import { bridgeHealth, marketOrder as mt5MarketOrder } from '@/lib/mt5-client'
import { requireTrader } from '@/lib/auth-server'
import { auditLog } from '@/lib/audit'
import { enforceTradeOpen } from '@/lib/risk-enforcement'
import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
    const accountId = searchParams.get('accountId')
    const symbol = searchParams.get('symbol')
    const limit = Number(searchParams.get('limit') ?? 100)

    const where: Record<string, unknown> = {}
    if (status) where.status = status
    if (accountId) where.accountId = accountId
    if (symbol) where.symbol = symbol

    const trades = await db.trade.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 500),
    })

    return NextResponse.json({ trades })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  // Rate limit: 10 trade opens per minute per IP
  const limited = applyRateLimit(req, RATE_LIMITS.tradeOpen)
  if (limited) return limited

  // Role guard: only trader+ can open trades (viewer cannot)
  const user = await requireTrader()
  if (user instanceof NextResponse) return user

  try {
    const body = await req.json()
    const {
      accountId,
      symbol,
      side,
      lotSize,
      stopLoss,
      takeProfit,
      source,
      trailingStop,
      trailingPips,
      comment,
    } = body || {}

    if (!accountId || !symbol || !side || !lotSize) {
      return NextResponse.json(
        { error: 'accountId, symbol, side, lotSize are required' },
        { status: 400 },
      )
    }

    if (!SUPPORTED_SYMBOLS.includes(symbol)) {
      return NextResponse.json(
        { error: `Unsupported symbol: ${symbol}` },
        { status: 400 },
      )
    }

    if (side !== 'buy' && side !== 'sell') {
      return NextResponse.json({ error: 'side must be buy or sell' }, { status: 400 })
    }

    const account = await db.account.findUnique({ where: { id: accountId } })
    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 })
    }

    const base = SYMBOL_BASE[symbol]

    // ─── Compute default SL/TP EARLY (before risk enforcement) ──────────
    // This ensures risk enforcement always has a valid SL to check against,
    // preventing bypass when client omits stopLoss from the request.
    const isXau = symbol === 'XAUUSD'
    const defaultSlPips = parseFloat(
      (await db.riskSetting.findUnique({ where: { key: isXau ? 'xauSlPipsMax' : 'stopLossPipsMax' } }))?.value
      || (isXau ? '50' : '15')
    )
    const defaultTpPips = parseFloat(
      (await db.riskSetting.findUnique({ where: { key: isXau ? 'xauTpPipsMax' : 'takeProfitPipsMax' } }))?.value
      || (isXau ? '100' : '30')
    )

    // Get a preliminary price for SL/TP defaults (will be refined after bridge order)
    const { bid: preBid, ask: preAsk } = await bidAsk(symbol)
    const prePrice = side === 'buy' ? preAsk : preBid
    const effectiveSl = stopLoss != null ? Number(stopLoss)
      : Number((side === 'buy' ? prePrice - defaultSlPips * base.pip : prePrice + defaultSlPips * base.pip).toFixed(base.digits))
    const effectiveTp = takeProfit != null ? Number(takeProfit)
      : Number((side === 'buy' ? prePrice + defaultTpPips * base.pip : prePrice - defaultTpPips * base.pip).toFixed(base.digits))

    // ─── Risk Enforcement ────────────────────────────────────────────────────
    // Server-side hard checks: max positions, lot size, daily loss, margin, etc.
    // Returns 422 with violation details if any check fails.
    const enforcement = await enforceTradeOpen({
      accountId,
      symbol,
      side,
      lotSize: Number(lotSize),
      stopLoss: effectiveSl,
    })
    if (!enforcement.allowed) {
      return NextResponse.json(
        {
          error: 'Trade rejected by risk management',
          violations: enforcement.violations,
          context: enforcement.context,
        },
        { status: 422 },
      )
    }

    // ─── MT5 Bridge integration ────────────────────────────────────────────────
    // Try to route the order through the MT5 bridge. If the bridge is online
    // and the account has an MT5 login, we send a real (or mock) market order
    // and store the returned ticket. If the bridge is offline, we fall back to
    // the live bridge price and create a local-only trade (mt5Ticket = null).
    let openPrice: number
    let mt5Ticket: number | null = null
    let mt5Server: string | null = null
    let bridgeUsed = false
    let slippagePips: number | null = null
    let executionLatencyMs: number | null = null
    const orderStartTime = Date.now()

    const health = await bridgeHealth()
    const mt5Login = Number(account.login)

    // Get requested price for slippage calculation
    const { bid: reqBid, ask: reqAsk } = await bidAsk(symbol)
    const requestedPrice = side === 'buy' ? reqAsk : reqBid

    if (health.ok && mt5Login > 0) {
      try {
        const order = await mt5MarketOrder({
          login: mt5Login,
          symbol,
          side,
          volume: Number(lotSize),
          sl: effectiveSl,
          tp: effectiveTp,
          comment: comment ? String(comment) : `finexfx-${source || 'manual'}`,
        })
        mt5Ticket = order.ticket
        mt5Server = account.server || null
        openPrice = order.price
        bridgeUsed = true
        executionLatencyMs = Date.now() - orderStartTime
        // P4: Calculate slippage
        slippagePips = Number(((openPrice - requestedPrice) / SYMBOL_BASE[symbol].pip).toFixed(1))
        if (side === 'sell') slippagePips = -slippagePips // normalize: positive = unfavorable
        await logInfo('mt5', `MT5 bridge order filled: ticket=${order.ticket} @ ${openPrice} (slippage: ${slippagePips} pips, latency: ${executionLatencyMs}ms)`, {
          tradeId: 'pending',
          accountId,
          mt5Ticket,
        })
      } catch (e: any) {
        // Bridge order failed — fetch live price from bridge.
        // Don't throw: we still create a local trade so the user sees their intent.
        await logInfo('mt5', `MT5 bridge order failed, fetching live price: ${e.message}`, {
          accountId,
          symbol,
          side,
        })
        const { bid, ask } = await bidAsk(symbol)
        openPrice = side === 'buy' ? ask : bid
      }
    } else {
      // Bridge online — fetch live price.
      const { bid, ask } = await bidAsk(symbol)
      openPrice = side === 'buy' ? ask : bid
    }

    // Recompute SL/TP using the actual open price (bridge may have slipped)
    const sl = stopLoss != null
      ? Number(stopLoss)
      : Number((side === 'buy' ? openPrice - defaultSlPips * base.pip : openPrice + defaultSlPips * base.pip).toFixed(base.digits))
    const tp = takeProfit != null
      ? Number(takeProfit)
      : Number((side === 'buy' ? openPrice + defaultTpPips * base.pip : openPrice - defaultTpPips * base.pip).toFixed(base.digits))

    // If bridge order succeeded but didn't set SL/TP, modify the MT5 position now.
    if (bridgeUsed && mt5Ticket && (sl !== null || tp !== null)) {
      try {
        const { modifyPosition } = await import('@/lib/mt5-client')
        await modifyPosition(mt5Ticket, sl, tp)
      } catch (e: any) {
        await logInfo('mt5', `MT5 modify SL/TP failed (non-fatal): ${e.message}`, { mt5Ticket })
      }
    }

    const lot = Number(lotSize)
    // Round-turn commission: $2.5/lot x 2 sides
    const commission = Number((lot * 2.5 * 2).toFixed(2))

    const trade = await db.trade.create({
      data: {
        accountId,
        symbol,
        side,
        lotSize: lot,
        openPrice,
        closePrice: null,
        stopLoss: sl,
        takeProfit: tp,
        trailingStop: Boolean(trailingStop ?? false),
        trailingPips: trailingPips != null ? Number(trailingPips) : 0,
        status: 'open',
        pnl: 0,
        pips: 0,
        commission,
        swap: 0,
        strategy: 'scalping-m5',
        timeframe: 'M5',
        source: source ? String(source) : 'manual',
        comment: comment ? String(comment) : null,
        mt5Ticket,
        mt5Server,
        slippagePips,
        executionLatencyMs,
        openTime: new Date(),
        closeTime: null,
      },
    })

    await logInfo(
      'mt5',
      `Trade opened ${side} ${lot} ${symbol} @ ${openPrice}${bridgeUsed ? ` [MT5 ticket=${mt5Ticket}]` : ' [live]'}`,
      { tradeId: trade.id, accountId, sl, tp, commission, mt5Ticket },
    )

    await sendNotification(
      'trade_open',
      `Position opened: ${side.toUpperCase()} ${lot} ${symbol}`,
      `Trade #${trade.id} opened at ${openPrice} on ${account.name}. SL=${sl} TP=${tp} Commission=$${commission}.`,
      `trader@${account.broker.toLowerCase().replace(/\s+/g, '')}.com`,
    ).catch(() => null)

    // Webhook notification (Discord/Telegram/Slack)
    await sendWebhook({
      type: 'trade_open',
      title: `🟢 Position Opened: ${side.toUpperCase()} ${lot} ${symbol}`,
      message: `Trade opened at ${openPrice} on ${account.name}.`,
      fields: [
        { name: 'Symbol', value: symbol },
        { name: 'Side', value: side.toUpperCase() },
        { name: 'Lot', value: String(lot) },
        { name: 'Entry', value: String(openPrice) },
        { name: 'Stop Loss', value: String(sl) },
        { name: 'Take Profit', value: String(tp) },
      ],
    }).catch(() => null)

    await auditLog(user, { action: 'trade.open', entityType: 'trade', entityId: trade.id, metadata: { symbol, side, lot, openPrice: trade.openPrice, mt5Ticket: trade.mt5Ticket } })

    return NextResponse.json({ trade })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
