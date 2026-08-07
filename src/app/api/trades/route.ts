import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import type { Symbol, TradeDirection, TradeStatus } from '@/lib/types';
import { SYMBOLS, SYMBOL_INFO } from '@/lib/types';

/** Calculate P&L in USD for a trade closed at a given price */
function calculatePnl(trade: {
  symbol: string;
  direction: string;
  lotSize: number;
  entryPrice: number;
  commission: number;
  swap: number;
}, closePrice: number): { pips: number; profit: number } {
  const info = SYMBOL_INFO[trade.symbol as Symbol];
  const pipSize = info.pipSize;
  const pipMultiplier = info.category === 'forex' ? 100000 : 100;

  const pips = trade.direction === 'BUY'
    ? (closePrice - trade.entryPrice) / pipSize
    : (trade.entryPrice - closePrice) / pipSize;

  const profit = pips * trade.lotSize * pipMultiplier * pipSize - trade.commission + trade.swap;

  return {
    pips: Math.round(pips * 10) / 10,
    profit: Math.round(profit * 100) / 100,
  };
}

function calculateLotSize(
  balance: number,
  riskPerTrade: number,
  stopLossPips: number,
  symbol: Symbol,
  leverage: number
): number {
  const riskAmount = balance * (riskPerTrade / 100);
  const contractSize = symbol === 'XAUUSD' ? 100 : 100000;
  const pipValue = symbol === 'XAUUSD'
    ? (stopLossPips * 0.01 * contractSize)
    : symbol === 'USDJPY'
      ? (stopLossPips * 0.01 * contractSize) / 100
      : stopLossPips * SYMBOL_INFO[symbol].pipSize * contractSize;

  let lotSize = pipValue > 0 ? riskAmount / pipValue : 0.01;
  lotSize = Math.max(0.01, Math.min(50, lotSize));

  // Round to nearest 0.01
  lotSize = Math.round(lotSize * 100) / 100;
  return lotSize;
}

