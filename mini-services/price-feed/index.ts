// ═══════════════════════════════════════════════════════════════════════════════
// ForexPro Price Feed WebSocket Service (Port 3003)
// Production-grade real-time market data simulation with Socket.IO
// ═══════════════════════════════════════════════════════════════════════════════

import { createServer } from 'http';
import { Server } from 'socket.io';
import { PriceEngine } from './engine/price-engine';
import { IndicatorEngine } from './engine/indicator-engine';
import { SignalEngine } from './engine/signal-engine';
import { CandleEngine } from './engine/candle-engine';
import { SessionManager } from './engine/session-manager';
import { AlertManager } from './engine/alert-manager';
import { OrderBookSimulator } from './engine/order-book';
import type { SymbolConfig, PriceTick, TradingSignal, MarketCondition, ServerStats } from './types';

const PORT = 3003;

// ── HTTP + Socket.IO Server ─────────────────────────────────────────────────
const httpServer = createServer();

const io = new Server(httpServer, {
  // DO NOT change the path, it is used by Caddy to forward the request to the correct port
  path: '/',
  cors: { origin: '*' },
  pingTimeout: 60000,
  pingInterval: 25000,
  maxHttpBufferSize: 50 * 1024 * 1024,
  serveClient: false,
});

// ── Symbol Configuration ────────────────────────────────────────────────────
const SYMBOL_CONFIGS: Record<string, SymbolConfig> = {
  EURUSD: {
    name: 'EUR/USD',
    pipSize: 0.0001,
    digits: 5,
    basePrice: 1.08425,
    prevClose: 1.08380,
    volatility: 0.00008,
    baseSpreadPips: 0.8,
    maxSpreadPips: 3.5,
    minSpreadPips: 0.4,
    category: 'forex',
    baseCurrency: 'EUR',
    quoteCurrency: 'USD',
    lotSize: 100000,
    tickValue: 10,
  },
  USDJPY: {
    name: 'USD/JPY',
    pipSize: 0.01,
    digits: 3,
    basePrice: 157.325,
    prevClose: 157.280,
    volatility: 0.05,
    baseSpreadPips: 1.0,
    maxSpreadPips: 4.0,
    minSpreadPips: 0.5,
    category: 'forex',
    baseCurrency: 'USD',
    quoteCurrency: 'JPY',
    lotSize: 100000,
    tickValue: 6.5,
  },
  GBPUSD: {
    name: 'GBP/USD',
    pipSize: 0.0001,
    digits: 5,
    basePrice: 1.27155,
    prevClose: 1.27080,
    volatility: 0.00010,
    baseSpreadPips: 1.2,
    maxSpreadPips: 4.5,
    minSpreadPips: 0.6,
    category: 'forex',
    baseCurrency: 'GBP',
    quoteCurrency: 'USD',
    lotSize: 100000,
    tickValue: 10,
  },
  XAUUSD: {
    name: 'XAU/USD',
    pipSize: 0.01,
    digits: 2,
    basePrice: 3285.75,
    prevClose: 3282.50,
    volatility: 0.80,
    baseSpreadPips: 3.0,
    maxSpreadPips: 15.0,
    minSpreadPips: 1.5,
    category: 'metal',
    baseCurrency: 'XAU',
    quoteCurrency: 'USD',
    lotSize: 100,
    tickValue: 1,
  },
};

const SYMBOLS = Object.keys(SYMBOL_CONFIGS);

// ── Engine Initialization (order matters to avoid circular deps) ───────────────
const priceEngine = new PriceEngine(SYMBOL_CONFIGS);
const candleEngine = new CandleEngine(SYMBOL_CONFIGS, priceEngine);
const indicatorEngine = new IndicatorEngine(SYMBOL_CONFIGS, priceEngine);
indicatorEngine.setCandleEngine(candleEngine);
const signalEngine = new SignalEngine(SYMBOL_CONFIGS, priceEngine, indicatorEngine);
const sessionManager = new SessionManager();
const alertManager = new AlertManager(priceEngine);
const orderBook = new OrderBookSimulator(SYMBOL_CONFIGS, priceEngine);

// ── Server Stats ────────────────────────────────────────────────────────────
const startTime = Date.now();
let tickCount = 0;
let candlesGenerated = 0;
let signalsGenerated = 0;
let totalConnections = 0;
let disconnections = 0;

function getStats(): ServerStats {
  return {
    uptime: Date.now() - startTime,
    connectedClients: io.sockets.sockets.size,
    totalConnections,
    disconnections,
    tickCount,
    candlesGenerated,
    signalsGenerated,
    symbols: SYMBOLS,
    session: sessionManager.getCurrentSession(),
  };
}

