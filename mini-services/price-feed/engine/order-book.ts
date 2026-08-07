// ═══════════════════════════════════════════════════════
// Order Book Simulator — Generates realistic bid/ask depth.
// Shows 10 levels on each side with simulated order sizes.
// ═══════════════════════════════════════════════════════════════════

import type { SymbolConfig, OrderBookLevel, OrderBookSnapshot } from '../types';
import { PriceEngine } from './price-engine';

export class OrderBookSimulator {
  private configs: Record<string, SymbolConfig>;
  private priceEngine: PriceEngine;
  private levels = 10;

  constructor(configs: Record<string, SymbolConfig>, priceEngine: PriceEngine) {
    this.configs = configs;
    this.priceEngine = priceEngine;
  }

  /** Generate an order book snapshot for a symbol */
  getSnapshot(sym: string): OrderBookSnapshot {
    const cfg = this.configs[sym];
    const state = this.priceEngine.getState(sym);
    const mid = (state.bid + state.ask) / 2;
    const step = cfg.pipSize * (0.5 + Math.random() * 0.5); // half-pip to 1-pip spacing

    // ── Generate bid levels (below mid) ──────────────────────────────
    const bids: OrderBookLevel[] = [];
    let bidBase = state.bid;
    let bidVol = this.baseVolume(sym);
    for (let i = 0; i < this.levels; i++) {
      bidBase -= step * (0.8 + Math.random() * 0.4);
      bidVol *= (0.7 + Math.random() * 0.7); // exponentially thinning
      // Occasional large "wall"
      if (Math.random() < 0.05) bidVol *= 5 + Math.random() * 10;
      bids.push({
        price: parseFloat(bidBase.toFixed(cfg.digits)),
        volume: Math.floor(bidVol),
      });
    }

    // ── Generate ask levels (above mid) ──────────────────────────────
    const asks: OrderBookLevel[] = [];
    let askBase = state.ask;
    let askVol = this.baseVolume(sym);
    for (let i = 0; i < this.levels; i++) {
      askBase += step * (0.8 + Math.random() * 0.4);
      askVol *= (0.7 + Math.random() * 0.7);
      if (Math.random() < 0.05) askVol *= 5 + Math.random() * 10;
      asks.push({
        price: parseFloat(askBase.toFixed(cfg.digits)),
        volume: Math.floor(askVol),
      });
    }

    return {
      symbol: sym,
      bids,
      asks,
      spread: state.ask - state.bid,
      midPrice: parseFloat(mid.toFixed(cfg.digits)),
      timestamp: Date.now(),
    };
  }

  /** Update the order book (called every tick) */
  update(_sym: string) {
    // Order book is regenerated on each getSnapshot call, so no persistent state needed
  }

  /** Base volume depends on the symbol */
  private baseVolume(sym: string): number {
    switch (sym) {
      case 'EURUSD': return 500 + Math.floor(Math.random() * 3000);
      case 'USDJPY': return 400 + Math.floor(Math.random() * 2500);
      case 'GBPUSD': return 300 + Math.floor(Math.random() * 2000);
      case 'XAUUSD': return 50 + Math.floor(Math.random() * 500);
      default: return 500 + Math.floor(Math.random() * 2000);
    }
  }
}