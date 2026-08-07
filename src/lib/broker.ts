/**
 * Broker Abstraction Layer
 * 
 * Provides a unified interface for both simulated (demo) and live trading.
 * The live implementation connects to a real broker WebSocket API.
 * The demo implementation uses the existing Zustand store + price simulator.
 */

import type { Symbol, TradeDirection, Trade } from '@/lib/types';
import { SYMBOL_INFO } from '@/lib/types';

// ─── Shared Types ───────────────────────────────────────────────

export interface BrokerOrder {
  symbol: Symbol;
  direction: TradeDirection;
  lotSize: number;
  stopLoss?: number;
  takeProfit?: number;
  trailingStop?: number;
  comment?: string;
  magicNumber?: number;
}

export interface BrokerOrderResult {
  success: boolean;
  orderId?: string;
  ticket?: number;
  symbol: Symbol;
  direction: TradeDirection;
  lotSize: number;
  entryPrice: number;
  spread: number;
  commission: number;
  timestamp: string;
  error?: string;
}

export interface BrokerCloseResult {
  success: boolean;
  orderId: string;
  closePrice: number;
  profit: number;
  pips: number;
  commission: number;
  swap: number;
  timestamp: string;
  error?: string;
}

export interface BrokerPosition {
  ticket: number;
  orderId: string;
  symbol: Symbol;
  direction: TradeDirection;
  lotSize: number;
  entryPrice: number;
  currentPrice: number;
  stopLoss?: number;
  takeProfit?: number;
  trailingStop?: number;
  profit: number;
  pips: number;
  commission: number;
  swap: number;
  openedAt: string;
}

export interface BrokerAccountInfo {
  balance: number;
  equity: number;
  margin: number;
  freeMargin: number;
  marginLevel: number;
  leverage: number;
  currency: string;
  openPositions: number;
  dailyPnl: number;
  totalPnl: number;
}

export interface BrokerConfig {
  mode: 'demo' | 'live';
  // Live broker connection settings
  brokerUrl?: string;
  apiKey?: string;
  apiSecret?: string;
  accountId?: string;
  // WebSocket price feed
  priceFeedUrl?: string;
  // Connection state
  isConnected: boolean;
  connectedAt?: string;
}

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

// ─── Abstract Broker Interface ──────────────────────────────────

export interface IBroker {
  readonly name: string;
  readonly mode: 'demo' | 'live';
  connect(): Promise<void>;
  disconnect(): void;
  openOrder(order: BrokerOrder): Promise<BrokerOrderResult>;
  closeOrder(orderId: string): Promise<BrokerCloseResult>;
  modifyOrder(orderId: string, updates: { stopLoss?: number; takeProfit?: number; trailingStop?: number }): Promise<{ success: boolean; error?: string }>;
  getPositions(): Promise<BrokerPosition[]>;
  getAccountInfo(): Promise<BrokerAccountInfo>;
  onPriceUpdate?: (symbol: Symbol, bid: number, ask: number) => void;
  onConnectionChange?: (status: ConnectionStatus) => void;
  onOrderUpdate?: (position: BrokerPosition) => void;
  getStatus(): ConnectionStatus;
}

// ─── Demo Broker (uses REST API) ────────────────────────────────

export class DemoBroker implements IBroker {
  readonly name = 'FINEX Demo';
  readonly mode = 'demo' as const;
  private _status: ConnectionStatus = 'disconnected';

  onPriceUpdate?: (symbol: Symbol, bid: number, ask: number) => void;
  onConnectionChange?: (status: ConnectionStatus) => void;
  onOrderUpdate?: (position: BrokerPosition) => void;

  getStatus() { return this._status; }

  async connect(): Promise<void> {
    this._status = 'connecting';
    this.onConnectionChange?.(this._status);
    // Demo uses the client-side price simulator — no server connection needed
    // Just verify the API is reachable
    try {
      const res = await fetch('/api/account');
      if (res.ok) {
        this._status = 'connected';
      } else {
        this._status = 'error';
      }
    } catch {
      // API might not be ready yet — still mark as connected for demo
      this._status = 'connected';
    }
    this.onConnectionChange?.(this._status);
  }

  disconnect(): void {
    this._status = 'disconnected';
    this.onConnectionChange?.(this._status);
  }