// ── Socket Connection Handler ──────────────────────────────────────────────
io.on('connection', (socket) => {
  totalConnections++;
  console.log(`[CONNECT] ${socket.id} (total: ${io.sockets.sockets.size})`);

  // ── Send initial handshake ──────────────────────────────────────────────
  socket.emit('connected', {
    serverTime: Date.now(),
    sessionId: process.pid,
    symbols: SYMBOLS,
    session: sessionManager.getCurrentSession(),
    stats: getStats(),
  });

  // ── Initial state burst: prices for all symbols ─────────────────────────
  const initialPrices = priceEngine.getAllTicks();
  socket.emit('prices', initialPrices);

  // ── Initial candles for all symbols (100 candles each) ──────────────────
  for (const sym of SYMBOLS) {
    const candles = candleEngine.getHistory(sym, 100);
    socket.emit(`candles:${sym}`, candles);
    socket.emit(`indicators:${sym}`, indicatorEngine.getIndicators(sym));
    socket.emit('signal', signalEngine.generateSignal(sym));
    socket.emit(`orderbook:${sym}`, orderBook.getSnapshot(sym));
  }

  // ── Initial market conditions ───────────────────────────────────────────
  const conditions: Record<string, MarketCondition> = {};
  for (const sym of SYMBOLS) {
    conditions[sym] = priceEngine.getMarketCondition(sym);
  }
  socket.emit('marketConditions', conditions);

  // ── Subscribe to a specific symbol ─────────────────────────────────────
  socket.on('subscribe', (symbol: string) => {
    if (!SYMBOLS.includes(symbol)) {
      socket.emit('error', { code: 'INVALID_SYMBOL', message: `Unknown symbol: ${symbol}` });
      return;
    }
    socket.join(symbol);
    // Send current state for this symbol immediately
    socket.emit(`candles:${symbol}`, candleEngine.getHistory(symbol, 100));
    socket.emit(`indicators:${symbol}`, indicatorEngine.getIndicators(symbol));
    socket.emit(`orderbook:${symbol}`, orderBook.getSnapshot(symbol));
    console.log(`[SUB] ${socket.id} -> ${symbol}`);
  });

  // ── Unsubscribe from a symbol ───────────────────────────────────────────
  socket.on('unsubscribe', (symbol: string) => {
    socket.leave(symbol);
    console.log(`[UNSUB] ${socket.id} <- ${symbol}`);
  });

  // ── Request historical candles on demand ────────────────────────────────
  socket.on('request:candles', (data: { symbol: string; count?: number; timeframe?: string }) => {
    const { symbol, count = 200, timeframe = 'M1' } = data;
    if (!SYMBOLS.includes(symbol)) {
      socket.emit('error', { code: 'INVALID_SYMBOL', message: `Unknown symbol: ${symbol}` });
      return;
    }
    const candles = candleEngine.getHistory(symbol, Math.min(count, 500));
    socket.emit(`candles:${symbol}`, candles);
  });

  // ── Request indicators for a symbol ─────────────────────────────────────
  socket.on('request:indicators', (symbol: string) => {
    if (!SYMBOLS.includes(symbol)) {
      socket.emit('error', { code: 'INVALID_SYMBOL', message: `Unknown symbol: ${symbol}` });
      return;
    }
    socket.emit(`indicators:${symbol}`, indicatorEngine.getIndicators(symbol));
  });

  // ── Request order book snapshot ─────────────────────────────────────────
  socket.on('request:orderbook', (symbol: string) => {
    if (!SYMBOLS.includes(symbol)) {
      socket.emit('error', { code: 'INVALID_SYMBOL', message: `Unknown symbol: ${symbol}` });
      return;
    }
    socket.emit(`orderbook:${symbol}`, orderBook.getSnapshot(symbol));
  });

  // ── Request server stats ────────────────────────────────────────────────
  socket.on('request:stats', () => {
    socket.emit('stats', getStats());
  });

  // ── Price alert registration (server-side) ──────────────────────────────
  socket.on('alert:add', (data: { symbol: string; condition: 'above' | 'below'; price: number; message?: string }) => {
    const alertId = alertManager.addAlert({
      ...data,
      callback: (triggeredAlert) => {
        socket.emit('alert:triggered', triggeredAlert);
      },
    });
    socket.emit('alert:added', { id: alertId, symbol: data.symbol, condition: data.condition, price: data.price });
  });

  socket.on('alert:remove', (alertId: string) => {
    alertManager.removeAlert(alertId);
    socket.emit('alert:removed', { id: alertId });
  });

  socket.on('alert:list', () => {
    socket.emit('alert:list', alertManager.getAlerts());
  });

  // ── Disconnect ──────────────────────────────────────────────────────────
  socket.on('disconnect', (reason) => {
    disconnections++;
    alertManager.removeAllForSocket(socket.id);
    console.log(`[DISCONNECT] ${socket.id} reason=${reason} (total: ${io.sockets.sockets.size})`);
  });
});

