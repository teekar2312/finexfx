import { createServer } from 'http';
import { Server } from 'socket.io';

const PORT = 3003;
const httpServer = createServer();
const io = new Server(httpServer, {
  // DO NOT change the path, it is used by Caddy to forward the request to the correct port
  path: '/',
  cors: { origin: '*' },
  pingTimeout: 60000,
  pingInterval: 25000,
});

httpServer.listen(PORT, () => {
  console.log(`Price feed service running on port ${PORT}`);
});

interface SymbolState {
  bid: number;
  ask: number;
  basePrice: number;
  high: number;
  low: number;
  prevClose: number;
}

const symbols: Record<string, SymbolState> = {
  EURUSD: { bid: 1.08420, ask: 1.08430, basePrice: 1.08425, high: 1.08450, low: 1.08400, prevClose: 1.08380 },
  USDJPY: { bid: 157.320, ask: 157.330, basePrice: 157.325, high: 157.500, low: 157.200, prevClose: 157.280 },
  GBPUSD: { bid: 1.27150, ask: 1.27160, basePrice: 1.27155, high: 1.27200, low: 1.27100, prevClose: 1.27080 },
  XAUUSD: { bid: 3285.50, ask: 3286.00, basePrice: 3285.75, high: 3290.00, low: 3280.00, prevClose: 3282.50 },
};

const pipSizes: Record<string, number> = {
  EURUSD: 0.0001,
  USDJPY: 0.01,
  GBPUSD: 0.0001,
  XAUUSD: 0.01,
};

const volatilities: Record<string, number> = {
  EURUSD: 0.00008,
  USDJPY: 0.05,
  GBPUSD: 0.00010,
  XAUUSD: 0.80,
};

function randomWalk(current: number, volatility: number): number {
  const change = (Math.random() - 0.49) * volatility * 2;
  return current + change;
}

function generateTick(sym: string): object {
  const s = symbols[sym];
  const pip = pipSizes[sym];
  const vol = volatilities[sym];

  const newBid = randomWalk(s.bid, vol);
  const spread = (0.5 + Math.random() * 1.5) * pip;
  const newAsk = newBid + spread;

  s.bid = newBid;
  s.ask = newAsk;
  s.high = Math.max(s.high, newAsk);
  s.low = Math.min(s.low, newBid);

  const mid = (newBid + newAsk) / 2;
  const change = mid - s.prevClose;
  const changePercent = (change / s.prevClose) * 100;

  return {
    symbol: sym,
    bid: parseFloat(newBid.toFixed(sym === 'XAUUSD' ? 2 : sym === 'USDJPY' ? 3 : 5)),
    ask: parseFloat(newAsk.toFixed(sym === 'XAUUSD' ? 2 : sym === 'USDJPY' ? 3 : 5)),
    spread: parseFloat((spread / pip).toFixed(1)),
    change: parseFloat(change.toFixed(sym === 'XAUUSD' ? 2 : sym === 'USDJPY' ? 3 : 5)),
    changePercent: parseFloat(changePercent.toFixed(4)),
    high: parseFloat(s.high.toFixed(sym === 'XAUUSD' ? 2 : sym === 'USDJPY' ? 3 : 5)),
    low: parseFloat(s.low.toFixed(sym === 'XAUUSD' ? 2 : sym === 'USDJPY' ? 3 : 5)),
    timestamp: Date.now(),
  };
}

function generateCandles(sym: string, count: number): object[] {
  const s = symbols[sym];
  const pip = pipSizes[sym];
  const vol = volatilities[sym];
  const now = Date.now();
  const candles = [];

  let price = s.prevClose - (Math.random() * vol * 50);
  for (let i = count - 1; i >= 0; i--) {
    const open = price;
    const close = randomWalk(open, vol * 3);
    const high = Math.max(open, close) + Math.random() * vol * 2;
    const low = Math.min(open, close) - Math.random() * vol * 2;
    const volume = Math.floor(1000 + Math.random() * 5000);

    candles.push({
      time: now - i * 60000,
      open: parseFloat(open.toFixed(sym === 'XAUUSD' ? 2 : sym === 'USDJPY' ? 3 : 5)),
      high: parseFloat(high.toFixed(sym === 'XAUUSD' ? 2 : sym === 'USDJPY' ? 3 : 5)),
      low: parseFloat(low.toFixed(sym === 'XAUUSD' ? 2 : sym === 'USDJPY' ? 3 : 5)),
      close: parseFloat(close.toFixed(sym === 'XAUUSD' ? 2 : sym === 'USDJPY' ? 3 : 5)),
      volume,
    });
    price = close;
  }
  return candles;
}

