'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  ArrowUpRight,
  ArrowDownRight,
  Shield,
  DollarSign,
  Target,
  Activity,
  CheckCircle,
  X,
  Zap,
  BarChart3,
} from 'lucide-react';
import { useTradingStore } from '@/store/trading-store';

export interface TradeExecutionContext {
  symbol: string;
  direction: 'BUY' | 'SELL';
  lotSize: number;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  riskAmount: number;
  potentialProfit: number;
  riskRewardRatio: string;
  spread: number;
  commission: number;
  accountBalance: number;
  marginRequired: number;
  freeMargin: number;
}

const MOCK_CONTEXT: TradeExecutionContext = {
  symbol: 'EUR/USD',
  direction: 'BUY',
  lotSize: 0.10,
  entryPrice: 1.08765,
  stopLoss: 1.08515,
  takeProfit: 1.09265,
  riskAmount: 25.0,
  potentialProfit: 50.0,
  riskRewardRatio: '1:2',
  spread: 0.5,
  commission: 0.10,
  accountBalance: 10000,
  marginRequired: 21.75,
  freeMargin: 9978.25,
};

interface TradeExecutionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  context?: TradeExecutionContext;
}

function PriceLevelVisualization({ ctx }: { ctx: TradeExecutionContext }) {
  const isBuy = ctx.direction === 'BUY';
  const svgH = 200;
  const padTop = 20;
  const padBot = 20;
  const usable = svgH - padTop - padBot;

  // Price range for the visualization
  const prices = [ctx.stopLoss, ctx.entryPrice, ctx.takeProfit];
  const minP = Math.min(...prices);
  const maxP = Math.max(...prices);
  const range = maxP - minP;
  const padded = range * 0.15;
  const pMin = minP - padded;
  const pMax = maxP + padded;
  const pRange = pMax - pMin;

  const yFor = (p: number) => padTop + ((pMax - p) / pRange) * usable;

  const entryY = yFor(ctx.entryPrice);
  const slY = yFor(ctx.stopLoss);
  const tpY = yFor(ctx.takeProfit);

  // Current price slightly offset from entry
  const currentPrice = ctx.entryPrice + (isBuy ? 0.00012 : -0.00012);
  const currentY = yFor(currentPrice);

  const slPips = Math.abs(ctx.entryPrice - ctx.stopLoss) * 10000;
  const tpPips = Math.abs(ctx.takeProfit - ctx.entryPrice) * 10000;

  const lineX = 60;

  return (
    <svg width="100%" height={svgH} viewBox="0 0 320 200" className="overflow-visible">
      <defs>
        <linearGradient id="greenShade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(16,185,129,0.15)" />
          <stop offset="100%" stopColor="rgba(16,185,129,0.03)" />
        </linearGradient>
        <linearGradient id="redShade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(239,68,68,0.03)" />
          <stop offset="100%" stopColor="rgba(239,68,68,0.15)" />
        </linearGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* Vertical price axis line */}
      <line x1={lineX} y1={padTop} x2={lineX} y2={svgH - padBot} stroke="rgba(255,255,255,0.12)" strokeWidth={1} />

      {/* SL → Entry red shaded region */}
      <motion.rect
        x={lineX - 30} y={Math.min(slY, entryY)} width={60} height={Math.abs(entryY - slY)}
        fill="url(#redShade)"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1, duration: 0.4 }}
      />

      {/* Entry → TP green shaded region */}
      <motion.rect
        x={lineX - 30} y={Math.min(tpY, entryY)} width={60} height={Math.abs(tpY - entryY)}
        fill="url(#greenShade)"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2, duration: 0.4 }}
      />

      {/* Dashed lines for SL and TP */}
      <motion.line x1={lineX - 35} y1={slY} x2={280} y2={slY} stroke="rgba(239,68,68,0.3)" strokeWidth={1} strokeDasharray="4 3" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 0.15, duration: 0.4 }} />
      <motion.line x1={lineX - 35} y1={tpY} x2={280} y2={tpY} stroke="rgba(16,185,129,0.3)" strokeWidth={1} strokeDasharray="4 3" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 0.45, duration: 0.4 }} />

      {/* SL marker - staggered first */}
      <motion.g initial={{ opacity: 0, scale: 0 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1, type: 'spring', stiffness: 300, damping: 20 }}>
        <circle cx={lineX} cy={slY} r={5} fill="#ef4444" filter="url(#glow)" />
        <text x={lineX + 14} y={slY + 4} fill="#ef4444" fontSize={10} fontFamily="monospace" fontWeight={600}>SL {ctx.stopLoss.toFixed(5)}</text>
        <text x={260} y={slY + 4} fill="rgba(239,68,68,0.7)" fontSize={9} fontFamily="monospace" textAnchor="end">-{slPips} pips</text>
      </motion.g>

      {/* Entry marker - staggered second */}
      <motion.g initial={{ opacity: 0, scale: 0 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.25, type: 'spring', stiffness: 300, damping: 20 }}>
        <circle cx={lineX} cy={entryY} r={6} fill="#ffffff" stroke="rgba(255,255,255,0.5)" strokeWidth={2} />
        <text x={lineX + 14} y={entryY + 4} fill="#ffffff" fontSize={11} fontFamily="monospace" fontWeight={700}>Entry {ctx.entryPrice.toFixed(5)}</text>
      </motion.g>

      {/* TP marker - staggered last */}
      <motion.g initial={{ opacity: 0, scale: 0 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.4, type: 'spring', stiffness: 300, damping: 20 }}>
        <circle cx={lineX} cy={tpY} r={5} fill="#10b981" filter="url(#glow)" />
        <text x={lineX + 14} y={tpY + 4} fill="#10b981" fontSize={10} fontFamily="monospace" fontWeight={600}>TP {ctx.takeProfit.toFixed(5)}</text>
        <text x={260} y={tpY + 4} fill="rgba(16,185,129,0.7)" fontSize={9} fontFamily="monospace" textAnchor="end">+{tpPips} pips</text>
      </motion.g>

      {/* Current price animated pulsing indicator */}
      <motion.g animate={{ opacity: [0.6, 1, 0.6] }} transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}>
        <line x1={lineX - 10} y1={currentY} x2={280} y2={currentY} stroke="rgba(255,255,255,0.2)" strokeWidth={1} strokeDasharray="2 2" />
      </motion.g>
      <motion.circle cx={lineX} cy={currentY} r={3} fill="#60a5fa" filter="url(#glow)" animate={{ r: [3, 5, 3], opacity: [0.7, 1, 0.7] }} transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }} />
      <text x={282} y={currentY + 3} fill="rgba(96,165,250,0.8)" fontSize={8} fontFamily="monospace">Current</text>
    </svg>
  );
}

