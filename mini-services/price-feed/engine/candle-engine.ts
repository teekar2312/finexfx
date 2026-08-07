// ═══════════════════════════════════════════════════════════════════
// Candle Engine — Generates and manages OHLCV candle history.
// Produces smooth, realistic price action for charting.
// ═══════════════════════════════════════════════════════════════════════════════

import type { SymbolConfig, Candle } from '../types';
import { PriceEngine } from './price-engine';

const MAX_HISTORY = 200;
const HISTORY_COUNT = 100;

class CandleBuffer {
  candles: Candle[] = [];

  push(candle: Candle) {
    this.candles.push(candle);
    if (this.candles.length > MAX_HISTORY) {
      this.candles.shift();
    }
  }

  getAll(): Candle[] {
    return this.candles;
  }

  get(count: number): Candle[] {
    return this.candles.slice(-count);
  }
}

export class CandleEngine {
  private configs: Record<string, SymbolConfig>;
  private priceEngine: PriceEngine;
  private buffers: Record<string, CandleBuffer>;

  constructor(configs: Record<string, SymbolConfig>, priceEngine: PriceEngine) {
    this.configs = configs;
    this.priceEngine = priceEngine;
    this.buffers = {};

    // Initialize historical candles
    for (const [sym, cfg] of Object.entries(configs)) {
      this.buffers[sym] = new CandleBuffer();
      this.generateHistory(sym);
    }
  }

  /** Generate initial historical candles using a random walk */
  private generateHistory(sym: string) {
    const cfg = this.configs[sym];
    const state = this.priceEngine.getState(sym);
    const buffer = this.buffers[sym];
    const now = Date.now();

    // Walk backward from a reasonable starting price
    let price = state.prevClose - (Math.random() - 0.3) * cfg.volatility * 40;
    // Slowly trend toward the current price
    const targetPrice = state.bid;
    const steps = HISTORY_COUNT;

    for (let i = steps - 1; i >= 0; i--) {
      const progress = 1 - (i / steps);
      const trendPull = (targetPrice - price) * 0.01 * progress;

      const open = price;
      const direction = Math.random() > 0.48 ? 1 : -1;  // slight upward bias
      const bodySize = Math.abs(this.gaussianRandom()) * cfg.volatility * 2;
      const close = open + direction * bodySize + trendPull;
      const wickUp = Math.random() * cfg.volatility * 1.5;
      const wickDown = Math.random() * cfg.volatility * 1.5;
      const high = Math.max(open, close) + wickUp;
      const low = Math.min(open, close) - wickDown;
      const volume = Math.floor(800 + Math.random() * 6000);

      buffer.push({
        time: now - i * 60000,
        open: this.round(open, cfg.digits),
        high: this.round(high, cfg.digits),
        low: this.round(low, cfg.digits),
        close: this.round(close, cfg.digits),
        volume,
      });

      price = close;
    }
  }

  /** Generate the next candle from the current price engine state */
  generateNextCandle(sym: string): Candle | null {
    const cfg = this.configs[sym];
    const buffer = this.buffers[sym];

    // Read the candle state from price engine
    const candleData = this.priceEngine.getCandleClose(sym);

    const candle: Candle = {
      time: Date.now(),
      open: this.round(candleData.open, cfg.digits),
      high: this.round(candleData.high, cfg.digits),
      low: this.round(candleData.low, cfg.digits),
      close: this.round(candleData.close, cfg.digits),
      volume: candleData.volume,
    };

    buffer.push(candle);

    // Reset the price engine's candle tracking for the next period
    this.priceEngine.startNewCandle(sym);

    return candle;
  }

  /** Get historical candles (up to count) */
  getHistory(sym: string, count: number = 100): Candle[] {
    const buffer = this.buffers[sym];
    if (!buffer) return [];
    return buffer.get(Math.min(count, MAX_HISTORY));
  }

  private round(val: number, digits: number): number {
    return parseFloat(val.toFixed(digits));
  }

  private gaussianRandom(): number {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  }
}