// 生成指标数据
function generateIndicators(sym: string): Record<string, number | string> {
  const s = symbols[sym];
  const mid = (s.bid + s.ask) / 2;
  const rsi = 35 + Math.random() * 30;
  const macd = (Math.random() - 0.5) * 0.001;
  const macdSignal = macd + (Math.random() - 0.5) * 0.0005;
  const stochK = 20 + Math.random() * 60;
  const stochD = stochK + (Math.random() - 0.5) * 10;
  const atr = volatilities[sym] * (15 + Math.random() * 10);
  const cci = (Math.random() - 0.5) * 200;
  const mfi = 30 + Math.random() * 40;
  const williamsR = -(Math.random() * 80);

  return {
    RSI_14: parseFloat(rsi.toFixed(2)),
    MACD_12_26_9: parseFloat(macd.toFixed(sym === 'XAUUSD' ? 2 : 5)),
    MACD_Signal: parseFloat(macdSignal.toFixed(sym === 'XAUUSD' ? 2 : 5)),
    MACD_Histogram: parseFloat((macd - macdSignal).toFixed(sym === 'XAUUSD' ? 2 : 5)),
    Stochastic_K: parseFloat(stochK.toFixed(2)),
    Stochastic_D: parseFloat(stochD.toFixed(2)),
    ATR_14: parseFloat(atr.toFixed(sym === 'XAUUSD' ? 2 : 5)),
    Bollinger_Upper: parseFloat((mid + atr * 2).toFixed(sym === 'XAUUSD' ? 2 : 5)),
    Bollinger_Middle: parseFloat(mid.toFixed(sym === 'XAUUSD' ? 2 : 5)),
    Bollinger_Lower: parseFloat((mid - atr * 2).toFixed(sym === 'XAUUSD' ? 2 : 5)),
    CCI_20: parseFloat(cci.toFixed(2)),
    MFI_14: parseFloat(mfi.toFixed(2)),
    Williams_R: parseFloat(williamsR.toFixed(2)),
    EMA_9: parseFloat((mid + (Math.random() - 0.5) * vol * 5).toFixed(sym === 'XAUUSD' ? 2 : 5)),
    EMA_21: parseFloat((mid + (Math.random() - 0.5) * vol * 10).toFixed(sym === 'XAUUSD' ? 2 : 5)),
    SMA_50: parseFloat((mid + (Math.random() - 0.5) * vol * 20).toFixed(sym === 'XAUUSD' ? 2 : 5)),
    SuperTrend: parseFloat((mid + (Math.random() - 0.5) * vol * 8).toFixed(sym === 'XAUUSD' ? 2 : 5)),
    OBV: Math.floor(Math.random() * 100000),
    Volume: Math.floor(1000 + Math.random() * 5000),
  Momentum: parseFloat(((Math.random() - 0.5) * vol * 10).toFixed(sym === 'XAUUSD' ? 2 : 5)),
    ROC_12: parseFloat(((Math.random() - 0.5) * 2).toFixed(4)),
    TSI: parseFloat(((Math.random() - 0.5) * 50).toFixed(2)),
  };
}

function detectMarketCondition(sym: string): string {
  const s = symbols[sym];
  const range = s.high - s.low;
  const vol = volatilities[sym];
  const rangeRatio = range / (vol * 30);
  const trendBias = Math.random();

  if (rangeRatio < 5) {
    return trendBias > 0.6 ? 'trending' : 'low_volatility';
  } else if (rangeRatio > 20) {
    return 'high_volatility';
  } else {
    return trendBias > 0.5 ? 'trending' : 'range_bound';
  }
}

