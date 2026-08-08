import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { updateAccountSchema } from '@/lib/validators';

export async function GET() {
  try {
    let account = await db.tradingAccount.findFirst({
      orderBy: { createdAt: 'asc' },
      include: {
        trades: {
          where: { status: 'open' },
        },
      },
    });

    // If no account exists, create a default one
    if (!account) {
      account = await db.tradingAccount.create({
        data: {
          accountType: 'demo',
          broker: 'FINEX Indonesia',
          balance: 10000,
          equity: 10000,
          margin: 0,
          freeMargin: 10000,
          marginLevel: 0,
          leverage: 500,
          currency: 'USD',
          dailyPnl: 0,
          totalPnl: 0,
          isAutoTrading: false,
        },
        include: {
          trades: {
            where: { status: 'open' },
          },
        },
      });
    }

    // Recalculate equity and margin from open trades
    const openTrades = account.trades;
    const unrealizedPnl = openTrades.reduce((sum, t) => sum + (t.profit || 0), 0);
    const totalMargin = openTrades.reduce((sum, t) => {
      // Approximate margin: lotSize * contractSize / leverage
      const contractSize = t.symbol === 'XAUUSD' ? 100 : 100000;
      return sum + (t.lotSize * contractSize) / (account!.leverage || 500);
    }, 0);

    const equity = account.balance + unrealizedPnl;
    const freeMargin = equity - totalMargin;
    const marginLevel = totalMargin > 0 ? (equity / totalMargin) * 100 : 0;

    return NextResponse.json({
      id: account.id,
      accountType: account.accountType,
      broker: account.broker,
      balance: account.balance,
      equity: Math.round(equity * 100) / 100,
      margin: Math.round(totalMargin * 100) / 100,
      freeMargin: Math.round(freeMargin * 100) / 100,
      marginLevel: Math.round(marginLevel * 100) / 100,
      leverage: account.leverage,
      currency: account.currency,
      dailyPnl: account.dailyPnl,
      totalPnl: account.totalPnl,
      isAutoTrading: account.isAutoTrading,
      openPositions: openTrades.length,
      unrealizedPnl: Math.round(unrealizedPnl * 100) / 100,
    });
  } catch (error) {
    console.error('Error fetching account:', error);
    return NextResponse.json(
      { error: 'Failed to fetch account info' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const parsed = updateAccountSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { isAutoTrading, leverage, accountType } = parsed.data;

    const account = await db.tradingAccount.findFirst({
      orderBy: { createdAt: 'asc' },
    });

    if (!account) {
      return NextResponse.json(
        { error: 'No account found' },
        { status: 404 }
      );
    }

    const updated = await db.tradingAccount.update({
      where: { id: account.id },
      data: {
        ...(isAutoTrading !== undefined && { isAutoTrading }),
        ...(leverage !== undefined && { leverage }),
        ...(accountType !== undefined && { accountType }),
      },
    });

    return NextResponse.json({
      id: updated.id,
      accountType: updated.accountType,
      broker: updated.broker,
      balance: updated.balance,
      equity: updated.equity,
      margin: updated.margin,
      freeMargin: updated.freeMargin,
      marginLevel: updated.marginLevel,
      leverage: updated.leverage,
      currency: updated.currency,
      dailyPnl: updated.dailyPnl,
      totalPnl: updated.totalPnl,
      isAutoTrading: updated.isAutoTrading,
    });
  } catch (error) {
    console.error('Error updating account:', error);
    return NextResponse.json(
      { error: 'Failed to update account settings' },
      { status: 500 }
    );
  }
}
