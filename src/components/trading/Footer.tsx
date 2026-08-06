'use client';
import { useMemo } from 'react';
import { useTradingStore } from '@/store/trading-store';
import { SYMBOLS, SYMBOL_INFO, BROKER_CONFIG, type Symbol } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

// ── Session helpers ──────────────────────────────────────────────
interface SessionInfo {
  name: string;
  dotColor: string;
  barColor: string;
  start: number;
  end: number;
  priority: number;
}

const SESSIONS: SessionInfo[] = [
  { name: 'Sydney',   dotColor: 'bg-cyan-400',    barColor: 'bg-cyan-400',    start: 22, end: 7,  priority: 0 },
  { name: 'Tokyo',    dotColor: 'bg-violet-400',   barColor: 'bg-violet-400',   start: 0,  end: 9,  priority: 1 },
  { name: 'London',   dotColor: 'bg-emerald-400',  barColor: 'bg-emerald-400',  start: 8,  end: 17, priority: 2 },
  { name: 'New York', dotColor: 'bg-amber-400',    barColor: 'bg-amber-400',    start: 13, end: 22, priority: 3 },
];

function isSessionActive(utcH: number, s: SessionInfo): boolean {
  if (s.start < s.end) {
    return utcH >= s.start && utcH < s.end;
  }
  // Wraps midnight (e.g. Sydney 22-07)
  return utcH >= s.start || utcH < s.end;
}

function sessionProgress(utcH: number, s: SessionInfo): number {
  let elapsed: number;
  const total = s.start < s.end ? s.end - s.start : (24 - s.start) + s.end;
  if (s.start < s.end) {
    elapsed = utcH - s.start;
  } else {
    elapsed = utcH >= s.start ? utcH - s.start : (24 - s.start) + utcH;
  }
  return Math.max(0, Math.min(1, elapsed / total));
}

function getCurrentSession(utcH: number): { session: SessionInfo; progress: number } | null {
  let best: SessionInfo | null = null;
  let bestProgress = 0;
  for (const s of SESSIONS) {
    if (isSessionActive(utcH, s)) {
      if (!best || s.priority > best.priority) {
        best = s;
        bestProgress = sessionProgress(utcH, s);
      }
    }
  }
  return best ? { session: best, progress: bestProgress } : null;
}

// ── Spread helpers ───────────────────────────────────────────────
function spreadInPips(spread: number, pipSize: number): number {
  return Math.round((spread / pipSize) * 10) / 10;
}

function spreadColor(pips: number): string {
  if (pips < 1.0) return 'text-emerald-400';
  if (pips <= 2.0) return 'text-amber-400';
  return 'text-red-400';
}

function spreadBg(pips: number): string {
  if (pips < 1.0) return 'border-emerald-500/20';
  if (pips <= 2.0) return 'border-amber-500/20';
  return 'border-red-500/20';
}

// ── Sparkline helpers ────────────────────────────────────────────
function generateSparklinePoints(equity: number, balance: number): number[] {
  // Generate a deterministic 20-point sparkline based on equity & balance
  const seed = Math.round(equity * 100 + balance * 7);
  const pts: number[] = [];
  let v = balance;
  for (let i = 0; i < 20; i++) {
    // Simple seeded pseudo-random walk
    const rand = Math.sin(seed * 9301 + i * 49297 + 233280) * 49297;
    const noise = ((rand - Math.floor(rand)) - 0.48) * (balance * 0.003);
    v = Math.max(balance * 0.95, v + noise);
    // Last point converges toward actual equity
    if (i === 19) v = equity;
    pts.push(v);
  }
  return pts;
}

