'use client';

import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTradingStore } from '@/store/trading-store';
import { SYMBOLS, SYMBOL_INFO, type Symbol } from '@/lib/types';
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
  Bell,
  BellRing,
  Plus,
  Trash2,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
} from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────

type AlertCondition = 'above' | 'below' | 'crosses_above' | 'crosses_below';

interface TriggeredAlert {
  id: string;
  symbol: Symbol;
  condition: string;
  price: number;
  message?: string;
  triggeredAt: number;
  triggeredPrice: number;
}

interface QuickAlert {
  label: string;
  symbol: Symbol;
  condition: AlertCondition;
  price: number;
}

const CONDITION_OPTIONS: { value: AlertCondition; label: string }[] = [
  { value: 'above', label: 'Price Above' },
  { value: 'below', label: 'Price Below' },
  { value: 'crosses_above', label: 'Price Crosses Above' },
  { value: 'crosses_below', label: 'Price Crosses Below' },
];

const QUICK_ALERTS: QuickAlert[] = [
  { label: 'EURUSD > 1.0900', symbol: 'EURUSD', condition: 'above', price: 1.09 },
  { label: 'EURUSD < 1.0800', symbol: 'EURUSD', condition: 'below', price: 1.08 },
  { label: 'USDJPY > 155.00', symbol: 'USDJPY', condition: 'above', price: 155.0 },
  { label: 'USDJPY < 149.00', symbol: 'USDJPY', condition: 'below', price: 149.0 },
  { label: 'GBPUSD > 1.2750', symbol: 'GBPUSD', condition: 'above', price: 1.275 },
  { label: 'XAUUSD < 2400', symbol: 'XAUUSD', condition: 'below', price: 2400 },
  { label: 'XAUUSD > 2650', symbol: 'XAUUSD', condition: 'above', price: 2650 },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function getConditionBadge(condition: string) {
  const isUp = condition.includes('above');
  return (
    <Badge
      variant="outline"
      className={
        isUp
          ? 'border-emerald-500/40 text-emerald-400 bg-emerald-500/10 text-xs'
          : 'border-red-500/40 text-red-400 bg-red-500/10 text-xs'
      }
    >
      {isUp ? (
        <ArrowUpRight className="mr-1 size-3" />
      ) : (
        <ArrowDownRight className="mr-1 size-3" />
      )}
      {condition.replace(/_/g, ' ').replace(/\w/g, (c) => c.toUpperCase())}
    </Badge>
  );
}

function getDistanceColor(
  currentPrice: number,
  targetPrice: number,
  pipSize: number
): 'green' | 'amber' | 'red' {
  const distPips = Math.abs(currentPrice - targetPrice) / pipSize;
  // For forex, thresholds: green < 15pips, amber < 40pips, red >= 40pips
  // For metals, thresholds: green < 50pips, amber < 150pips, red >= 150pips
  const isMetal = pipSize === 0.01;
  const greenThresh = isMetal ? 50 : 15;
  const amberThresh = isMetal ? 150 : 40;

  if (distPips <= greenThresh) return 'green';
  if (distPips <= amberThresh) return 'amber';
  return 'red';
}

function getDistanceColorClasses(color: 'green' | 'amber' | 'red') {
  switch (color) {
    case 'green':
      return 'text-emerald-400';
    case 'amber':
      return 'text-amber-400';
    case 'red':
      return 'text-red-400';
  }
}

function getDistanceDotColor(color: 'green' | 'amber' | 'red') {
  switch (color) {
    case 'green':
      return 'bg-emerald-400';
    case 'amber':
      return 'bg-amber-400';
    case 'red':
      return 'bg-red-400';
  }
}

// ── Component ────────────────────────────────────────────────────────────────

export default function EnhancedAlertPanel() {
  // Store selectors
  const priceAlerts = useTradingStore((s) => s.priceAlerts);
  const prices = useTradingStore((s) => s.prices);
  const addPriceAlert = useTradingStore((s) => s.addPriceAlert);
  const removePriceAlert = useTradingStore((s) => s.removePriceAlert);

  // Form state
  const [symbol, setSymbol] = useState<Symbol>('EURUSD');
  const [condition, setCondition] = useState<AlertCondition>('above');
  const [targetPrice, setTargetPrice] = useState('');
  const [note, setNote] = useState('');

  // Alert history (local state)
  const [triggeredAlerts, setTriggeredAlerts] = useState<TriggeredAlert[]>([]);

  // Subscribe to store for alert triggering via subscription callback
  // (setState is called in the subscription callback, not directly in the effect body)
  useEffect(() => {
    const unsub = useTradingStore.subscribe((state) => {
      const toTrigger: Array<{
        id: string;
        symbol: Symbol;
        condition: string;
        price: number;
        message?: string;
        triggeredPrice: number;
      }> = [];

      for (const alert of state.priceAlerts) {
        if (!alert.isActive) continue;
        const tick = state.prices[alert.symbol];
        if (!tick) continue;

        const currentBid = tick.bid;
        let shouldTrigger = false;

        switch (alert.condition) {
          case 'above':
            shouldTrigger = currentBid > alert.price;
            break;
          case 'below':
            shouldTrigger = currentBid < alert.price;
            break;
          case 'crosses_above':
            shouldTrigger = currentBid > alert.price;
            break;
          case 'crosses_below':
            shouldTrigger = currentBid < alert.price;
            break;
        }

        if (shouldTrigger) {
          toTrigger.push({
            id: alert.id,
            symbol: alert.symbol,
            condition: alert.condition,
            price: alert.price,
            message: alert.message,
            triggeredPrice: currentBid,
          });
        }
      }

      if (toTrigger.length > 0) {
        const newEntries: TriggeredAlert[] = toTrigger.map((a) => ({
          ...a,
          triggeredAt: Date.now(),
        }));
        setTriggeredAlerts((prev) => [...newEntries, ...prev].slice(0, 50));
        for (const a of toTrigger) {
          useTradingStore.getState().removePriceAlert(a.id);
        }
      }
    });
    return unsub;
  }, []);

  // Handle form submit
  const handleCreateAlert = useCallback(() => {
    const price = parseFloat(targetPrice);
    if (isNaN(price) || price <= 0) return;

    addPriceAlert({
      symbol,
      condition,
      price,
      isActive: true,
      message: note.trim() || undefined,
    });
    setTargetPrice('');
    setNote('');
  }, [symbol, condition, targetPrice, note, addPriceAlert]);

  // Handle quick alert
  const handleQuickAlert = useCallback(
    (qa: QuickAlert) => {
      addPriceAlert({
        symbol: qa.symbol,
        condition: qa.condition,
        price: qa.price,
        isActive: true,
      });
    },
    [addPriceAlert]
  );

  // Handle delete
  const handleDelete = useCallback(
    (id: string) => {
      removePriceAlert(id);
    },
    [removePriceAlert]
  );

  // Current price for selected symbol (for display)
  const selectedSymbolInfo = SYMBOL_INFO[symbol];
  const selectedCurrentPrice = prices[symbol]?.bid;

  const activeAlerts = priceAlerts.filter((a) => a.isActive);

  return (
    <div className="glass-card-premium rounded-xl p-4 flex flex-col gap-4 h-full">
      {/* Header */}
      <div className="flex items-center gap-2">
        <BellRing className="size-4 text-amber-400" />
        <h3 className="text-sm font-semibold text-foreground">Price Alerts</h3>
        <Badge variant="secondary" className="ml-auto text-xs tabular-nums">
          {activeAlerts.length} active
        </Badge>
      </div>

      <Separator className="opacity-50" />

      {/* Create Alert Form */}
      <div className="flex flex-col gap-3">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Create Alert
        </p>

        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1">
            <Label className="text-xs text-muted-foreground">Symbol</Label>
            <Select
              value={symbol}
              onValueChange={(v) => setSymbol(v as Symbol)}
            >
              <SelectTrigger className="h-8 text-xs w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SYMBOLS.map((s) => (
                  <SelectItem key={s} value={s} className="text-xs">
                    {SYMBOL_INFO[s].name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1">
            <Label className="text-xs text-muted-foreground">Condition</Label>
            <Select
              value={condition}
              onValueChange={(v) => setCondition(v as AlertCondition)}
            >
              <SelectTrigger className="h-8 text-xs w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CONDITION_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value} className="text-xs">
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground">Target Price</Label>
            {selectedCurrentPrice !== undefined && (
              <span className="text-xs text-muted-foreground font-mono">
                Current: {selectedCurrentPrice.toFixed(selectedSymbolInfo.digits)}
              </span>
            )}
          </div>
          <Input
            type="number"
            step={selectedSymbolInfo.pipSize}
            placeholder={
              selectedCurrentPrice
                ? selectedCurrentPrice.toFixed(selectedSymbolInfo.digits)
                : 'Enter price...'
            }
            value={targetPrice}
            onChange={(e) => setTargetPrice(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreateAlert();
            }}
            className="h-8 text-xs font-mono"
          />
        </div>

        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">
            Note <span className="opacity-50">(optional)</span>
          </Label>
          <Input
            type="text"
            placeholder="Add a message..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreateAlert();
            }}
            className="h-8 text-xs"
          />
        </div>

        <Button
          size="sm"
          onClick={handleCreateAlert}
          disabled={!targetPrice || isNaN(parseFloat(targetPrice)) || parseFloat(targetPrice) <= 0}
          className="h-8 text-xs w-full gap-1.5"
        >
          <Plus className="size-3.5" />
          Create Alert
        </Button>
      </div>

      <Separator className="opacity-50" />

      {/* Quick Alert Buttons */}
      <div className="flex flex-col gap-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Quick Alerts
        </p>
        <div className="flex flex-wrap gap-1.5">
          {QUICK_ALERTS.map((qa) => (
            <Button
              key={`${qa.symbol}-${qa.condition}-${qa.price}`}
              variant="outline"
              size="sm"
              onClick={() => handleQuickAlert(qa)}
              className="h-7 text-[10px] px-2 gap-1 border-border/50 hover:border-amber-500/40 hover:text-amber-400 hover:bg-amber-500/5"
            >
              {qa.condition.includes('above') ? (
                <TrendingUp className="size-3 text-emerald-400" />
              ) : (
                <TrendingDown className="size-3 text-red-400" />
              )}
              {qa.label}
            </Button>
          ))}
        </div>
      </div>

      <Separator className="opacity-50" />

      {/* Active Alerts List */}
      <div className="flex flex-col gap-2 flex-1 min-h-0">
        <div className="flex items-center gap-1.5">
          <Bell className="size-3.5 text-muted-foreground" />
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Active Alerts
          </p>
        </div>

        <div className="max-h-64 overflow-y-auto flex flex-col gap-2 pr-1 custom-scrollbar">
          <AnimatePresence mode="popLayout">
            {activeAlerts.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-xs text-muted-foreground text-center py-6"
              >
                No active alerts. Create one above or use a quick alert.
              </motion.div>
            ) : (
              activeAlerts.map((alert) => {
                const info = SYMBOL_INFO[alert.symbol];
                const tick = prices[alert.symbol];
                const currentBid = tick?.bid;
                const distColor = currentBid
                  ? getDistanceColor(currentBid, alert.price, info.pipSize)
                  : 'red';
                const distPips = currentBid
                  ? Math.abs(currentBid - alert.price) / info.pipSize
                  : null;
                const isWithin5Pips =
                  distPips !== null && distPips <= 5;

                return (
                  <motion.div
                    key={alert.id}
                    layout
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: 40, transition: { duration: 0.2 } }}
                    className="rounded-lg border border-border/50 bg-background/40 p-3 flex flex-col gap-2 hover:border-border/80 transition-colors"
                  >
                    {/* Top row: pair + condition + delete */}
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5">
                        {/* Pulsing dot if within 5 pips */}
                        <span className="relative flex size-2">
                          {isWithin5Pips && (
                            <span
                              className={`absolute inset-0 rounded-full ${getDistanceDotColor(distColor)} animate-ping opacity-75`}
                            />
                          )}
                          <span
                            className={`relative rounded-full size-2 ${getDistanceDotColor(distColor)}`}
                          />
                        </span>
                        <span className="text-xs font-semibold text-foreground">
                          {info.name}
                        </span>
                      </div>

                      {getConditionBadge(alert.condition)}

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(alert.id)}
                        className="ml-auto h-6 w-6 p-0 text-muted-foreground hover:text-red-400 hover:bg-red-500/10"
                      >
                        <Trash2 className="size-3" />
                      </Button>
                    </div>

                    {/* Price row */}
                    <div className="flex items-baseline gap-3 text-xs">
                      <div className="flex flex-col">
                        <span className="text-muted-foreground text-[10px]">
                          Target
                        </span>
                        <span className="font-mono font-semibold text-foreground">
                          {alert.price.toFixed(info.digits)}
                        </span>
                      </div>

                      <div className="flex flex-col">
                        <span className="text-muted-foreground text-[10px]">
                          Current
                        </span>
                        <span
                          className={`font-mono ${currentBid !== undefined ? 'text-foreground' : 'text-muted-foreground'}`}
                        >
                          {currentBid !== undefined
                            ? currentBid.toFixed(info.digits)
                            : '---'}
                        </span>
                      </div>

                      <div className="flex flex-col ml-auto">
                        <span className="text-muted-foreground text-[10px]">
                          Distance
                        </span>
                        <span
                          className={`font-mono font-medium ${getDistanceColorClasses(distColor)}`}
                        >
                          {distPips !== null
                            ? `${distPips.toFixed(1)} pips`
                            : '---'}
                        </span>
                      </div>
                    </div>

                    {/* Note + time */}
                    <div className="flex items-center justify-between">
                      {alert.message ? (
                        <span className="text-[10px] text-muted-foreground truncate max-w-[60%]">
                          {alert.message}
                        </span>
                      ) : (
                        <span />
                      )}
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Clock className="size-2.5" />
                        {alert.id.replace('alert-', '')}
                      </span>
                    </div>
                  </motion.div>
                );
              })
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Alert History */}
      {triggeredAlerts.length > 0 && (
        <>
          <Separator className="opacity-50" />
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-1.5">
              <BellRing className="size-3.5 text-amber-400" />
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Triggered History
              </p>
              <Badge
                variant="secondary"
                className="text-[10px] tabular-nums ml-auto"
              >
                {triggeredAlerts.length}
              </Badge>
            </div>

            <div className="max-h-36 overflow-y-auto flex flex-col gap-1.5 pr-1 custom-scrollbar">
              {triggeredAlerts.map((ta) => {
                const info = SYMBOL_INFO[ta.symbol];
                return (
                  <div
                    key={ta.id}
                    className="rounded-md border border-amber-500/20 bg-amber-500/5 px-3 py-2 flex items-center gap-2"
                  >
                    <BellRing className="size-3 text-amber-400 shrink-0" />
                    <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-medium text-foreground">
                          {info.name}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {ta.condition.replace(/_/g, ' ')}
                        </span>
                        <span className="text-xs font-mono text-amber-400">
                          {ta.price.toFixed(info.digits)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                        <span>
                          Triggered @{' '}
                          <span className="font-mono text-foreground">
                            {ta.triggeredPrice.toFixed(info.digits)}
                          </span>
                        </span>
                        <span className="flex items-center gap-0.5">
                          <Clock className="size-2.5" />
                          {new Date(ta.triggeredAt).toLocaleTimeString('en-US', {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                            hour12: false,
                          })}
                        </span>
                      </div>
                      {ta.message && (
                        <span className="text-[10px] text-muted-foreground truncate">
                          {ta.message}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