export async function GET() {
  try {
    const trades = await db.trade.findMany({
      orderBy: [{ status: 'asc' }, { openedAt: 'desc' }],
      include: {
        account: true,
      },
    });

    const formatted = trades.map((t) => ({
      id: t.id,
      accountId: t.accountId,
      symbol: t.symbol as Symbol,
      direction: t.direction as TradeDirection,
      lotSize: t.lotSize,
      entryPrice: t.entryPrice,
      currentPrice: t.currentPrice ?? t.entryPrice,
      stopLoss: t.stopLoss,
      takeProfit: t.takeProfit,
      trailingStop: t.trailingStop,
      isTrailingStop: t.isTrailingStop,
      pips: t.pips,
      profit: t.profit,
      commission: t.commission,
      spread: t.spread,
      swap: t.swap,
      status: t.status as TradeStatus,
      strategy: t.strategy,
      aiConfidence: t.aiConfidence,
      marketCondition: t.marketCondition as any,
      openedAt: t.openedAt.toISOString(),
      closedAt: t.closedAt?.toISOString() ?? null,
    }));

    const openTrades = formatted.filter((t) => t.status === 'open');
    const closedTrades = formatted.filter((t) => t.status === 'closed');

    return NextResponse.json({
      trades: formatted,
      openTrades,
      closedTrades,
      totalOpen: openTrades.length,
      totalClosed: closedTrades.length,
    });
  } catch (error) {
    console.error('Error fetching trades:', error);
    return NextResponse.json(
      { error: 'Failed to fetch trades' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      symbol,
      direction,
      lotSize: requestedLotSize,
      entryPrice,
      stopLoss,
      takeProfit,
      strategy,
      aiConfidence,
      marketCondition,
    } = body;

    if (!SYMBOLS.includes(symbol)) {
      return NextResponse.json(
        { error: `Invalid symbol: ${symbol}` },
        { status: 400 }
      );
    }

    if (!['BUY', 'SELL'].includes(direction)) {
      return NextResponse.json(
        { error: 'Direction must be BUY or SELL' },
        { status: 400 }
      );
    }

    // Get account
    const account = await db.tradingAccount.findFirst({
      orderBy: { createdAt: 'asc' },
    });

    if (!account) {
      return NextResponse.json(
        { error: 'No trading account found. Please create an account first.' },
        { status: 404 }
      );
    }

    // Get risk settings for lot size calculation
    const riskSettings = await db.riskSettings.findFirst({
      orderBy: { createdAt: 'asc' },
    });

    const slPips = stopLoss
      ? Math.abs(entryPrice - stopLoss) / SYMBOL_INFO[symbol as Symbol].pipSize
      : riskSettings?.stopLossPips ?? 10;

    // Calculate lot size from risk settings if not provided
    const lotSize = requestedLotSize ?? calculateLotSize(
      account.balance,
      riskSettings?.riskPerTrade ?? 0.5,
      slPips,
      symbol as Symbol,
      account.leverage
    );

    const spreadCost = SYMBOL_INFO[symbol as Symbol].pipSize * 0.5;

    const trade = await db.trade.create({
      data: {
        accountId: account.id,
        symbol,
        direction,
        lotSize,
        entryPrice,
        currentPrice: entryPrice,
        stopLoss: stopLoss ?? null,
        takeProfit: takeProfit ?? null,
        spread: spreadCost,
        commission: lotSize * 1, // $1 per lot commission
        strategy: strategy ?? null,
        aiConfidence: aiConfidence ?? null,
        marketCondition: marketCondition ?? null,
      },
    });

    return NextResponse.json({
      id: trade.id,
      accountId: trade.accountId,
      symbol: trade.symbol as Symbol,
      direction: trade.direction as TradeDirection,
      lotSize: trade.lotSize,
      entryPrice: trade.entryPrice,
      currentPrice: trade.currentPrice ?? trade.entryPrice,
      stopLoss: trade.stopLoss,
      takeProfit: trade.takeProfit,
      trailingStop: trade.trailingStop,
      isTrailingStop: trade.isTrailingStop,
      pips: trade.pips,
      profit: trade.profit,
      commission: trade.commission,
      spread: trade.spread,
      swap: trade.swap,
      status: trade.status as TradeStatus,
      strategy: trade.strategy,
      aiConfidence: trade.aiConfidence,
      marketCondition: trade.marketCondition as any,
      openedAt: trade.openedAt.toISOString(),
      closedAt: trade.closedAt?.toISOString() ?? null,
    });
  } catch (error) {
    console.error('Error creating trade:', error);
    return NextResponse.json(
      { error: 'Failed to create trade' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Trade ID is required' },
        { status: 400 }
      );
    }

    const trade = await db.trade.findUnique({
      where: { id },
    });

    if (!trade) {
      return NextResponse.json(
        { error: 'Trade not found' },
        { status: 404 }
      );
    }

    if (trade.status === 'closed') {
      return NextResponse.json(
        { error: 'Trade is already closed' },
        { status: 400 }
      );
    }

    // Calculate actual P&L at close time using the stored currentPrice
    const closePrice = trade.currentPrice ?? trade.entryPrice;
    const { pips: closedPips, profit: closedProfit } = calculatePnl(
      { symbol: trade.symbol, direction: trade.direction, lotSize: trade.lotSize, entryPrice: trade.entryPrice, commission: trade.commission, swap: trade.swap },
      closePrice,
    );

    // Close the trade with calculated P&L
    const closedTrade = await db.trade.update({
      where: { id },
      data: {
        status: 'closed',
        closedAt: new Date(),
        currentPrice: closePrice,
        pips: closedPips,
        profit: closedProfit,
      },
    });

    // Update account P&L
    const account = await db.tradingAccount.findUnique({
      where: { id: closedTrade.accountId },
    });

    if (account) {
      await db.tradingAccount.update({
        where: { id: account.id },
        data: {
          balance: account.balance + closedProfit,
          equity: account.equity + closedProfit,
          totalPnl: account.totalPnl + closedProfit,
          dailyPnl: account.dailyPnl + closedProfit,
        },
      });
    }

    return NextResponse.json({
      message: 'Trade closed successfully',
      trade: {
        id: closedTrade.id,
        symbol: closedTrade.symbol,
        direction: closedTrade.direction,
        pips: closedPips,
        profit: closedProfit,
        status: 'closed',
        closedAt: closedTrade.closedAt?.toISOString(),
      },
    });
  } catch (error) {
    console.error('Error closing trade:', error);
    return NextResponse.json(
      { error: 'Failed to close trade' },
      { status: 500 }
    );
  }
}
