// ═══════════════════════════════════════════════════════════════════
// Alert Manager — Server-side price alert monitoring.
// Checks registered alerts on every tick and fires callbacks.
// ═══════════════════════════════════════════════════════════════════════════════

import type { PriceTick, PriceAlert } from '../types';
import { PriceEngine } from './price-engine';

interface RegisteredAlert extends PriceAlert {
  callback: (alert: PriceAlert) => void;
  socketId?: string;
}

export class AlertManager {
  private alerts: Map<string, RegisteredAlert> = new Map();
  private priceEngine: PriceEngine;
  private alertCount = 0;

  constructor(priceEngine: PriceEngine) {
    this.priceEngine = priceEngine;
  }

  /** Register a new price alert */
  addAlert(data: {
    symbol: string;
    condition: 'above' | 'below';
    price: number;
    message?: string;
    callback: (alert: PriceAlert) => void;
  }): string {
    this.alertCount++;
    const id = `alert-${Date.now()}-${this.alertCount}`;
    this.alerts.set(id, {
      id,
      symbol: data.symbol,
      condition: data.condition,
      price: data.price,
      message: data.message,
      isTriggered: false,
      callback: data.callback,
    });
    console.log(`[ALERT+] ${id}: ${data.symbol} ${data.condition} ${data.price}`);
    return id;
  }

  /** Remove a price alert */
  removeAlert(id: string): boolean {
    return this.alerts.delete(id);
  }

  /** Remove all alerts for a specific socket */
  removeAllForSocket(_socketId: string): number {
    let removed = 0;
    for (const [id, alert] of this.alerts) {
      if (alert.socketId === _socketId) {
        this.alerts.delete(id);
        removed++;
      }
    }
    return removed;
  }

  /** Get all registered alerts */
  getAlerts(): PriceAlert[] {
    return Array.from(this.alerts.values()).map(({ callback, socketId, ...rest }) => rest);
  }

  /** Check all alerts against current ticks */
  checkAlerts(ticks: PriceTick[]) {
    const tickMap = new Map<string, PriceTick>();
    for (const tick of ticks) {
      tickMap.set(tick.symbol, tick);
    }

    for (const [id, alert] of this.alerts) {
      if (alert.isTriggered) continue;

      const tick = tickMap.get(alert.symbol);
      if (!tick) continue;

      let triggered = false;
      const mid = (tick.bid + tick.ask) / 2;

      if (alert.condition === 'above' && mid >= alert.price) {
        triggered = true;
      } else if (alert.condition === 'below' && mid <= alert.price) {
        triggered = true;
      }

      if (triggered) {
        alert.isTriggered = true;
        alert.triggeredAt = new Date().toISOString();
        console.log(`[ALERT!] ${id}: ${alert.symbol} crossed ${alert.price}`);
        alert.callback({ ...alert });
        // Auto-remove triggered alerts after 30s
        setTimeout(() => this.alerts.delete(id), 30000);
      }
    }
  }
}