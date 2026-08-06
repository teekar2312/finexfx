import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import type { Symbol, TradeDirection, TradeStatus, StrategyName, MarketCondition } from '@/lib/types';
import { SYMBOLS, SYMBOL_INFO, INDICATOR_POOL, STRATEGIES } from '@/lib/types';

interface SeedResponse {
  success: boolean;
  message: string;
  data: {
    account: any;
    riskSettings: any;
    newsItems: number;
    economicEvents: number;
    indicatorConfigs: number;
    trades: number;
    backtestResults: number;
  };
}

const SAMPLE_NEWS = [
  {
    source: 'Reuters',
    title: 'Federal Reserve Holds Rates Steady, Signals Potential September Cut',
    summary: 'The Fed kept rates unchanged at 5.25-5.50% but indicated inflation is cooling faster than expected.',
    category: 'Monetary Policy',
    impact: 'high',
    currency: 'USD',
    publishedAt: new Date(Date.now() - 1000 * 60 * 30),
  },
  {
    source: 'Bloomberg',
    title: 'ECB Pushes for Rate Cuts as Eurozone Inflation Falls to 2.4%',
    summary: 'ECB policymakers are increasingly confident inflation will return to target, advocating for consecutive rate reductions.',
    category: 'Monetary Policy',
    impact: 'high',
    currency: 'EUR',
    publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 2),
  },
  {
    source: 'FX Street',
    title: 'GBP/USD Rally Extends Above 1.2750 as UK GDP Beats Expectations',
    summary: 'UK economy grew 0.6% QoQ, exceeding forecasts of 0.4%.',
    category: 'Economic Data',
    impact: 'high',
    currency: 'GBP',
    publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 4),
  },
  {
    source: 'Nikkei Asia',
    title: 'Bank of Japan Signals Intervention as USD/JPY Nears 160',
    summary: 'Japanese officials warned of decisive action against excessive currency moves.',
    category: 'Central Bank',
    impact: 'high',
    currency: 'JPY',
    publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 3),
  },
  {
    source: 'Kitco News',
    title: 'Gold Surges to $2,400 Amid Geopolitical Tensions',
    summary: 'XAU/USD hit new highs as tensions combined with rate cut expectations drove safe-haven demand.',
    category: 'Commodities',
    impact: 'high',
    currency: 'XAU',
    publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 5),
  },
  {
    source: 'CNBC',
    title: 'US Non-Farm Payrolls Miss: 175K Jobs vs 243K Forecast',
    summary: 'The US labor market softened with job creation falling below expectations.',
    category: 'Employment',
    impact: 'high',
    currency: 'USD',
    publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 6),
  },
  {
    source: 'MarketWatch',
    title: 'US CPI at 3.4% YoY, Core CPI at 3.6% — Lowest Since 2021',
    summary: 'Consumer prices rose less than expected, reinforcing rate cut expectations.',
    category: 'Inflation',
    impact: 'high',
    currency: 'USD',
    publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 8),
  },
  {
    source: 'Financial Times',
    title: 'Eurozone PMI Composite Rises to 52.3',
    summary: 'The Eurozone showed signs of recovery with PMI above 50 for a second consecutive month.',
    category: 'Economic Data',
    impact: 'medium',
    currency: 'EUR',
    publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 10),
  },
];

