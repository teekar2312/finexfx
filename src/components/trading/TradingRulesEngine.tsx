'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTradingStore } from '@/store/trading-store';
import { SYMBOLS, SYMBOL_INFO, type Symbol, type TradeDirection } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Zap,
  Plus,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Play,
  Pause,
  Settings,
  Bell,
  Shield,
  Target,
  Copy,
} from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────

type ConditionType =
  | 'price_crosses_above'
  | 'price_crosses_below'
  | 'rsi_overbought'
  | 'rsi_oversold'
  | 'macd_crossover'
  | 'pips_profit'
  | 'pips_loss'
  | 'spread_exceeds'
  | 'max_positions'
  | 'daily_loss_percent';

type ActionType =
  | 'notify'
  | 'close_symbol_positions'
  | 'close_all_positions'
  | 'disable_trading'
  | 'open_trade'
  | 'modify_risk';

interface ConditionParams {
  symbol?: Symbol;
  level?: number;
  rsiThreshold?: number;
  rsiType?: 'overbought' | 'oversold';
  pipCount?: number;
  spreadPips?: number;
  positionCount?: number;
  lossPercent?: number;
}

interface ActionParams {
  symbol?: Symbol;
  direction?: TradeDirection;
  lotSize?: number;
  riskPerTrade?: number;
  stopLossPips?: number;
  takeProfitPips?: number;
  message?: string;
}

interface TradingRule {
  id: string;
  name: string;
  conditionType: ConditionType;
  conditionParams: ConditionParams;
  actionType: ActionType;
  actionParams: ActionParams;
  enabled: boolean;
  triggerCount: number;
  lastTriggeredAt: number | null;
  createdAt: number;
}

// ── Constants ────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'finex-trading-rules';
const COOLDOWN_MS = 60_000;

const CONDITION_LABELS: Record<ConditionType, string> = {
  price_crosses_above: 'Price Crosses Above Level',
  price_crosses_below: 'Price Crosses Below Level',
  rsi_overbought: 'RSI Overbought',
  rsi_oversold: 'RSI Oversold',
  macd_crossover: 'MACD Crossover',
  pips_profit: 'Pips Profit Reached',
  pips_loss: 'Pips Loss Reached',
  spread_exceeds: 'Spread Exceeds Threshold',
  max_positions: 'Max Open Positions',
  daily_loss_percent: 'Daily Loss Exceeds %',
};

const ACTION_LABELS: Record<ActionType, string> = {
  notify: 'Send Notification',
  close_symbol_positions: 'Close Positions (Symbol)',
  close_all_positions: 'Close All Positions',
  disable_trading: 'Disable Trading',
  open_trade: 'Open Trade',
  modify_risk: 'Modify Risk Settings',
};

const CONDITION_OPTIONS: { value: ConditionType; label: string }[] = [
  { value: 'price_crosses_above', label: 'Price Crosses Above Level' },
  { value: 'price_crosses_below', label: 'Price Crosses Below Level' },
  { value: 'rsi_overbought', label: 'RSI Overbought (>70)' },
  { value: 'rsi_oversold', label: 'RSI Oversold (<30)' },
  { value: 'macd_crossover', label: 'MACD Crossover' },
  { value: 'pips_profit', label: 'Pips Profit Reached' },
  { value: 'pips_loss', label: 'Pips Loss Reached' },
  { value: 'spread_exceeds', label: 'Spread Exceeds Threshold' },
  { value: 'max_positions', label: 'Max Open Positions' },
  { value: 'daily_loss_percent', label: 'Daily Loss Exceeds %' },
];

const ACTION_OPTIONS: { value: ActionType; label: string }[] = [
  { value: 'notify', label: 'Send Notification (Alert)' },
  { value: 'close_symbol_positions', label: 'Close Positions for Symbol' },
  { value: 'close_all_positions', label: 'Close All Positions' },
  { value: 'disable_trading', label: 'Disable Trading' },
  { value: 'open_trade', label: 'Open Trade (BUY/SELL)' },
  { value: 'modify_risk', label: 'Modify Risk Settings' },
];

