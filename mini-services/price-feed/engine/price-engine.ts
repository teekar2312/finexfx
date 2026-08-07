// ═══════════════════════════════════════════════════════════════════
// Price Engine — Realistic price simulation with mean-reversion,
// momentum, session-based volatility, and spread dynamics.
// ═══════════════════════════════════════════════════════════════════════════════

import type { SymbolConfig, SymbolState, PriceTick, MarketCondition } from '../types';

export class PriceEngine {
  private configs: Record<string, SymbolConfig>;
  private states: Record<string, SymbolState>;
  private sessionHigh: Record<string, number>;
  private sessionLow: Record<string, number>;
  private dayStart: number;

  constructor(configs: Record<string, SymbolConfig>) {
    this.configs = configs;
    this.states = {};
    this.sessionHigh = {};
    this.sessionLow = {};
    this.dayStart = this.getDayStart();

    for (const [sym, cfg] of Object.entries(configs)) {
      // Slight random offset from base price for natural starting point
      const offset = (Math.random() - 0.5) * cfg.volatility * 20;
      const price = cfg.basePrice + offset;
      const spread = this.calculateSpread(sym, 1.0);

      this.states[sym] = {
        bid: price,
        ask: price + spread,
        basePrice: cfg.basePrice,
        high: price,
        low: price,
        prevClose: cfg.prevClose,
        trendBias: (Math.random() - 0.5) * 0.3,  // slight initial bias
        momentum: 0,
        candleOpen: price,
        candleHigh: price,
        candleLow: price,
        candleVolume: 0,
      };
      this.sessionHigh[sym] = price + Math.random() * cfg.volatility * 30;
      this.sessionLow[sym] = price - Math.random() * cfg.volatility * 30;
    }
  }

  /** Generate a single tick with realistic micro-structure */
  private generateTick(
    sym: string,
    volatilityMult: number = 1.0,
    spreadMult: number = 1.0,
  ): PriceTick {
    const cfg = this.configs[sym];
    const s = this.states[sym];
    const vol = cfg.volatility * volatilityMult;

    // ── 1. Mean-reverting random walk ──────────────────────────────────
    // Pull toward base price (mean reversion) with configurable strength
    const meanReversionStrength = 0.002;
    const meanPull = (cfg.basePrice - s.bid) * meanReversionStrength;

    // ── 2. Momentum component ──────────────────────────────────────────
    // Accumulates small changes and decays over time (autocorrelation)
    const momentumFactor = 0.3;
    const momentumDecay = 0.95;
    s.momentum = s.momentum * momentumDecay;

    // ── 3. Trend bias drift ───────────────────────────────────────────
    // Slowly evolving bias for multi-minute trends
    if (Math.random() < 0.01) {
      s.trendBias += (Math.random() - 0.5) * 0.15;
      s.trendBias = Math.max(-0.6, Math.min(0.6, s.trendBias));
    }
    const trendDrift = s.trendBias * vol * 2;

    // ── 4. Random noise (Brownian motion) ─────────────────────────────
    const noise = this.gaussianRandom() * vol;

    // ── 5. Occasional micro-spikes (1-in-200 chance) ──────────────────
    let spike = 0;
    if (Math.random() < 0.005) {
      spike = (Math.random() > 0.5 ? 1 : -1) * vol * (3 + Math.random() * 8);
    }

    // ── Combine all components ────────────────────────────────────────
    const totalChange = meanPull + s.momentum + trendDrift + noise + spike;
    const newBid = s.bid + totalChange;

    // Update momentum
    s.momentum += totalChange * momentumFactor;

    // ── Spread dynamics ────────────────────────────────────────────────
    const spread = this.calculateSpread(sym, spreadMult);
    const newAsk = newBid + spread;

    // ── Update state ──────────────────────────────────────────────────
    s.bid = newBid;
    s.ask = newAsk;
    s.high = Math.max(s.high, newBid);
    s.low = Math.min(s.low, newBid);

    // Session high/low
    this.sessionHigh[sym] = Math.max(this.sessionHigh[sym], newBid);
    this.sessionLow[sym] = Math.min(this.sessionLow[sym], newBid);

    // Candle tracking
    s.candleHigh = Math.max(s.candleHigh, newBid);
    s.candleLow = Math.min(s.candleLow, newBid);
    s.candleVolume += Math.floor(50 + Math.random() * 200);

    // ── Calculate derived values ──────────────────────────────────────
    const mid = (newBid + newAsk) / 2;
    const change = mid - s.prevClose;
    const changePercent = (change / s.prevClose) * 100;

    return {
      symbol: sym,
      bid: parseFloat(newBid.toFixed(cfg.digits)),
      ask: parseFloat(newAsk.toFixed(cfg.digits)),
      spread: parseFloat((spread / cfg.pipSize).toFixed(1)),
      change: parseFloat(change.toFixed(cfg.digits)),
      changePercent: parseFloat(changePercent.toFixed(4)),
      high: parseFloat(this.sessionHigh[sym].toFixed(cfg.digits)),
      low: parseFloat(this.sessionLow[sym].toFixed(cfg.digits)),
      timestamp: Date.now(),
    };
  }