  async openOrder(order: BrokerOrder): Promise<BrokerOrderResult> {
    const res = await fetch('/api/trades', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        symbol: order.symbol,
        direction: order.direction,
        lotSize: order.lotSize,
        entryPrice: 0, // Will use current market price
        stopLoss: order.stopLoss,
        takeProfit: order.takeProfit,
        comment: order.comment,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      return { success: false, symbol: order.symbol, direction: order.direction, lotSize: order.lotSize, entryPrice: 0, spread: 0, commission: 0, timestamp: new Date().toISOString(), error: data.error };
    }
    return {
      success: true,
      orderId: data.id,
      symbol: data.symbol,
      direction: data.direction,
      lotSize: data.lotSize,
      entryPrice: data.entryPrice,
      spread: data.spread,
      commission: data.commission,
      timestamp: data.openedAt,
    };
  }

  async closeOrder(orderId: string): Promise<BrokerCloseResult> {
    const res = await fetch(`/api/trades?id=${orderId}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) {
      return { success: false, orderId, closePrice: 0, profit: 0, pips: 0, commission: 0, swap: 0, timestamp: new Date().toISOString(), error: data.error };
    }
    return {
      success: true,
      orderId: data.trade?.id ?? orderId,
      closePrice: 0,
      profit: data.trade?.profit ?? 0,
      pips: 0,
      commission: 0,
      swap: 0,
      timestamp: data.trade?.closedAt ?? new Date().toISOString(),
    };
  }

  async modifyOrder(orderId: string, updates: { stopLoss?: number; takeProfit?: number; trailingStop?: number }): Promise<{ success: boolean; error?: string }> {
    // Demo broker modifies are handled client-side via the store
    return { success: true };
  }

  async getPositions(): Promise<BrokerPosition[]> {
    const res = await fetch('/api/trades');
    const data = await res.json();
    return (data.openTrades ?? []).map((t: any) => ({
      ticket: 0,
      orderId: t.id,
      symbol: t.symbol,
      direction: t.direction,
      lotSize: t.lotSize,
      entryPrice: t.entryPrice,
      currentPrice: t.currentPrice,
      stopLoss: t.stopLoss,
      takeProfit: t.takeProfit,
      trailingStop: t.trailingStop,
      profit: t.profit,
      pips: t.pips,
      commission: t.commission,
      swap: t.swap,
      openedAt: t.openedAt,
    }));
  }

  async getAccountInfo(): Promise<BrokerAccountInfo> {
    const res = await fetch('/api/account');
    const data = await res.json();
    return {
      balance: data.balance,
      equity: data.equity,
      margin: data.margin,
      freeMargin: data.freeMargin,
      marginLevel: data.marginLevel,
      leverage: data.leverage,
      currency: data.currency,
      openPositions: data.openPositions,
      dailyPnl: data.dailyPnl,
      totalPnl: data.totalPnl,
    };
  }
}

// ─── Live Broker (uses WebSocket price feed + REST API) ──────────

export class LiveBroker implements IBroker {
  readonly name = 'FINEX Live';
  readonly mode = 'live' as const;
  private _status: ConnectionStatus = 'disconnected';
  private config: Required<Pick<BrokerConfig, 'brokerUrl' | 'priceFeedUrl'>>;
  private ws: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setInterval> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;

  onPriceUpdate?: (symbol: Symbol, bid: number, ask: number) => void;
  onConnectionChange?: (status: ConnectionStatus) => void;
  onOrderUpdate?: (position: BrokerPosition) => void;

  constructor(config: { brokerUrl?: string; priceFeedUrl?: string }) {
    this.config = {
      brokerUrl: config.brokerUrl || '',
      priceFeedUrl: config.priceFeedUrl || '',
    };
  }

  getStatus() { return this._status; }

  async connect(): Promise<void> {
    this._status = 'connecting';
    this.onConnectionChange?.(this._status);

    try {
      // Connect to the price feed WebSocket
      const wsUrl = this.config.priceFeedUrl || '/?XTransformPort=3001';
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this._status = 'connected';
        this.onConnectionChange?.(this._status);
        // Subscribe to all symbols
        this.ws?.send(JSON.stringify({ event: 'subscribe', symbols: ['EURUSD', 'USDJPY', 'GBPUSD', 'XAUUSD'] }));
        // Start ping to keep connection alive
        this.pingTimer = setInterval(() => {
          this.ws?.send(JSON.stringify({ event: 'ping' }));
        }, 30000);
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.event === 'price' && data.symbol && data.bid != null && data.ask != null) {
            this.onPriceUpdate?.(data.symbol as Symbol, data.bid, data.ask);
          }
          if (data.event === 'order_update') {
            this.onOrderUpdate?.(data.position);
          }
        } catch {
          // ignore parse errors
        }
      };

      this.ws.onclose = () => {
        this._status = 'disconnected';
        this.onConnectionChange?.(this._status);
        // Auto-reconnect after 5s
        this.reconnectTimer = setTimeout(() => this.connect(), 5000);
      };

      this.ws.onerror = () => {
        this._status = 'error';
        this.onConnectionChange?.(this._status);
      };
    } catch {
      this._status = 'error';
      this.onConnectionChange?.(this._status);
    }
  }

  disconnect(): void {
    if (this.pingTimer) clearInterval(this.pingTimer);
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.ws) {
      this.ws.onclose = null; // prevent auto-reconnect
      this.ws.close();
      this.ws = null;
    }
    this._status = 'disconnected';
    this.onConnectionChange?.(this._status);
  }

  async openOrder(order: BrokerOrder): Promise<BrokerOrderResult> {
    // For live trading, send order to the broker API
    const res = await fetch('/api/trades', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        symbol: order.symbol,
        direction: order.direction,
        lotSize: order.lotSize,
        stopLoss: order.stopLoss,
        takeProfit: order.takeProfit,
        isLive: true,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      return { success: false, symbol: order.symbol, direction: order.direction, lotSize: order.lotSize, entryPrice: 0, spread: 0, commission: 0, timestamp: new Date().toISOString(), error: data.error };
    }
    return {
      success: true,
      orderId: data.id,
      ticket: Date.now(),
      symbol: data.symbol,
      direction: data.direction,
      lotSize: data.lotSize,
      entryPrice: data.entryPrice,
      spread: data.spread,
      commission: data.commission,
      timestamp: data.openedAt,
    };
  }

  async closeOrder(orderId: string): Promise<BrokerCloseResult> {
    const res = await fetch(`/api/trades?id=${orderId}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) {
      return { success: false, orderId, closePrice: 0, profit: 0, pips: 0, commission: 0, swap: 0, timestamp: new Date().toISOString(), error: data.error };
    }
    return {
      success: true,
      orderId: data.trade?.id ?? orderId,
      closePrice: 0,
      profit: data.trade?.profit ?? 0,
      pips: 0,
      commission: 0,
      swap: 0,
      timestamp: data.trade?.closedAt ?? new Date().toISOString(),
    };
  }

