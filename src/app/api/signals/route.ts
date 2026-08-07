import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import type { Symbol, TradeDirection, StrategyName, MarketCondition } from '@/lib/types';

export async function GET() {
  try {
    const signals = await db.tradingSignal.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const formatted = signals.map((s) => ({
      id: s.id,
      symbol: s.symbol as Symbol,
      direction: s.direction as TradeDirection | 'HOLD',
      confidence: s.confidence,
      strategy: s.strategy as StrategyName,
      marketCondition: s.marketCondition as MarketCondition,
      entryPrice: s.entryPrice,
      stopLoss: s.stopLoss,
      takeProfit: s.takeProfit,
      riskReward: s.riskReward,
      aiAnalysis: s.aiAnalysis,
      isExecuted: s.isExecuted,
      executedTradeId: s.executedTradeId,
      createdAt: s.createdAt.toISOString(),
    }));

    const recent = formatted.slice(0, 10);

    return NextResponse.json({
      signals: formatted,
      recent,
      total: formatted.length,
    });
  } catch (error) {
    console.error('Error fetching signals:', error);
    return NextResponse.json(
      { error: 'Failed to fetch signals' },
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
      confidence,
      strategy,
      marketCondition,
      entryPrice,
      stopLoss,
      takeProfit,
      riskReward,
      aiAnalysis,
    } = body;

    if (!symbol || !direction || !confidence || !strategy) {
      return NextResponse.json(
        { error: 'Missing required fields: symbol, direction, confidence, strategy' },
        { status: 400 }
      );
    }

    const signal = await db.tradingSignal.create({
      data: {
        symbol,
        direction,
        confidence: Math.min(100, Math.max(0, confidence)),
        strategy,
        marketCondition: marketCondition ?? 'trending',
        entryPrice: entryPrice ?? 0,
        stopLoss: stopLoss ?? null,
        takeProfit: takeProfit ?? null,
        riskReward: riskReward ?? null,
        aiAnalysis: aiAnalysis ?? null,
        isExecuted: false,
      },
    });

    return NextResponse.json({
      id: signal.id,
      symbol: signal.symbol as Symbol,
      direction: signal.direction as TradeDirection | 'HOLD',
      confidence: signal.confidence,
      strategy: signal.strategy as StrategyName,
      marketCondition: signal.marketCondition as MarketCondition,
      entryPrice: signal.entryPrice,
      stopLoss: signal.stopLoss,
      takeProfit: signal.takeProfit,
      riskReward: signal.riskReward,
      aiAnalysis: signal.aiAnalysis,
      isExecuted: signal.isExecuted,
      createdAt: signal.createdAt.toISOString(),
    });
  } catch (error) {
    console.error('Error creating signal:', error);
    return NextResponse.json(
      { error: 'Failed to create signal' },
      { status: 500 }
    );
  }
}