function MetricCard({ icon: Icon, label, value, valueColor, delay }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; valueColor?: string; delay: number }) {
  return (
    <motion.div
      className="metric-card-animated flex items-center gap-2"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3 }}
    >
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white/5">
        <Icon className="size-3.5 text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] leading-tight text-muted-foreground">{label}</div>
        <div className={`text-sm font-semibold font-mono tabular-nums leading-tight ${valueColor || 'text-foreground'}`}>{value}</div>
      </div>
    </motion.div>
  );
}

export function TradeExecutionModal({ open, onOpenChange, context }: TradeExecutionModalProps) {
  const ctx = context ?? MOCK_CONTEXT;
  const isBuy = ctx.direction === 'BUY';
  const addNotification = useTradingStore((s) => s.addNotification);

  const handleConfirm = useCallback(() => {
    addNotification({
      type: 'success',
      title: `${ctx.direction} ${ctx.symbol}`,
      message: `${ctx.lotSize.toFixed(2)} lots @ ${ctx.entryPrice.toFixed(5)} | SL: ${ctx.stopLoss.toFixed(5)} | TP: ${ctx.takeProfit.toFixed(5)} | R:R ${ctx.riskRewardRatio}`,
    });
    onOpenChange(false);
  }, [ctx, addNotification, onOpenChange]);

  const dirColor = isBuy ? 'emerald' : 'red';
  const dirBgClass = isBuy ? 'bg-emerald-500/10' : 'bg-red-500/10';
  const dirBorderClass = isBuy ? 'border-emerald-500/30' : 'border-red-500/30';
  const dirTextClass = isBuy ? 'text-emerald-400' : 'text-red-400';
  const dirBadgeBg = isBuy ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-red-500/20 text-red-400 border-red-500/30';
  const confirmBtnClass = isBuy
    ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
    : 'bg-red-600 hover:bg-red-500 text-white';

  const DirectionIcon = isBuy ? ArrowUpRight : ArrowDownRight;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <DialogContent className="sm:max-w-md gap-0 overflow-hidden border-white/10 bg-gray-950 p-0" showCloseButton={false} asChild>
            <motion.div
              initial={{ opacity: 0, y: 40, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.97 }}
              transition={{ duration: 0.35, ease: [0.19, 1, 0.22, 1] }}
            >
              {/* Animated pulse background */}
              <div className={`absolute inset-0 ${isBuy ? 'bg-emerald-500' : 'bg-red-500'} opacity-0`} style={{ animation: 'tradePulse 2.5s ease-in-out infinite' }} />

              {/* (a) Header Section */}
              <div className={`relative border-b border-white/5 ${dirBgClass}`}>
                <div className="flex items-center justify-between p-4 pb-3">
                  <div className="flex items-center gap-3">
                    <motion.div
                      className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold ${dirBadgeBg}`}
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                    >
                      <DirectionIcon className="size-4" />
                      {ctx.direction}
                    </motion.div>
                    <div>
                      <DialogTitle className="text-base font-bold text-foreground leading-tight">
                        {ctx.symbol}
                      </DialogTitle>
                      <DialogDescription className="text-[11px] text-muted-foreground mt-0.5">
                        {ctx.lotSize.toFixed(2)} lots
                      </DialogDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-mono tabular-nums text-muted-foreground border rounded-md px-1.5 py-0.5 ${dirBorderClass}`}>
                      Spread {ctx.spread}
                    </span>
                    <button onClick={() => onOpenChange(false)} className="rounded-md p-1 hover:bg-white/5 transition-colors">
                      <X className="size-4 text-muted-foreground" />
                    </button>
                  </div>
                </div>
              </div>

              {/* (b) Price Level Visualization */}
              <div className="relative px-4 pt-3 pb-1">
                <PriceLevelVisualization ctx={ctx} />
              </div>

              {/* (c) Risk Summary Grid — 2×3 + 1 = 7 metrics in 2×4 grid, last row 1 item */}
              <div className="px-4 pt-2 pb-3">
                <div className="glass-card-premium rounded-lg p-3">
                  <div className="mb-2 flex items-center gap-1.5">
                    <Shield className="size-3 text-muted-foreground" />
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Risk Summary</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <MetricCard icon={DollarSign} label="Risk Amount" value={`$${ctx.riskAmount.toFixed(2)}`} valueColor="text-red-400 neon-text-red" delay={0.05} />
                    <MetricCard icon={Target} label="Potential Profit" value={`$${ctx.potentialProfit.toFixed(2)}`} valueColor="text-emerald-400 neon-text-emerald" delay={0.1} />
                    <MetricCard icon={BarChart3} label="Risk : Reward" value={ctx.riskRewardRatio} delay={0.15} />
                    <MetricCard icon={Activity} label="Margin Required" value={`$${ctx.marginRequired.toFixed(2)}`} delay={0.2} />
                    <MetricCard icon={Zap} label="Spread" value={`${ctx.spread} pips`} delay={0.25} />
                    <MetricCard icon={DollarSign} label="Commission" value={`$${ctx.commission.toFixed(2)}`} delay={0.3} />
                  </div>
                  <div className="mt-2">
                    <MetricCard icon={Shield} label="Free Margin After Trade" value={`$${ctx.freeMargin.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} valueColor="text-emerald-400" delay={0.35} />
                  </div>
                </div>
              </div>

              {/* (d) Footer */}
              <div className="border-t border-white/5 px-4 py-3">
                <DialogFooter className="flex-row gap-2 sm:justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onOpenChange(false)}
                    className="border-white/10 text-muted-foreground hover:bg-white/5 hover:text-foreground"
                  >
                    <X className="size-3.5" />
                    Cancel
                  </Button>
                  <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                    <Button
                      size="sm"
                      onClick={handleConfirm}
                      className={`${confirmBtnClass} font-semibold shadow-lg transition-all`}
                      style={{ animation: 'confirmPulse 2s ease-in-out infinite' }}
                    >
                      <CheckCircle className="size-4" />
                      Confirm Trade
                    </Button>
                  </motion.div>
                </DialogFooter>
              </div>

              {/* Keyframe styles for pulse animations */}
              <style>{`
                @keyframes tradePulse {
                  0%, 100% { opacity: 0; }
                  50% { opacity: 0.04; }
                }
                @keyframes confirmPulse {
                  0%, 100% { box-shadow: 0 0 0 0 ${isBuy ? 'rgba(16,185,129,0.4)' : 'rgba(239,68,68,0.4)'}; }
                  50% { box-shadow: 0 0 0 6px ${isBuy ? 'rgba(16,185,129,0)' : 'rgba(239,68,68,0)'}; }
                }
              `}</style>
            </motion.div>
          </DialogContent>
        )}
      </AnimatePresence>
    </Dialog>
  );
}

/**
 * Opens a trade execution modal by adding a notification with trade details.
 * For standalone use when you don't need the modal UI.
 */
export function openTradeModal(context: TradeExecutionContext) {
  const addNotification = useTradingStore.getState().addNotification;
  addNotification({
    type: 'info',
    title: `${context.direction} ${context.symbol} — Trade Ready`,
    message: `${context.lotSize.toFixed(2)} lots @ ${context.entryPrice.toFixed(5)} | R:R ${context.riskRewardRatio} | Risk $${context.riskAmount.toFixed(2)}`,
  });
}

export default TradeExecutionModal;