const ECONOMIC_EVENTS = [
  {
    event: 'Non-Farm Payrolls (NFP)',
    currency: 'USD',
    impact: 'high',
    actual: '175K',
    forecast: '243K',
    previous: '303K',
    date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3),
  },
  {
    event: 'Consumer Price Index (CPI) MoM',
    currency: 'USD',
    impact: 'high',
    actual: '0.3%',
    forecast: '0.4%',
    previous: '0.4%',
    date: new Date(Date.now() + 1000 * 60 * 60 * 24 * 2),
  },
  {
    event: 'Gross Domestic Product (GDP) QoQ',
    currency: 'USD',
    impact: 'high',
    actual: '2.8%',
    forecast: '2.5%',
    previous: '1.6%',
    date: new Date(Date.now() + 1000 * 60 * 60 * 24 * 5),
  },
  {
    event: 'ECB Interest Rate Decision',
    currency: 'EUR',
    impact: 'high',
    actual: '3.65%',
    forecast: '3.65%',
    previous: '3.75%',
    date: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
  },
  {
    event: 'UK Employment Change',
    currency: 'GBP',
    impact: 'high',
    actual: null,
    forecast: '140K',
    previous: '121K',
    date: new Date(Date.now() + 1000 * 60 * 60 * 24 * 4),
  },
  {
    event: 'Japan Tankan Large Mfg Index',
    currency: 'JPY',
    impact: 'high',
    actual: null,
    forecast: '12',
    previous: '13',
    date: new Date(Date.now() + 1000 * 60 * 60 * 24 * 10),
  },
  {
    event: 'US ISM Manufacturing PMI',
    currency: 'USD',
    impact: 'high',
    actual: null,
    forecast: '49.2',
    previous: '48.7',
    date: new Date(Date.now() + 1000 * 60 * 60 * 24 * 1),
  },
  {
    event: 'Eurozone Unemployment Rate',
    currency: 'EUR',
    impact: 'medium',
    actual: '6.4%',
    forecast: '6.4%',
    previous: '6.4%',
    date: new Date(Date.now() + 1000 * 60 * 60 * 24 * 6),
  },
  {
    event: 'UK Retail Sales MoM',
    currency: 'GBP',
    impact: 'medium',
    actual: null,
    forecast: '0.3%',
    previous: '1.2%',
    date: new Date(Date.now() + 1000 * 60 * 60 * 24 * 8),
  },
  {
    event: 'BOJ Monetary Policy Statement',
    currency: 'JPY',
    impact: 'high',
    actual: null,
    forecast: '0.10%',
    previous: '0.10%',
    date: new Date(Date.now() + 1000 * 60 * 60 * 24 * 12),
  },
];

const SAMPLE_TRADES = [
  {
    symbol: 'EURUSD' as Symbol,
    direction: 'BUY' as TradeDirection,
    lotSize: 0.12,
    entryPrice: 1.08523,
    currentPrice: 1.08712,
    stopLoss: 1.08380,
    takeProfit: 1.08920,
    isTrailingStop: true,
    pips: 18.9,
    profit: 22.68,
    commission: 0.12,
    spread: 0.00005,
    swap: -0.03,
    status: 'open' as TradeStatus,
    strategy: 'EMA_Crossover',
    aiConfidence: 78,
    marketCondition: 'trending' as MarketCondition,
    openedAt: new Date(Date.now() - 1000 * 60 * 45),
  },
  {
    symbol: 'USDJPY' as Symbol,
    direction: 'SELL' as TradeDirection,
    lotSize: 0.08,
    entryPrice: 157.850,
    currentPrice: 157.420,
    stopLoss: 158.200,
    takeProfit: 157.100,
    isTrailingStop: false,
    pips: 43.0,
    profit: 34.40,
    commission: 0.08,
    spread: 0.005,
    swap: -0.01,
    status: 'open' as TradeStatus,
    strategy: 'Momentum_Scalping',
    aiConfidence: 72,
    marketCondition: 'high_volatility' as MarketCondition,
    openedAt: new Date(Date.now() - 1000 * 60 * 30),
  },
  {
    symbol: 'GBPUSD' as Symbol,
    direction: 'BUY' as TradeDirection,
    lotSize: 0.15,
    entryPrice: 1.27350,
    currentPrice: 1.27120,
    stopLoss: 1.27100,
    takeProfit: 1.27800,
    isTrailingStop: false,
    pips: -23.0,
    profit: -34.50,
    commission: 0.15,
    spread: 0.00005,
    swap: 0.02,
    status: 'open' as TradeStatus,
    strategy: 'Pivot_Points',
    aiConfidence: 55,
    marketCondition: 'range_bound' as MarketCondition,
    openedAt: new Date(Date.now() - 1000 * 60 * 20),
  },
  {
    symbol: 'XAUUSD' as Symbol,
    direction: 'BUY' as TradeDirection,
    lotSize: 0.03,
    entryPrice: 2382.50,
    currentPrice: 2395.80,
    stopLoss: 2370.00,
    takeProfit: 2410.00,
    isTrailingStop: true,
    pips: 133.0,
    profit: 39.90,
    commission: 0.03,
    spread: 0.05,
    swap: -0.15,
    status: 'open' as TradeStatus,
    strategy: 'RMI_Trend_Sync',
    aiConfidence: 85,
    marketCondition: 'trending' as MarketCondition,
    openedAt: new Date(Date.now() - 1000 * 60 * 60 * 2),
  },
  {
    symbol: 'EURUSD' as Symbol,
    direction: 'BUY' as TradeDirection,
    lotSize: 0.10,
    entryPrice: 1.08200,
    currentPrice: 1.08200,
    stopLoss: 1.08050,
    takeProfit: 1.08500,
    isTrailingStop: false,
    pips: 32.0,
    profit: 32.00,
    commission: 0.10,
    spread: 0.00005,
    swap: 0.01,
    status: 'closed' as TradeStatus,
    strategy: 'MA_Ribbon',
    aiConfidence: 68,
    marketCondition: 'trending' as MarketCondition,
    openedAt: new Date(Date.now() - 1000 * 60 * 60 * 6),
    closedAt: new Date(Date.now() - 1000 * 60 * 60 * 4),
  },
  {
    symbol: 'GBPUSD' as Symbol,
    direction: 'SELL' as TradeDirection,
    lotSize: 0.10,
    entryPrice: 1.27600,
    currentPrice: 1.27600,
    stopLoss: 1.27780,
    takeProfit: 1.27350,
    isTrailingStop: false,
    pips: -18.0,
    profit: -18.00,
    commission: 0.10,
    spread: 0.00005,
    swap: -0.01,
    status: 'closed' as TradeStatus,
    strategy: 'EMA_RSI_Filter',
    aiConfidence: 62,
    marketCondition: 'range_bound' as MarketCondition,
    openedAt: new Date(Date.now() - 1000 * 60 * 60 * 12),
    closedAt: new Date(Date.now() - 1000 * 60 * 60 * 10),
  },
];