  /** Generate ticks for all symbols */
  generateAllTicks(volatilityMult: number = 1.0, spreadMult: number = 1.0): PriceTick[] {
    return Object.keys(this.configs).map(sym =>
      this.generateTick(sym, volatilityMult, spreadMult),
    );
  }

  /** Get a single tick for a specific symbol */
  getTick(sym: string): PriceTick {
    const cfg = this.configs[sym];
    const s = this.states[sym];
    const mid = (s.bid + s.ask) / 2;
    const change = mid - s.prevClose;
    const changePercent = (change / s.prevClose) * 100;
    const spread = s.ask - s.bid;
    return {
      symbol: sym,
      bid: parseFloat(s.bid.toFixed(cfg.digits)),
      ask: parseFloat(s.ask.toFixed(cfg.digits)),
      spread: parseFloat((spread / cfg.pipSize).toFixed(1)),
      change: parseFloat(change.toFixed(cfg.digits)),
      changePercent: parseFloat(changePercent.toFixed(4)),
      high: parseFloat(this.sessionHigh[sym].toFixed(cfg.digits)),
      low: parseFloat(this.sessionLow[sym].toFixed(cfg.digits)),
      timestamp: Date.now(),
    };
  }

  /** Get current tick data for all symbols (no mutation) */
  getAllTicks(): PriceTick[] {
    return Object.keys(this.configs).map(sym => this.getTick(sym));
  }

  /** Get current mid price for a symbol */
  getMidPrice(sym: string): number {
    const s = this.states[sym];
    return (s.bid + s.ask) / 2;
  }

  /** Get current state (for other engines to read) */
  getState(sym: string): SymbolState {
    return this.states[sym];
  }

  /** Get the config for a symbol */
  getConfig(sym: string): SymbolConfig {
    return this.configs[sym];
  }

  /** Detect market condition for a symbol */
  getMarketCondition(sym: string): MarketCondition {
    const s = this.states[sym];
    const cfg = this.configs[sym];
    const range = s.high - s.low;
    const expectedRange = cfg.volatility * 30;
    const rangeRatio = range / expectedRange;

    // Trend strength from trendBias
    const trendStrength = Math.abs(s.trendBias);

    if (rangeRatio > 20 || trendStrength > 0.4) {
      return 'high_volatility';
    }
    if (rangeRatio < 5 || trendStrength < 0.05) {
      return rangeRatio < 2 ? 'low_volatility' : 'range_bound';
    }
    return trendStrength > 0.15 ? 'trending' : 'range_bound';
  }

  /** Reset candle state for a new candle period */
  startNewCandle(sym: string) {
    const s = this.states[sym];
    s.candleOpen = s.bid;
    s.candleHigh = s.bid;
    s.candleLow = s.bid;
    s.candleVolume = 0;
  }

  /** Get candle close data for the current period */
  getCandleClose(sym: string): { open: number; high: number; low: number; close: number; volume: number } {
    const s = this.states[sym];
    return {
      open: s.candleOpen,
      high: s.candleHigh,
      low: s.candleLow,
      close: s.bid,
      volume: s.candleVolume,
    };
  }

  /** Reset daily highs/lows at start of new trading day */
  private getDayStart(): number {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).getTime();
  }

  /** Calculate realistic spread with some random variation */
  private calculateSpread(sym: string, multiplier: number = 1.0): number {
    const cfg = this.configs[sym];
    // Spread varies randomly around the base, with the multiplier
    const variation = 0.7 + Math.random() * 0.6; // 0.7 to 1.3x
    const spreadPips = cfg.baseSpreadPips * variation * multiplier;
    const clamped = Math.max(cfg.minSpreadPips, Math.min(cfg.maxSpreadPips, spreadPips));
    return clamped * cfg.pipSize;
  }

  /** Box-Muller Gaussian random number generator */
  private gaussianRandom(): number {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  }
}