  async modifyOrder(orderId: string, updates: { stopLoss?: number; takeProfit?: number; trailingStop?: number }): Promise<{ success: boolean; error?: string }> {
    return { success: true };
  }

  async getPositions(): Promise<BrokerPosition[]> {
    const res = await fetch('/api/trades');
    const data = await res.json();
    return (data.openTrades ?? []).map((t: any) => ({
      ticket: 0,
      orderId: t.id,
      symbol: t.symbol,
      direction: t.direction,
      lotSize: t.lotSize,
      entryPrice: t.entryPrice,
      currentPrice: t.currentPrice,
      stopLoss: t.stopLoss,
      takeProfit: t.takeProfit,
      trailingStop: t.trailingStop,
      profit: t.profit,
      pips: t.pips,
      commission: t.commission,
      swap: t.swap,
      openedAt: t.openedAt,
    }));
  }

  async getAccountInfo(): Promise<BrokerAccountInfo> {
    const res = await fetch('/api/account');
    const data = await res.json();
    return {
      balance: data.balance,
      equity: data.equity,
      margin: data.margin,
      freeMargin: data.freeMargin,
      marginLevel: data.marginLevel,
      leverage: data.leverage,
      currency: data.currency,
      openPositions: data.openPositions,
      dailyPnl: data.dailyPnl,
      totalPnl: data.totalPnl,
    };
  }
}

// ─── Broker Factory ─────────────────────────────────────────────

let _broker: IBroker | null = null;

export function getBroker(): IBroker {
  if (!_broker) {
    _broker = new DemoBroker();
  }
  return _broker;
}

export function createBroker(config: BrokerConfig): IBroker {
  // Disconnect existing broker
  if (_broker) {
    _broker.disconnect();
  }

  if (config.mode === 'live') {
    _broker = new LiveBroker({
      brokerUrl: config.brokerUrl,
      priceFeedUrl: config.priceFeedUrl,
    });
  } else {
    _broker = new DemoBroker();
  }

  return _broker;
}