function generateSampleBacktest(
  strategy: StrategyName,
  symbol: Symbol,
  name: string
) {
  const totalTrades = Math.floor(Math.random() * 151) + 50;
  const winRate = 55 + Math.random() * 17;
  const wins = Math.round(totalTrades * (winRate / 100));
  const losses = totalTrades - wins;

  const avgWinPips = 8 + Math.random() * 18;
  const avgLossPips = 5 + Math.random() * 10;
  const profitFactor = Math.round(((wins * avgWinPips) / (losses * avgLossPips)) * 100) / 100;
  const initialBalance = 10000;
  const maxDrawdown = 5 + Math.random() * 15;
  const sharpeRatio = 1.2 + Math.random() * 1.3;

  let equity = initialBalance;
  const equityCurve: { trade: number; equity: number }[] = [];
  const trades: any[] = [];

  let maxEq = initialBalance;
  for (let i = 0; i < totalTrades; i++) {
    const isWin = i < wins;
    const profit = isWin
      ? (avgWinPips * (0.5 + Math.random()) * 1)
      : -(avgLossPips * (0.5 + Math.random()) * 1);
    equity += profit;
    equity = Math.max(0, equity);
    if (equity > maxEq) maxEq = equity;
    equityCurve.push({ trade: i + 1, equity: Math.round(equity * 100) / 100 });
    trades.push({
      trade: i + 1,
      symbol,
      direction: Math.random() > 0.5 ? 'BUY' : 'SELL',
      pips: Math.round(profit * 10) / 10,
      profit: Math.round(profit * 100) / 100,
      equity: Math.round(equity * 100) / 100,
      isWin,
    });
  }

  const totalProfit = trades.filter((t) => t.isWin).reduce((s: number, t: any) => s + t.profit, 0);
  const totalLoss = Math.abs(trades.filter((t: any) => !t.isWin).reduce((s: number, t: any) => s + t.profit, 0));

  return {
    name,
    symbol,
    strategy,
    startDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
    endDate: new Date(),
    initialBalance,
    finalBalance: Math.round(equity * 100) / 100,
    totalTrades,
    winRate: Math.round(winRate * 10) / 10,
    profitFactor,
    maxDrawdown: Math.round(maxDrawdown * 100) / 100,
    sharpeRatio: Math.round(sharpeRatio * 100) / 100,
    totalProfit: Math.round(totalProfit * 100) / 100,
    totalLoss: Math.round(totalLoss * 100) / 100,
    avgWin: wins > 0 ? Math.round((totalProfit / wins) * 100) / 100 : 0,
    avgLoss: losses > 0 ? Math.round((totalLoss / losses) * 100) / 100 : 0,
    parameters: JSON.stringify({ strategy, symbol, timeframe: 'M5' }),
    trades: JSON.stringify(trades),
  };
}