// ── Tick Broadcast (500ms) ──────────────────────────────────────────────────
const TICK_INTERVAL_MS = 500;
setInterval(() => {
  const session = sessionManager.getCurrentSession();
  const volatilityMultiplier = sessionManager.getVolatilityMultiplier();
  const spreadMultiplier = sessionManager.getSpreadMultiplier();

  const ticks = priceEngine.generateAllTicks(volatilityMultiplier, spreadMultiplier);
  tickCount += ticks.length;

  // Broadcast to all clients
  io.emit('prices', ticks);

  // Update order book
  for (const sym of SYMBOLS) {
    orderBook.update(sym);
    // Broadcast order book to subscribed rooms only
    const snapshot = orderBook.getSnapshot(sym);
    io.to(sym).emit(`orderbook:${sym}`, snapshot);
  }

  // Check price alerts
  alertManager.checkAlerts(ticks);
}, TICK_INTERVAL_MS);

// ── Candle Broadcast (5s) ───────────────────────────────────────────────────
const CANDLE_INTERVAL_MS = 5000;
setInterval(() => {
  for (const sym of SYMBOLS) {
    // Generate a new candle and append
    const newCandle = candleEngine.generateNextCandle(sym);
    if (newCandle) {
      candlesGenerated++;
      // Send single new candle to subscribed rooms
      io.to(sym).emit(`candles:${sym}`, [newCandle]);
      // Also send full history to all (for main chart defaulting to EURUSD)
      if (sym === SYMBOLS[0]) {
        io.emit(`candles:${sym}`, candleEngine.getHistory(sym, 100));
      }
    }
  }
}, CANDLE_INTERVAL_MS);

// ── Indicator Broadcast (3s) ────────────────────────────────────────────────
const INDICATOR_INTERVAL_MS = 3000;
setInterval(() => {
  for (const sym of SYMBOLS) {
    const indicators = indicatorEngine.calculateIndicators(sym);
    io.emit(`indicators:${sym}`, indicators);
  }
}, INDICATOR_INTERVAL_MS);

// ── Signal Broadcast (30s) ─────────────────────────────────────────────────
const SIGNAL_INTERVAL_MS = 30000;
setInterval(() => {
  const sym = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
  const signal = signalEngine.generateSignal(sym);
  signalsGenerated++;
  io.emit('signal', signal);
}, SIGNAL_INTERVAL_MS);

// ── Market Conditions Broadcast (10s) ──────────────────────────────────────
const CONDITION_INTERVAL_MS = 10000;
setInterval(() => {
  const conditions: Record<string, MarketCondition> = {};
  for (const sym of SYMBOLS) {
    conditions[sym] = priceEngine.getMarketCondition(sym);
  }
  io.emit('marketConditions', conditions);
}, CONDITION_INTERVAL_MS);

// ── Server Stats Broadcast (60s) ───────────────────────────────────────────
const STATS_INTERVAL_MS = 60000;
setInterval(() => {
  io.emit('stats', getStats());
}, STATS_INTERVAL_MS);

// ── Session Transition Events (1s check) ───────────────────────────────────
let lastSessionName = '';
setInterval(() => {
  const session = sessionManager.getCurrentSession();
  if (session.name !== lastSessionName) {
    console.log(`[SESSION] ${lastSessionName || 'none'} -> ${session.name} (volatility x${session.volatilityMultiplier.toFixed(2)})`);
    io.emit('session:change', session);
    lastSessionName = session.name;
  }
}, 1000);

// ── Start Server ────────────────────────────────────────────────────────────
httpServer.listen(PORT, () => {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  ForexPro Price Feed Service`);
  console.log(`  Port: ${PORT}`);
  console.log(`  Symbols: ${SYMBOLS.join(', ')}`);
  console.log(`  Session: ${sessionManager.getCurrentSession().name}`);
  console.log(`  Tick rate: ${1000 / TICK_INTERVAL_MS} Hz`);
  console.log(`  Stats: available via socket event 'request:stats'`);
  console.log('═══════════════════════════════════════════════════════════════');
});

// ── Graceful Shutdown ──────────────────────────────────────────────────────
process.on('SIGTERM', () => {
  console.log('[SHUTDOWN] SIGTERM received, closing server...');
  io.close();
  httpServer.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5000);
});

process.on('SIGINT', () => {
  console.log('[SHUTDOWN] SIGINT received, closing server...');
  io.close();
  httpServer.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5000);
});

process.on('uncaughtException', (err) => {
  console.error('[FATAL] Uncaught exception:', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('[FATAL] Unhandled rejection:', reason);
});

export { io, priceEngine, candleEngine, indicatorEngine, signalEngine, sessionManager };