function SparklineSVG({ points }: { points: number[] }) {
  const w = 60;
  const h = 16;
  const pad = 1;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;

  const coords = points.map((v, i) => {
    const x = pad + (i / (points.length - 1)) * (w - pad * 2);
    const y = h - pad - ((v - min) / range) * (h - pad * 2);
    return { x, y };
  });

  const pathD = coords.map((c, i) => (i === 0 ? `M${c.x},${c.y}` : `L${c.x},${c.y}`)).join(' ');
  const isUp = points[points.length - 1] >= points[0];
  const color = isUp ? '#34d399' : '#f87171'; // emerald-400 / red-400

  return (
    <div className="footer-sparkline-container">
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} fill="none">
        <path d={pathD} stroke={color} strokeWidth={1.2} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

// ── Daily Range Bar ──────────────────────────────────────────────
function DailyRangeBar({ high, low, current, digits }: { high: number; low: number; current: number; digits: number }) {
  const range = high - low;
  if (range <= 0) return null;
  const pos = ((current - low) / range) * 100;
  const isUp = current >= (high + low) / 2;

  return (
    <div className="flex flex-col items-center gap-px" style={{ width: 3, height: 14 }}>
      <div className="relative w-full flex-1 rounded-full bg-white/[0.06]">
        <div
          className="absolute left-1/2 -translate-x-1/2 w-[3px] rounded-full"
          style={{
            top: `${Math.max(0, Math.min(92, 100 - pos - 8))}%`,
            height: '8%',
            backgroundColor: isUp ? '#34d399' : '#f87171',
          }}
        />
      </div>
    </div>
  );
}

// ── Main Footer ──────────────────────────────────────────────────
export default function Footer() {
  const {
    prices, isConnected, openTrades, dailyPnl, isAutoTrading,
    marketConditions, totalPnl, balance, equity, selectedSymbol,
  } = useTradingStore();

  const now = new Date();
  const utcH = now.getUTCHours();
  const utcM = now.getUTCMinutes();
  const utcTime = now.toUTCString().split(' ')[4];

  // Session
  const sessionInfo = useMemo(() => getCurrentSession(utcH), [utcH]);

  // Sparkline
  const sparklinePoints = useMemo(() => generateSparklinePoints(equity, balance), [equity, balance]);

  // Spread for selected symbol
  const sym = selectedSymbol || SYMBOLS[0];
  const price = prices[sym];
  const spreadPips = price ? spreadInPips(price.spread, SYMBOL_INFO[sym].pipSize) : null;

  return (
    <TooltipProvider>
      <footer className="h-11 border-t border-border/60 bg-card/90 backdrop-blur-md flex items-center px-3 gap-3 text-[10px] shrink-0 z-40 relative">
        {/* Top gradient line */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />

        {/* ── Session Indicator ── */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1.5 cursor-default shrink-0">
              {sessionInfo ? (
                <>
                  <div className={`w-1.5 h-1.5 rounded-full ${sessionInfo.session.dotColor} ${sessionInfo.session.name === 'London' || sessionInfo.session.name === 'New York' ? 'animate-pulse' : ''}`} />
                  <span className="text-muted-foreground font-medium">{sessionInfo.session.name}</span>
                  <div className="footer-session-bar w-8">
                    <div
                      className={`footer-session-bar-fill ${sessionInfo.session.barColor}`}
                      style={{ width: `${sessionInfo.progress * 100}%` }}
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="w-1.5 h-1.5 rounded-full bg-slate-600" />
                  <span className="text-slate-600 font-medium">Closed</span>
                </>
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent side="top"><p className="text-[10px]">{sessionInfo ? `${sessionInfo.session.name} Session (${Math.round(sessionInfo.progress * 100)}% elapsed)` : 'Market Closed'}</p></TooltipContent>
        </Tooltip>

        {/* Glass separator */}
        <div className="w-px h-5 bg-gradient-to-b from-transparent via-white/10 to-transparent shrink-0" />

        {/* ── Market Ticker ── */}
        <div className="flex-1 overflow-hidden scroll-horizontal">
          <div className="flex items-center gap-6 animate-ticker">
            {SYMBOLS.map((s) => {
              const p = prices[s];
              if (!p) return null;
              const change = p.change;
              const color = change >= 0 ? 'text-emerald-400' : 'text-red-400';
              const mc = marketConditions[s];
              const mcColor = mc === 'trending' ? 'text-emerald-500' : mc === 'high_volatility' ? 'text-red-400' : mc === 'range_bound' ? 'text-amber-400' : 'text-slate-500';
              const symSpread = spreadInPips(p.spread, SYMBOL_INFO[s].pipSize);
              const symSpreadCol = spreadColor(symSpread);
              return (
                <div key={s} className="flex items-center gap-1.5 whitespace-nowrap group">
                  <span className="text-muted-foreground font-medium group-hover:text-foreground transition-colors">{SYMBOL_INFO[s].name}</span>
                  <span className={`tabular-nums font-semibold ${color} live-value`}>{p.bid.toFixed(SYMBOL_INFO[s].digits)}</span>
                  <span className={`${color} tabular-nums text-[9px]`}>{change >= 0 ? '▲' : '▼'}{Math.abs(change).toFixed(SYMBOL_INFO[s].digits)}</span>
                  {/* Spread badge */}
                  <span className={`footer-spread-badge ${symSpreadCol} ${spreadBg(symSpread)}`}>{symSpread}</span>
                  {/* Daily range bar */}
                  <DailyRangeBar high={p.high} low={p.low} current={p.bid} digits={SYMBOL_INFO[s].digits} />
                  <span className={`text-[9px] ${mcColor}`}>•{mc === 'trending' ? 'T' : mc === 'range_bound' ? 'R' : mc === 'high_volatility' ? 'V' : 'F'}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Glass separator */}
        <div className="w-px h-5 bg-gradient-to-b from-transparent via-white/10 to-transparent shrink-0" />

        {/* ── Mini Equity Sparkline ── */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="cursor-default shrink-0">
              <SparklineSVG points={sparklinePoints} />
            </div>
          </TooltipTrigger>
          <TooltipContent side="top"><p className="text-[10px]">Equity: ${equity.toFixed(2)} | Balance: ${balance.toFixed(2)}</p></TooltipContent>
        </Tooltip>

        {/* Glass separator */}
        <div className="w-px h-5 bg-gradient-to-b from-transparent via-white/10 to-transparent shrink-0" />

        {/* ── Spread for Selected Symbol ── */}
        {spreadPips !== null && (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="cursor-default shrink-0">
                <span className={`footer-spread-badge ${spreadColor(spreadPips)} ${spreadBg(spreadPips)}`}>
                  {SYMBOL_INFO[sym].name.replace('/', '')} {spreadPips}p
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent side="top"><p className="text-[10px]">{SYMBOL_INFO[sym].name} Spread: {spreadPips} pips</p></TooltipContent>
          </Tooltip>
        )}

        {/* Glass separator */}
        <div className="w-px h-5 bg-gradient-to-b from-transparent via-white/10 to-transparent shrink-0" />

        {/* ── Status Indicators ── */}
        <div className="flex items-center gap-2.5 shrink-0">
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1.5 cursor-default">
                <div className="relative">
                  <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-red-500'}`} />
                  {isConnected && <div className="absolute inset-0 w-1.5 h-1.5 rounded-full bg-emerald-500 dot-ping" />}
                </div>
                <span className={`font-semibold ${isConnected ? 'text-emerald-400' : 'text-red-400'}`}>{isConnected ? 'LIVE' : 'OFF'}</span>
              </div>
            </TooltipTrigger>
            <TooltipContent side="top"><p className="text-[10px]">Price Feed Status</p></TooltipContent>
          </Tooltip>
          {isAutoTrading && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-[9px] px-2 py-0 gap-1 neon-glow">
                  <span className="w-1 h-1 rounded-full bg-emerald-500 pulse-dot" />
                  AUTO
                </Badge>
              </TooltipTrigger>
              <TooltipContent side="top"><p className="text-[10px]">Auto Trading Active</p></TooltipContent>
            </Tooltip>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1.5 text-muted-foreground cursor-default">
                <span className="font-medium">{openTrades.length}</span>
                <span className="text-[9px]">pos</span>
                <div className="w-px h-3 bg-white/10" />
                <span className={`font-semibold tabular-nums ${dailyPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {dailyPnl >= 0 ? '+' : ''}{dailyPnl.toFixed(2)}
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent side="top"><p className="text-[10px]">Open Positions / Daily P&L</p></TooltipContent>
          </Tooltip>
        </div>

        {/* Glass separator */}
        <div className="w-px h-5 bg-gradient-to-b from-transparent via-white/10 to-transparent shrink-0" />

        {/* ── Right: Total P&L + UTC Time + Broker ── */}
        <div className="flex items-center gap-2.5 text-muted-foreground shrink-0">
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1 cursor-default">
                <span className="text-[9px]">TOTAL</span>
                <span className={`font-semibold tabular-nums ${totalPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {totalPnl >= 0 ? '+' : ''}{totalPnl.toFixed(2)}
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent side="top"><p className="text-[10px]">Total P&L (all closed trades)</p></TooltipContent>
          </Tooltip>
          <span className="tabular-nums font-medium">UTC {utcTime}</span>
          <span className="text-white/20">•</span>
          <span className="text-gradient-cool font-semibold text-[10px]">{BROKER_CONFIG.name}</span>
        </div>
      </footer>
    </TooltipProvider>
  );
}