export async function POST() {
  try {
    // Check if data already exists
    const existingAccount = await db.tradingAccount.findFirst();
    if (existingAccount) {
      return NextResponse.json<SeedResponse>({
        success: false,
        message: 'Database already seeded. Use a fresh database or clear existing data first.',
        data: {
          account: null,
          riskSettings: null,
          newsItems: 0,
          economicEvents: 0,
          indicatorConfigs: 0,
          trades: 0,
          backtestResults: 0,
        },
      });
    }

    // 1. Create trading account
    const account = await db.tradingAccount.create({
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
        dailyPnl: 60.48,
        totalPnl: 342.15,
        isAutoTrading: false,
      },
    });

    // 2. Create default risk settings
    const riskSettings = await db.riskSettings.create({
      data: {
        riskPerTrade: 0.5,
        stopLossPips: 10,
        takeProfitPips: 15,
        riskRewardRatio: 1.5,
        maxSimultaneousPositions: 3,
        dailyRiskLimit: 3.0,
        avoidMajorNews: true,
        dailyTargetPercent: 2.0,
        maxDailyTrades: 10,
      },
    });

    // 3. Create news items
    const newsItems = await db.newsItem.createMany({
      data: SAMPLE_NEWS.map((n) => ({
        source: n.source,
        title: n.title,
        summary: n.summary,
        category: n.category,
        impact: n.impact,
        currency: n.currency,
        publishedAt: n.publishedAt,
      })),
    });

    // 4. Create economic events
    const economicEvents = await db.economicEvent.createMany({
      data: ECONOMIC_EVENTS.map((e) => ({
        event: e.event,
        currency: e.currency,
        impact: e.impact,
        actual: e.actual,
        forecast: e.forecast,
        previous: e.previous,
        date: e.date,
      })),
    });

    // 5. Create indicator configs from INDICATOR_POOL (10 of the 30)
    const selectedIndicators = INDICATOR_POOL.slice(0, 10);
    const indicatorConfigs = await db.indicatorConfig.createMany({
      data: selectedIndicators.map((ind) => ({
        name: ind.name,
        category: ind.category,
        settings: JSON.stringify(ind.settings as unknown as Record<string, any>),
        isEnabled: true,
      })),
    });

    // 6. Create sample trades
    const tradesData = SAMPLE_TRADES.map((t) => ({
      accountId: account.id,
      symbol: t.symbol,
      direction: t.direction,
      lotSize: t.lotSize,
      entryPrice: t.entryPrice,
      currentPrice: t.currentPrice,
      stopLoss: t.stopLoss,
      takeProfit: t.takeProfit,
      isTrailingStop: t.isTrailingStop,
      pips: t.pips,
      profit: t.profit,
      commission: t.commission,
      spread: t.spread,
      swap: t.swap,
      status: t.status,
      strategy: t.strategy,
      aiConfidence: t.aiConfidence,
      marketCondition: t.marketCondition,
      openedAt: t.openedAt,
      closedAt: (t as any).closedAt ?? null,
    }));
    const trades = await db.trade.createMany({ data: tradesData });

    // 7. Create sample backtest results
    const bt1 = generateSampleBacktest('EMA_Crossover', 'EURUSD', 'EMA Cross - EURUSD Q2');
    const bt2 = generateSampleBacktest('MA_Ribbon', 'USDJPY', 'MA Ribbon - USDJPY Q2');
    const bt3 = generateSampleBacktest('RMI_Trend_Sync', 'XAUUSD', 'RMI Trend - XAUUSD Q2');

    const backtestResults = await db.backtestResult.createMany({
      data: [bt1, bt2, bt3],
    });

    return NextResponse.json<SeedResponse>({
      success: true,
      message: 'Database seeded successfully',
      data: {
        account: {
          id: account.id,
          balance: account.balance,
          equity: account.equity,
          accountType: account.accountType,
        },
        riskSettings: {
          id: riskSettings.id,
          riskPerTrade: riskSettings.riskPerTrade,
          stopLossPips: riskSettings.stopLossPips,
          takeProfitPips: riskSettings.takeProfitPips,
        },
        newsItems: newsItems.count,
        economicEvents: economicEvents.count,
        indicatorConfigs: indicatorConfigs.count,
        trades: trades.count,
        backtestResults: backtestResults.count,
      },
    });
  } catch (error) {
    console.error('Error seeding database:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to seed database',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