const RULE_TEMPLATES: Omit<TradingRule, 'id' | 'createdAt'>[] = [
  {
    name: 'RSI Overbought Alert',
    conditionType: 'rsi_overbought',
    conditionParams: { rsiThreshold: 70, rsiType: 'overbought' },
    actionType: 'notify',
    actionParams: { message: 'RSI is overbought (>70)' },
    enabled: true,
    triggerCount: 0,
    lastTriggeredAt: null,
  },
  {
    name: 'Emergency Stop',
    conditionType: 'daily_loss_percent',
    conditionParams: { lossPercent: 5 },
    actionType: 'close_all_positions',
    actionParams: {},
    enabled: true,
    triggerCount: 0,
    lastTriggeredAt: null,
  },
  {
    name: 'Spread Guard',
    conditionType: 'spread_exceeds',
    conditionParams: { spreadPips: 5 },
    actionType: 'disable_trading',
    actionParams: {},
    enabled: true,
    triggerCount: 0,
    lastTriggeredAt: null,
  },
  {
    name: 'Take Profit All',
    conditionType: 'daily_loss_percent',
    conditionParams: { lossPercent: -3 },
    actionType: 'close_all_positions',
    actionParams: {},
    enabled: false,
    triggerCount: 0,
    lastTriggeredAt: null,
  },
  {
    name: 'Max Exposure',
    conditionType: 'max_positions',
    conditionParams: { positionCount: 5 },
    actionType: 'notify',
    actionParams: { message: 'Maximum exposure limit reached' },
    enabled: true,
    triggerCount: 0,
    lastTriggeredAt: null,
  },
  {
    name: 'Gold Breakout',
    conditionType: 'price_crosses_above',
    conditionParams: { symbol: 'XAUUSD', level: 2450 },
    actionType: 'notify',
    actionParams: { message: 'XAUUSD broke above 2450!' },
    enabled: true,
    triggerCount: 0,
    lastTriggeredAt: null,
  },
  {
    name: 'JPY Weakness',
    conditionType: 'price_crosses_above',
    conditionParams: { symbol: 'USDJPY', level: 155 },
    actionType: 'notify',
    actionParams: { message: 'USDJPY above 155 — JPY weakening' },
    enabled: true,
    triggerCount: 0,
    lastTriggeredAt: null,
  },
  {
    name: 'Equity Protection',
    conditionType: 'daily_loss_percent',
    conditionParams: { lossPercent: 5 },
    actionType: 'notify',
    actionParams: { message: 'Equity below 95% of balance — caution!' },
    enabled: true,
    triggerCount: 0,
    lastTriggeredAt: null,
  },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function describeCondition(rule: TradingRule): string {
  const p = rule.conditionParams;
  switch (rule.conditionType) {
    case 'price_crosses_above':
      return `${p.symbol ?? 'ANY'} bid > ${p.level?.toFixed(p.symbol ? SYMBOL_INFO[p.symbol].digits : 4) ?? '?'}`;
    case 'price_crosses_below':
      return `${p.symbol ?? 'ANY'} bid < ${p.level?.toFixed(p.symbol ? SYMBOL_INFO[p.symbol].digits : 4) ?? '?'}`;
    case 'rsi_overbought':
      return `RSI > ${p.rsiThreshold ?? 70}${p.symbol ? ` on ${p.symbol}` : ''}`;
    case 'rsi_oversold':
      return `RSI < ${p.rsiThreshold ?? 30}${p.symbol ? ` on ${p.symbol}` : ''}`;
    case 'macd_crossover':
      return `MACD crosses signal${p.symbol ? ` on ${p.symbol}` : ''}`;
    case 'pips_profit':
      return `Profit >= ${p.pipCount ?? '?'} pips${p.symbol ? ` on ${p.symbol}` : ''}`;
    case 'pips_loss':
      return `Loss >= ${p.pipCount ?? '?'} pips${p.symbol ? ` on ${p.symbol}` : ''}`;
    case 'spread_exceeds':
      return `Spread > ${p.spreadPips ?? '?'} pips`;
    case 'max_positions':
      return `Open positions >= ${p.positionCount ?? '?'}`;
    case 'daily_loss_percent':
      return `Daily loss > ${Math.abs(p.lossPercent ?? 0)}%`;
    default:
      return rule.conditionType;
  }
}

function describeAction(rule: TradingRule): string {
  const p = rule.actionParams;
  switch (rule.actionType) {
    case 'notify':
      return `🔔 ${p.message ?? 'Alert'}`;
    case 'close_symbol_positions':
      return `Close all ${p.symbol ?? 'all symbol'} positions`;
    case 'close_all_positions':
      return 'Close ALL open positions';
    case 'disable_trading':
      return 'Disable auto trading';
    case 'open_trade':
      return `${p.direction ?? 'BUY'} ${p.symbol ?? '?'} @ ${p.lotSize ?? 0.01} lot`;
    case 'modify_risk':
      return `Set risk: ${p.riskPerTrade ?? '?'}% / SL ${p.stopLossPips ?? '?'} / TP ${p.takeProfitPips ?? '?'}`;
    default:
      return rule.actionType;
  }
}

// ── Condition Parameter Fields ───────────────────────────────────────────────

function ConditionParamsForm({
  conditionType,
  params,
  onChange,
}: {
  conditionType: ConditionType;
  params: ConditionParams;
  onChange: (p: ConditionParams) => void;
}) {
  const needsSymbol = ['price_crosses_above', 'price_crosses_below', 'rsi_overbought', 'rsi_oversold', 'macd_crossover', 'pips_profit', 'pips_loss'].includes(conditionType);
  const needsLevel = ['price_crosses_above', 'price_crosses_below'].includes(conditionType);
  const needsRsiThreshold = ['rsi_overbought', 'rsi_oversold'].includes(conditionType);
  const needsPipCount = ['pips_profit', 'pips_loss'].includes(conditionType);
  const needsSpreadPips = conditionType === 'spread_exceeds';
  const needsPositionCount = conditionType === 'max_positions';
  const needsLossPercent = conditionType === 'daily_loss_percent';

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
      {needsSymbol && (
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Symbol</Label>
          <Select
            value={params.symbol ?? 'EURUSD'}
            onValueChange={(v) => onChange({ ...params, symbol: v as Symbol })}
          >
            <SelectTrigger className="h-8 text-xs font-mono">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="EURUSD">EURUSD</SelectItem>
              <SelectItem value="USDJPY">USDJPY</SelectItem>
              <SelectItem value="GBPUSD">GBPUSD</SelectItem>
              <SelectItem value="XAUUSD">XAUUSD</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}
      {needsLevel && (
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Price Level</Label>
          <Input
            type="number"
            step="any"
            className="h-8 text-xs font-mono"
            value={params.level ?? ''}
            onChange={(e) => onChange({ ...params, level: parseFloat(e.target.value) || 0 })}
            placeholder="1.0900"
          />
        </div>
      )}
      {needsRsiThreshold && (
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">
            RSI Threshold {conditionType === 'rsi_overbought' ? '(default 70)' : '(default 30)'}
          </Label>
          <Input
            type="number"
            className="h-8 text-xs font-mono"
            value={params.rsiThreshold ?? ''}
            onChange={(e) =>
              onChange({
                ...params,
                rsiThreshold: parseFloat(e.target.value) || (conditionType === 'rsi_overbought' ? 70 : 30),
              })
            }
            placeholder={conditionType === 'rsi_overbought' ? '70' : '30'}
          />
        </div>
      )}
      {needsPipCount && (
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Pip Count</Label>
          <Input
            type="number"
            className="h-8 text-xs font-mono"
            value={params.pipCount ?? ''}
            onChange={(e) => onChange({ ...params, pipCount: parseInt(e.target.value) || 0 })}
            placeholder="50"
          />
        </div>
      )}
      {needsSpreadPips && (
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Spread (pips)</Label>
          <Input
            type="number"
            className="h-8 text-xs font-mono"
            value={params.spreadPips ?? ''}
            onChange={(e) => onChange({ ...params, spreadPips: parseFloat(e.target.value) || 0 })}
            placeholder="5"
          />
        </div>
      )}
      {needsPositionCount && (
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Position Count</Label>
          <Input
            type="number"
            className="h-8 text-xs font-mono"
            value={params.positionCount ?? ''}
            onChange={(e) => onChange({ ...params, positionCount: parseInt(e.target.value) || 0 })}
            placeholder="5"
          />
        </div>
      )}
      {needsLossPercent && (
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Loss %</Label>
          <Input
            type="number"
            className="h-8 text-xs font-mono"
            value={params.lossPercent ?? ''}
            onChange={(e) => onChange({ ...params, lossPercent: parseFloat(e.target.value) || 5 })}
            placeholder="5"
          />
        </div>
      )}
    </div>
  );
}

// ── Action Parameter Fields ──────────────────────────────────────────────────

function ActionParamsForm({
  actionType,
  params,
  onChange,
}: {
  actionType: ActionType;
  params: ActionParams;
  onChange: (p: ActionParams) => void;
}) {
  const needsSymbol = ['close_symbol_positions', 'open_trade'].includes(actionType);
  const needsDirection = actionType === 'open_trade';
  const needsLotSize = actionType === 'open_trade';
  const needsMessage = actionType === 'notify';
  const needsRisk = actionType === 'modify_risk';

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
      {needsSymbol && (
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Symbol</Label>
          <Select
            value={params.symbol ?? 'EURUSD'}
            onValueChange={(v) => onChange({ ...params, symbol: v as Symbol })}
          >
            <SelectTrigger className="h-8 text-xs font-mono">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="EURUSD">EURUSD</SelectItem>
              <SelectItem value="USDJPY">USDJPY</SelectItem>
              <SelectItem value="GBPUSD">GBPUSD</SelectItem>
              <SelectItem value="XAUUSD">XAUUSD</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}
      {needsDirection && (
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Direction</Label>
          <Select
            value={params.direction ?? 'BUY'}
            onValueChange={(v) => onChange({ ...params, direction: v as TradeDirection })}
          >
            <SelectTrigger className="h-8 text-xs font-mono">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="BUY">BUY</SelectItem>
              <SelectItem value="SELL">SELL</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}
      {needsLotSize && (
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Lot Size</Label>
          <Input
            type="number"
            step="0.01"
            className="h-8 text-xs font-mono"
            value={params.lotSize ?? ''}
            onChange={(e) => onChange({ ...params, lotSize: parseFloat(e.target.value) || 0.01 })}
            placeholder="0.01"
          />
        </div>
      )}
      {needsMessage && (
        <div className="space-y-1 sm:col-span-2">
          <Label className="text-xs text-muted-foreground">Alert Message</Label>
          <Input
            className="h-8 text-xs"
            value={params.message ?? ''}
            onChange={(e) => onChange({ ...params, message: e.target.value })}
            placeholder="Alert message..."
          />
        </div>
      )}
      {needsRisk && (
        <>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Risk %</Label>
            <Input
              type="number"
              step="0.1"
              className="h-8 text-xs font-mono"
              value={params.riskPerTrade ?? ''}
              onChange={(e) => onChange({ ...params, riskPerTrade: parseFloat(e.target.value) || 0.5 })}
              placeholder="0.5"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Stop Loss (pips)</Label>
            <Input
              type="number"
              className="h-8 text-xs font-mono"
              value={params.stopLossPips ?? ''}
              onChange={(e) => onChange({ ...params, stopLossPips: parseInt(e.target.value) || 10 })}
              placeholder="10"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Take Profit (pips)</Label>
            <Input
              type="number"
              className="h-8 text-xs font-mono"
              value={params.takeProfitPips ?? ''}
              onChange={(e) => onChange({ ...params, takeProfitPips: parseInt(e.target.value) || 15 })}
              placeholder="15"
            />
          </div>
        </>
      )}
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function TradingRulesEngine() {
  // Visual state (triggers re-render for UI)
  const [rules, setRules] = useState<TradingRule[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [showForm, setShowForm] = useState(false);
  const [newRule, setNewRule] = useState<Partial<TradingRule>>({
    name: '',
    conditionType: 'price_crosses_above',
    conditionParams: { symbol: 'EURUSD', level: 1.09 },
    actionType: 'notify',
    actionParams: { message: 'Rule triggered' },
  });

  // Ref for rules used in tick evaluation (avoids re-render)
  const rulesRef = useRef<TradingRule[]>(rules);

  // Keep ref in sync with state
  useEffect(() => {
    rulesRef.current = rules;
  }, [rules]);

  // Persist to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(rules));
    } catch {
      // Storage full or unavailable
    }
  }, [rules]);

  // Track previous prices for cross detection
  const prevPricesRef = useRef<Record<string, number>>({});
  const prevMacdRef = useRef<Record<string, number>>({});
  const prevMacdSignalRef = useRef<Record<string, number>>({});

  // Store actions
  const addNotification = useTradingStore((s) => s.addNotification);
  const closeTrade = useTradingStore((s) => s.closeTrade);
  const setAutoTrading = useTradingStore((s) => s.setAutoTrading);
  const addTrade = useTradingStore((s) => s.addTrade);
  const setRiskSettings = useTradingStore((s) => s.setRiskSettings);

  // Store data for evaluation
  const prices = useTradingStore((s) => s.prices);
  const indicatorValues = useTradingStore((s) => s.indicatorValues);
  const openTrades = useTradingStore((s) => s.openTrades);
  const balance = useTradingStore((s) => s.balance);
  const dailyPnl = useTradingStore((s) => s.dailyPnl);

  // ── Rule CRUD ─────────────────────────────────────────────────────────────

  const addRule = useCallback((rule: Partial<TradingRule>) => {
    const full: TradingRule = {
      id: `rule-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: rule.name ?? 'Untitled Rule',
      conditionType: rule.conditionType ?? 'price_crosses_above',
      conditionParams: rule.conditionParams ?? {},
      actionType: rule.actionType ?? 'notify',
      actionParams: rule.actionParams ?? {},
      enabled: rule.enabled ?? true,
      triggerCount: 0,
      lastTriggeredAt: null,
      createdAt: Date.now(),
    };
    setRules((prev) => [full, ...prev]);
    setShowForm(false);
    setNewRule({
      name: '',
      conditionType: 'price_crosses_above',
      conditionParams: { symbol: 'EURUSD', level: 1.09 },
      actionType: 'notify',
      actionParams: { message: 'Rule triggered' },
    });
  }, []);

  const addTemplate = useCallback((template: Omit<TradingRule, 'id' | 'createdAt'>) => {
    addRule({ ...template });
  }, [addRule]);

  const deleteRule = useCallback((id: string) => {
    setRules((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const toggleRule = useCallback((id: string) => {
    setRules((prev) =>
      prev.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r))
    );
  }, []);

  // ── Execute Action ─────────────────────────────────────────────────────────

  const executeAction = useCallback(
    (rule: TradingRule) => {
      const p = rule.actionParams;
      switch (rule.actionType) {
        case 'notify':
          addNotification({
            type: 'warning',
            title: `Rule: ${rule.name}`,
            message: p.message ?? 'Condition met',
          });
          break;
        case 'close_symbol_positions': {
          const sym = p.symbol;
          const toClose = openTrades.filter((t) => !sym || t.symbol === sym);
          for (const trade of toClose) {
            closeTrade(trade.id);
          }
          addNotification({
            type: 'warning',
            title: `Rule: ${rule.name}`,
            message: `Closed ${toClose.length} position(s)${sym ? ` for ${sym}` : ''}`,
          });
          break;
        }
        case 'close_all_positions': {
          const ids = openTrades.map((t) => t.id);
          for (const id of ids) {
            closeTrade(id);
          }
          addNotification({
            type: 'error',
            title: `Rule: ${rule.name}`,
            message: `Closed all ${ids.length} positions`,
          });
          break;
        }
        case 'disable_trading':
          setAutoTrading(false);
          addNotification({
            type: 'error',
            title: `Rule: ${rule.name}`,
            message: 'Auto trading disabled by rule',
          });
          break;
        case 'open_trade': {
          const sym = p.symbol ?? 'EURUSD';
          const dir = p.direction ?? 'BUY';
          const lot = p.lotSize ?? 0.01;
          const price = prices[sym];
          if (!price) break;
          const entryPrice = dir === 'BUY' ? price.ask : price.bid;
          addTrade({
            id: `trade-rule-${Date.now()}`,
            symbol: sym,
            direction: dir,
            lotSize: lot,
            entryPrice,
            currentPrice: entryPrice,
            spread: price.spread,
            commission: lot * 7,
            swap: 0,
            pips: 0,
            profit: 0,
            status: 'open',
            isTrailingStop: false,
            openedAt: new Date().toISOString(),
          });
          break;
        }
        case 'modify_risk': {
          const updates: Record<string, number> = {};
          if (p.riskPerTrade !== undefined) updates.riskPerTrade = p.riskPerTrade;
          if (p.stopLossPips !== undefined) updates.stopLossPips = p.stopLossPips;
          if (p.takeProfitPips !== undefined) updates.takeProfitPips = p.takeProfitPips;
          if (Object.keys(updates).length > 0) {
            setRiskSettings(updates);
          }
          addNotification({
            type: 'info',
            title: `Rule: ${rule.name}`,
            message: `Risk settings updated`,
          });
          break;
        }
      }
    },
    [addNotification, closeTrade, setAutoTrading, addTrade, setRiskSettings, openTrades, prices]
  );

  // ── Condition Evaluation ───────────────────────────────────────────────────

  const evaluateCondition = useCallback(
    (rule: TradingRule): boolean => {
      const p = rule.conditionParams;

      switch (rule.conditionType) {
        case 'price_crosses_above': {
          const sym = p.symbol;
          if (!sym) return false;
          const tick = prices[sym];
          if (!tick) return false;
          const prev = prevPricesRef.current[sym];
          const level = p.level ?? 0;
          const triggered = prev !== undefined && prev <= level && tick.bid > level;
          return !!triggered;
        }
        case 'price_crosses_below': {
          const sym = p.symbol;
          if (!sym) return false;
          const tick = prices[sym];
          if (!tick) return false;
          const prev = prevPricesRef.current[sym];
          const level = p.level ?? 0;
          const triggered = prev !== undefined && prev >= level && tick.bid < level;
          return !!triggered;
        }
        case 'rsi_overbought': {
          const threshold = p.rsiThreshold ?? 70;
          const symbols = p.symbol ? [p.symbol] : SYMBOLS;
          return symbols.some((s) => {
            const rsi = indicatorValues[s]?.['RSI'];
            return rsi !== undefined && rsi > threshold;
          });
        }
        case 'rsi_oversold': {
          const threshold = p.rsiThreshold ?? 30;
          const symbols = p.symbol ? [p.symbol] : SYMBOLS;
          return symbols.some((s) => {
            const rsi = indicatorValues[s]?.['RSI'];
            return rsi !== undefined && rsi < threshold;
          });
        }
        case 'macd_crossover': {
          const symbols = p.symbol ? [p.symbol] : SYMBOLS;
          return symbols.some((s) => {
            const macd = indicatorValues[s]?.['MACD'];
            const signal = indicatorValues[s]?.['MACD_Signal'];
            const prevMacd = prevMacdRef.current[s];
            const prevSignal = prevMacdSignalRef.current[s];
            if (macd === undefined || signal === undefined) return false;
            if (prevMacd === undefined || prevSignal === undefined) return false;
            return prevMacd <= prevSignal && macd > signal;
          });
        }
        case 'pips_profit': {
          const target = p.pipCount ?? 0;
          const relevantTrades = p.symbol
            ? openTrades.filter((t) => t.symbol === p.symbol)
            : openTrades;
          return relevantTrades.some((t) => {
            if (t.pips >= target) return true;
            return false;
          });
        }
        case 'pips_loss': {
          const target = p.pipCount ?? 0;
          const relevantTrades = p.symbol
            ? openTrades.filter((t) => t.symbol === p.symbol)
            : openTrades;
          return relevantTrades.some((t) => {
            if (t.pips <= -target) return true;
            return false;
          });
        }
        case 'spread_exceeds': {
          const threshold = p.spreadPips ?? 0;
          return SYMBOLS.some((s) => {
            const tick = prices[s];
            if (!tick) return false;
            return tick.spread > threshold;
          });
        }
        case 'max_positions': {
          const count = p.positionCount ?? 0;
          return openTrades.length >= count;
        }
        case 'daily_loss_percent': {
          const lossPct = p.lossPercent ?? 5;
          if (lossPct > 0) {
            // Check if daily loss exceeds X%
            return dailyPnl < 0 && Math.abs(dailyPnl) > (lossPct / 100) * balance;
          } else {
            // Negative value means daily profit > X%
            return dailyPnl > 0 && dailyPnl > (Math.abs(lossPct) / 100) * balance;
          }
        }
        default:
          return false;
      }
    },
    [prices, indicatorValues, openTrades, balance, dailyPnl]
  );

  // ── Live Evaluation Loop ──────────────────────────────────────────────────

  useEffect(() => {
    // Track previous prices for crossover detection
    for (const sym of SYMBOLS) {
      const tick = prices[sym];
      if (tick) {
        prevPricesRef.current[sym] = tick.bid;
        // Track MACD values
        const macd = indicatorValues[sym]?.['MACD'];
        const signal = indicatorValues[sym]?.['MACD_Signal'];
        if (macd !== undefined) prevMacdRef.current[sym] = macd;
        if (signal !== undefined) prevMacdSignalRef.current[sym] = signal;
      }
    }

    const now = Date.now();
    const currentRules = rulesRef.current;
    const triggeredIds: string[] = [];

    for (const rule of currentRules) {
      if (!rule.enabled) continue;
      // Cooldown check
      if (rule.lastTriggeredAt && now - rule.lastTriggeredAt < COOLDOWN_MS) continue;

      const met = evaluateCondition(rule);
      if (met) {
        executeAction(rule);
        triggeredIds.push(rule.id);
      }
    }

    if (triggeredIds.length > 0) {
      // Update ref to track cooldowns (immutable update)
      rulesRef.current = rulesRef.current.map((r) =>
        triggeredIds.includes(r.id)
          ? { ...r, triggerCount: r.triggerCount + 1, lastTriggeredAt: now }
          : r
      );
      // Defer state sync to avoid synchronous setState in effect
      requestAnimationFrame(() => {
        setRules((prev) =>
          prev.map((r) =>
            triggeredIds.includes(r.id)
              ? { ...r, triggerCount: r.triggerCount + 1, lastTriggeredAt: now }
              : r
          )
        );
      });
    }
  }, [prices]);

  // ── Form Handlers ──────────────────────────────────────────────────────────

  const handleConditionTypeChange = useCallback((val: string) => {
    const ct = val as ConditionType;
    let defaultParams: ConditionParams = {};
    switch (ct) {
      case 'price_crosses_above':
      case 'price_crosses_below':
        defaultParams = { symbol: 'EURUSD', level: 1.09 };
        break;
      case 'rsi_overbought':
        defaultParams = { rsiThreshold: 70, rsiType: 'overbought' };
        break;
      case 'rsi_oversold':
        defaultParams = { rsiThreshold: 30, rsiType: 'oversold' };
        break;
      case 'macd_crossover':
        defaultParams = { symbol: 'EURUSD' };
        break;
      case 'pips_profit':
      case 'pips_loss':
        defaultParams = { pipCount: 50, symbol: 'EURUSD' };
        break;
      case 'spread_exceeds':
        defaultParams = { spreadPips: 5 };
        break;
      case 'max_positions':
        defaultParams = { positionCount: 5 };
        break;
      case 'daily_loss_percent':
        defaultParams = { lossPercent: 5 };
        break;
    }
    setNewRule((prev) => ({ ...prev, conditionType: ct, conditionParams: defaultParams }));
  }, []);

  const handleActionTypeChange = useCallback((val: string) => {
    const at = val as ActionType;
    let defaultParams: ActionParams = {};
    switch (at) {
      case 'notify':
        defaultParams = { message: 'Alert triggered' };
        break;
      case 'close_symbol_positions':
        defaultParams = { symbol: 'EURUSD' };
        break;
      case 'close_all_positions':
        defaultParams = {};
        break;
      case 'disable_trading':
        defaultParams = {};
        break;
      case 'open_trade':
        defaultParams = { symbol: 'EURUSD', direction: 'BUY', lotSize: 0.01 };
        break;
      case 'modify_risk':
        defaultParams = { riskPerTrade: 0.5, stopLossPips: 10, takeProfitPips: 15 };
        break;
    }
    setNewRule((prev) => ({ ...prev, actionType: at, actionParams: defaultParams }));
  }, []);

  const handleCreate = useCallback(() => {
    if (!newRule.name?.trim()) return;
    addRule({
      ...newRule,
      conditionType: newRule.conditionType,
      actionType: newRule.actionType,
    } as TradingRule);
  }, [newRule, addRule]);

  // ── Render ─────────────────────────────────────────────────────────────────

  const enabledCount = rules.filter((r) => r.enabled).length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-amber-500/10">
            <Zap className="w-4 h-4 text-amber-500" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Rules Engine</h3>
            <p className="text-xs text-muted-foreground">
              {rules.length} rule{rules.length !== 1 ? 's' : ''} &middot; {enabledCount} active
            </p>
          </div>
        </div>
        <Button
          size="sm"
          className="h-8 text-xs gap-1.5"
          onClick={() => setShowForm((v) => !v)}
        >
          <Plus className="w-3.5 h-3.5" />
          New Rule
        </Button>
      </div>

      <Separator />

      {/* Create Rule Form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="glass-card-premium rounded-xl p-4 space-y-3 overflow-hidden">
              <div className="flex items-center gap-2 mb-1">
                <Settings className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground">Create New Rule</span>
              </div>

              {/* Name */}
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Rule Name</Label>
                <Input
                  className="h-8 text-xs"
                  placeholder="e.g. RSI Alert on EURUSD"
                  value={newRule.name ?? ''}
                  onChange={(e) => setNewRule((prev) => ({ ...prev, name: e.target.value }))}
                />
              </div>

              {/* Condition */}
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Condition (Trigger)</Label>
                <Select
                  value={newRule.conditionType}
                  onValueChange={handleConditionTypeChange}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONDITION_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <ConditionParamsForm
                  conditionType={newRule.conditionType ?? 'price_crosses_above'}
                  params={newRule.conditionParams ?? {}}
                  onChange={(cp) => setNewRule((prev) => ({ ...prev, conditionParams: cp }))}
                />
              </div>

              {/* Action */}
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Action</Label>
                <Select
                  value={newRule.actionType}
                  onValueChange={handleActionTypeChange}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ACTION_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <ActionParamsForm
                  actionType={newRule.actionType ?? 'notify'}
                  params={newRule.actionParams ?? {}}
                  onChange={(ap) => setNewRule((prev) => ({ ...prev, actionParams: ap }))}
                />
              </div>

              {/* Buttons */}
              <div className="flex gap-2 pt-1">
                <Button
                  size="sm"
                  className="h-8 text-xs gap-1.5"
                  onClick={handleCreate}
                  disabled={!newRule.name?.trim()}
                >
                  <Play className="w-3 h-3" />
                  Create Rule
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 text-xs"
                  onClick={() => setShowForm(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Templates */}
      {rules.length === 0 && !showForm && (
        <div className="glass-card-premium rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Copy className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">Quick Templates</span>
          </div>
          <p className="text-xs text-muted-foreground">Add a pre-built rule with one click:</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {RULE_TEMPLATES.map((tmpl) => (
              <motion.button
                key={tmpl.name}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => addTemplate(tmpl)}
                className="flex items-center gap-2 rounded-lg border border-border/50 bg-muted/30 hover:bg-muted/50 p-2.5 text-left transition-colors"
              >
                {tmpl.actionType === 'close_all_positions' ? (
                  <Shield className="w-3.5 h-3.5 text-red-400 shrink-0" />
                ) : tmpl.actionType === 'disable_trading' ? (
                  <Pause className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                ) : tmpl.conditionType === 'price_crosses_above' ? (
                  <Target className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                ) : (
                  <Bell className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                )}
                <div className="min-w-0">
                  <div className="text-xs font-medium text-foreground truncate">{tmpl.name}</div>
                  <div className="text-[10px] text-muted-foreground truncate">
                    {CONDITION_LABELS[tmpl.conditionType]} → {ACTION_LABELS[tmpl.actionType]}
                  </div>
                </div>
              </motion.button>
            ))}
          </div>
        </div>
      )}

      {/* Rules List */}
      <div className="max-h-96 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
        <AnimatePresence mode="popLayout">
          {rules.map((rule) => (
            <motion.div
              key={rule.id}
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className={`glass-card-premium rounded-xl p-3 space-y-2 transition-opacity ${
                rule.enabled ? 'opacity-100' : 'opacity-50'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  {rule.enabled ? (
                    <Play className="w-3 h-3 text-emerald-400 shrink-0" />
                  ) : (
                    <Pause className="w-3 h-3 text-muted-foreground shrink-0" />
                  )}
                  <span className="text-xs font-semibold text-foreground truncate">
                    {rule.name}
                  </span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Badge
                    variant={rule.triggerCount > 0 ? 'default' : 'secondary'}
                    className={`text-[10px] h-5 px-1.5 ${
                      rule.triggerCount > 0
                        ? 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30'
                        : ''
                    }`}
                  >
                    {rule.triggerCount}x
                  </Badge>
                  <button
                    onClick={() => toggleRule(rule.id)}
                    className="p-1 rounded hover:bg-muted/50 transition-colors"
                    aria-label={rule.enabled ? 'Disable rule' : 'Enable rule'}
                  >
                    {rule.enabled ? (
                      <ToggleRight className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <ToggleLeft className="w-4 h-4 text-muted-foreground" />
                    )}
                  </button>
                  <button
                    onClick={() => deleteRule(rule.id)}
                    className="p-1 rounded hover:bg-red-500/20 transition-colors"
                    aria-label="Delete rule"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-red-400/70 hover:text-red-400" />
                  </button>
                </div>
              </div>

              <div className="space-y-1 pl-5">
                <div className="flex items-center gap-1.5">
                  <Target className="w-3 h-3 text-muted-foreground shrink-0" />
                  <span className="text-xs text-muted-foreground font-mono">
                    {describeCondition(rule)}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Zap className="w-3 h-3 text-muted-foreground shrink-0" />
                  <span className="text-xs text-muted-foreground">
                    {describeAction(rule)}
                  </span>
                </div>
              </div>

              {rule.lastTriggeredAt && (
                <div className="pl-5 text-[10px] text-muted-foreground/60">
                  Last triggered: {new Date(rule.lastTriggeredAt).toLocaleTimeString()}
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {rules.length === 0 && showForm && (
          <div className="text-center py-6 text-xs text-muted-foreground">
            No rules yet. Create one above or use a template.
          </div>
        )}
      </div>
    </div>
  );
}