function generateSignal(sym: string): object {
  const s = symbols[sym];
  const mid = (s.bid + s.ask) / 2;
  const pip = pipSizes[sym];
  const condition = detectMarketCondition(sym) as string;
  const strategies = ['MA_Ribbon', 'Momentum_Scalping', 'Pivot_Points', 'EMA_Crossover', 'RMI_Trend_Sync', 'Linear_Regression', 'EMA_RSI_Filter'];
  const strategy = strategies[Math.floor(Math.random() * strategies.length)];
  const direction = Math.random() > 0.5 ? 'BUY' : 'SELL';
  const confidence = 55 + Math.random() * 40;
  const slPips = 5 + Math.random() * 10;
  const tpPips = slPips * 1.5;

  const analysis = `AI Analysis for ${sym}:

Market Condition: ${condition}
Strategy: ${strategy}
Confidence: ${confidence.toFixed(1)}%

Key Factors:
- Central Bank Policy: ${Math.random() > 0.5 ? 'Hawkish stance detected, supporting ' + (direction === 'BUY' ? 'upward' : 'downward') + ' momentum' : 'Dovish signals with potential for rate cuts'}
- Economic Data: NFP approaching with ${Math.random() > 0.5 ? 'strong' : 'mixed'} labor market signals
- CPI Trend: ${Math.random() > 0.5 ? 'Inflation easing, supporting risk-on sentiment' : 'Sticky inflation may trigger policy tightening'}
- Geopolitical: ${Math.random() > 0.7 ? 'Elevated risk aversion due to geopolitical tensions' : 'Stable geopolitical environment'}
- Market Sentiment: ${confidence > 70 ? 'Strong bullish/bearish conviction' : 'Mixed signals, exercise caution'}
- Commodity Impact: ${sym === 'XAUUSD' ? 'Gold responding to USD strength and safe-haven demand' : 'Commodity prices ' + (Math.random() > 0.5 ? 'supporting' : 'weighing on') + ' currency movement'}`;

  return {
    id: `sig-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    symbol: sym,
    direction,
    confidence: parseFloat(confidence.toFixed(1)),
    strategy,
    marketCondition: condition,
    entryPrice: parseFloat(mid.toFixed(sym === 'XAUUSD' ? 2 : sym === 'USDJPY' ? 3 : 5)),
    stopLoss: parseFloat((direction === 'BUY' ? mid - slPips * pip : mid + slPips * pip).toFixed(sym === 'XAUUSD' ? 2 : sym === 'USDJPY' ? 3 : 5)),
    takeProfit: parseFloat((direction === 'BUY' ? mid + tpPips * pip : mid - tpPips * pip).toFixed(sym === 'XAUUSD' ? 2 : sym === 'USDJPY' ? 3 : 5)),
    riskReward: 1.5,
    aiAnalysis: analysis,
    isExecuted: false,
    createdAt: new Date().toISOString(),
  };
}

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Send initial state for all symbols
  const initialState = Object.keys(symbols).map(sym => generateTick(sym));
  socket.emit('prices', initialState);

  // Send initial candles for each symbol
  Object.keys(symbols).forEach(sym => {
    socket.emit(`candles:${sym}`, generateCandles(sym, 100));
    socket.emit(`indicators:${sym}`, generateIndicators(sym));
    socket.emit('signal', generateSignal(sym));
  });

  // Subscribe to specific symbol
  socket.on('subscribe', (symbol: string) => {
    socket.join(symbol);
  });

  socket.on('unsubscribe', (symbol: string) => {
    socket.leave(symbol);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Broadcast ticks every 500ms
setInterval(() => {
  const ticks = Object.keys(symbols).map(sym => generateTick(sym));
  io.emit('prices', ticks);
}, 500);

// Broadcast candles every 5 seconds
setInterval(() => {
  Object.keys(symbols).forEach(sym => {
    io.to(sym).emit(`candles:${sym}`, [generateCandles(sym, 1)[0]]);
  });
  // Also broadcast to all for main chart
  const mainSym = Object.keys(symbols)[0];
  io.emit(`candles:${mainSym}`, generateCandles(mainSym, 100));
}, 5000);

// Broadcast indicators every 3 seconds
setInterval(() => {
  Object.keys(symbols).forEach(sym => {
    io.emit(`indicators:${sym}`, generateIndicators(sym));
  });
}, 3000);

// Broadcast signals every 30 seconds
setInterval(() => {
 const sym = Object.keys(symbols)[Math.floor(Math.random() * Object.keys(symbols).length)];
  io.emit('signal', generateSignal(sym));
}, 30000);

// Broadcast market conditions every 10 seconds
setInterval(() => {
  const conditions: Record<string, string> = {};
  Object.keys(symbols).forEach(sym => {
    conditions[sym] = detectMarketCondition(sym);
  });
  io.emit('marketConditions', conditions);
}, 10000);
