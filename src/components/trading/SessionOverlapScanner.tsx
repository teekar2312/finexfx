'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { STRATEGIES, SYMBOLS } from '@/lib/types';
import type { StrategyName, Symbol } from '@/lib/types';
import { Clock, Zap, TrendingUp, BarChart3, ArrowRight, Activity, Globe } from 'lucide-react';

// ---------- local session definitions ----------
const SESSIONS = [
  { id: 'sydney',   label: 'Sydney',   start: 22, end: 7,  color: '#06b6d4', bg: 'bg-cyan-500',   text: 'text-cyan-400',  border: 'border-cyan-500/30' },
  { id: 'tokyo',    label: 'Tokyo',    start: 0,  end: 9,  color: '#8b5cf6', bg: 'bg-violet-500', text: 'text-violet-400', border: 'border-violet-500/30' },
  { id: 'london',   label: 'London',   start: 8,  end: 17, color: '#10b981', bg: 'bg-emerald-500',text: 'text-emerald-400',border: 'border-emerald-500/30' },
  { id: 'newyork',  label: 'New York', start: 13, end: 22, color: '#f59e0b', bg: 'bg-amber-500',  text: 'text-amber-400',  border: 'border-amber-500/30' },
] as const;

type SessionId = 'sydney' | 'tokyo' | 'london' | 'newyork';

interface SessionBlock {
  id: SessionId;
  label: string;
  start: number;
  end: number;
  color: string;
  text: string;
  isActive: boolean;
}

interface OverlapInfo {
  id: string;
  label: string;
  session1: SessionId;
  session2: SessionId;
  start: number;
  end: number;
  color1: string;
  color2: string;
  volatility: 'Low' | 'Medium' | 'High' | 'Extreme';
  volatilityColor: string;
  description: string;
}

const OVERLAPS: OverlapInfo[] = [
  {
    id: 'tokyo-london',
    label: 'Tokyo–London',
    session1: 'tokyo', session2: 'london',
    start: 8, end: 9,
    color1: '#8b5cf6', color2: '#10b981',
    volatility: 'High',
    volatilityColor: 'text-amber-400',
    description: 'Asian-European transition - increased volume and directional moves',
  },
  {
    id: 'london-newyork',
    label: 'London–New York',
    session1: 'london', session2: 'newyork',
    start: 13, end: 17,
    color1: '#10b981', color2: '#f59e0b',
    volatility: 'Extreme',
    volatilityColor: 'text-red-400',
    description: 'Peak liquidity window - highest volatility and volume of the day',
  },
  {
    id: 'sydney-tokyo',
    label: 'Sydney–Tokyo',
    session1: 'sydney', session2: 'tokyo',
    start: 0, end: 7,
    color1: '#06b6d4', color2: '#8b5cf6',
    volatility: 'Low',
    volatilityColor: 'text-slate-400',
    description: 'Asian session - lower volatility, range-bound conditions',
  },
];

// best pairs per session
const SESSION_PAIRS: Record<SessionId, { symbol: Symbol; reason: string }[]> = {
  sydney: [
    { symbol: 'AUDUSD', reason: 'Sydney session - direct AUD exposure' },
    { symbol: 'NZDUSD', reason: 'Antipodean liquidity peak' },
  ],
  tokyo: [
    { symbol: 'USDJPY', reason: 'BoJ window - JPY volatility peak' },
    { symbol: 'AUDJPY', reason: 'Cross-pair Asian liquidity' },
  ],
  london: [
    { symbol: 'EURUSD', reason: 'ECB/London fix - highest EUR liquidity' },
    { symbol: 'GBPUSD', reason: 'Cable peak during London hours' },
  ],
  newyork: [
    { symbol: 'EURUSD', reason: 'Fed-driven USD moves' },
    { symbol: 'XAUUSD', reason: 'Gold peak volume NY session' },
  ],
};

// strategies per volatility level
const VOLATILITY_STRATEGIES: Record<string, StrategyName[]> = {
  Low: ['Pivot_Points', 'Linear_Regression', 'EMA_RSI_Filter'],
  Medium: ['EMA_Crossover', 'RMI_Trend_Sync', 'MA_Ribbon'],
  High: ['MA_Ribbon', 'Momentum_Scalping', 'EMA_Crossover'],
  Extreme: ['Momentum_Scalping'],
};


// pip ranges per session (typical)
const SESSION_PIP_RANGE: Record<SessionId, { min: number; max: number; avg: number }> = {
  sydney:  { min: 15, max: 35, avg: 25 },
  tokyo:   { min: 20, max: 45, avg: 30 },
  london:  { min: 40, max: 90, avg: 65 },
  newyork: { min: 50, max: 120, avg: 80 },
};

// ---------- helpers ----------

function getUtcHour(): number {
  const now = new Date();
  return now.getUTCHours() + now.getUTCMinutes() / 60 + now.getUTCSeconds() / 3600;
}

function isSessionActive(utcH: number, start: number, end: number): boolean {
  if (start < end) return utcH >= start && utcH < end;
  // wraps midnight (e.g. Sydney 22-7)
  return utcH >= start || utcH < end;
}

function timeRemainingInSession(utcH: number, end: number): number {
  if (utcH < end) return end - utcH;
  return 24 - utcH + end;
}

function timeUntilSessionStart(utcH: number, start: number): number {
  if (start > utcH) return start - utcH;
  return 24 - utcH + start;
}

function formatCountdown(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.floor((hours - h) * 60);
  const s = Math.floor(((hours - h) * 60 - m) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function getActiveSessions(utcH: number): SessionId[] {
  return SESSIONS.filter(s => isSessionActive(utcH, s.start, s.end)).map(s => s.id as SessionId);
}

function getActiveOverlaps(utcH: number): OverlapInfo[] {
  return OVERLAPS.filter(o => {
    if (o.start < o.end) return utcH >= o.start && utcH < o.end;
    return utcH >= o.start || utcH < o.end;
  });
}

function getNextOverlap(utcH: number): OverlapInfo | null {
  let best: OverlapInfo | null = null;
  let bestDist = 999;
  for (const o of OVERLAPS) {
    const dist = timeUntilSessionStart(utcH, o.start);
    if (dist < bestDist && dist > 0) {
      bestDist = dist;
      best = o;
    }
  }
  return best;
}

function getTimelineBlocks(utcH: number): SessionBlock[] {
  // render each session as a block on the 0-24 timeline
  return SESSIONS.map(s => ({
    id: s.id as SessionId,
    label: s.label,
    start: s.start,
    end: s.end,
    color: s.color,
    text: s.text,
    isActive: isSessionActive(utcH, s.start, s.end),
  }));
}

function blockToPosition(start: number, end: number): { left: string; width: string } {
  if (start < end) {
    return { left: `${(start / 24) * 100}%`, width: `${((end - start) / 24) * 100}%` };
  }
  // wraps midnight: two segments
  const w1 = 24 - start;
  const w2 = end;
  // just show the first segment for simplicity on the timeline
  return { left: `${(start / 24) * 100}%`, width: `${(w1 / 24) * 100}%` };
}

function blockToPositionWrap(start: number, end: number): { left1: string; width1: string; left2: string; width2: string } | { left: string; width: string } {
  if (start < end) {
    return { left: `${(start / 24) * 100}%`, width: `${((end - start) / 24) * 100}%` };
  }
  const w1 = 24 - start;
  return {
    left1: `${(start / 24) * 100}%`,
    width1: `${(w1 / 24) * 100}%`,
    left2: '0%',
    width2: `${(end / 24) * 100}%`,
  };
}

// ---------- component ----------

export default function SessionOverlapScanner() {
  const [utcH, setUtcH] = useState(getUtcHour());
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => {
      setUtcH(getUtcHour());
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const activeSessions = useMemo(() => getActiveSessions(utcH), [utcH]);
  const activeOverlaps = useMemo(() => getActiveOverlaps(utcH), [utcH]);
  const nextOverlap = useMemo(() => getNextOverlap(utcH), [utcH]);
  const timelineBlocks = useMemo(() => getTimelineBlocks(utcH), [utcH]);

  // current volatility - max of active overlaps, else based on active sessions
  const currentVolatility = useMemo((): 'Low' | 'Medium' | 'High' | 'Extreme' => {
    if (activeOverlaps.length > 0) {
      const volOrder = ['Low', 'Medium', 'High', 'Extreme'];
      const maxVol = activeOverlaps.reduce((best, o) => {
        return volOrder.indexOf(o.volatility) > volOrder.indexOf(best) ? o.volatility : best;
      }, 'Low' as string);
      return maxVol as 'Low' | 'Medium' | 'High' | 'Extreme';
    }
    if (activeSessions.includes('london') || activeSessions.includes('newyork')) return 'Medium';
    if (activeSessions.includes('tokyo')) return 'Low';
    return 'Low';
  }, [activeOverlaps, activeSessions]);

  // current session for stats (priority: NY > London > Tokyo > Sydney)
  const currentSessionId = useMemo((): SessionId | null => {
    const priority: SessionId[] = ['newyork', 'london', 'tokyo', 'sydney'];
    for (const s of priority) {
      if (activeSessions.includes(s)) return s;
    }
    return null;
  }, [activeSessions]);

  const currentSessionMeta = useMemo(() => {
    if (!currentSessionId) return null;
    return SESSIONS.find(s => s.id === currentSessionId)!;
  }, [currentSessionId]);

  // next session
  const nextSessionId = useMemo((): SessionId | null => {
    const priority: SessionId[] = ['newyork', 'london', 'tokyo', 'sydney'];
    let best: SessionId | null = null;
    let bestDist = 999;
    for (const s of priority) {
      const meta = SESSIONS.find(sm => sm.id === s)!;
      if (activeSessions.includes(s)) continue;
      const dist = timeUntilSessionStart(utcH, meta.start);
      if (dist > 0 && dist < bestDist) {
        bestDist = dist;
        best = s;
      }
    }
    return best;
  }, [utcH, activeSessions]);

  const nextSessionMeta = useMemo(() => {
    if (!nextSessionId) return null;
    return SESSIONS.find(s => s.id === nextSessionId)!;
  }, [nextSessionId]);

  // recommended strategies
  const recommendedStrategies = useMemo(() => {
    return VOLATILITY_STRATEGIES[currentVolatility] || [];
  }, [currentVolatility]);

  // recommended pairs
  const recommendedPairs = useMemo(() => {
    const pairs: { symbol: Symbol; reason: string }[] = [];
    for (const s of activeSessions) {
      const sp = SESSION_PAIRS[s];
      if (sp) pairs.push(...sp);
    }
    if (pairs.length === 0) {
      // default
      pairs.push({ symbol: 'EURUSD', reason: 'Most liquid pair' });
    }
    return pairs;
  }, [activeSessions]);

  // volatility bar percentage
  const volPct = useMemo(() => {
    const map: Record<string, number> = { Low: 20, Medium: 45, High: 70, Extreme: 95 };
    return map[currentVolatility];
  }, [currentVolatility]);

  const volColor = useMemo(() => {
    const map: Record<string, string> = {
      Low: 'bg-slate-500',
      Medium: 'bg-amber-500',
      High: 'bg-orange-500',
      Extreme: 'bg-red-500',
    };
    return map[currentVolatility];
  }, [currentVolatility]);

  const currentUtcTime = useMemo(() => {
    const d = new Date();
    return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}:${String(d.getUTCSeconds()).padStart(2, '0')} UTC`;
  }, [now]);

  const timeMarkerLeft = `${(utcH / 24) * 100}%`;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Globe className="w-3.5 h-3.5 text-cyan-400" />
          <h3 className="section-title-accent text-xs font-semibold">Session Overlap Scanner</h3>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="pulse-dot w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />\n          <span className="text-[9px] text-muted-foreground tabular-nums live-value">{currentUtcTime}</span>
        </div>
      </div>

      {/* 24h Timeline Bar */}
      <div className="glass-card p-3 space-y-1.5">
        <div className="flex items-center justify-between text-[9px] text-muted-foreground mb-1">
          <span>00:00</span>
          <span>06:00</span>
          <span>12:00</span>
          <span>18:00</span>
          <span>24:00</span>
        </div>
        <div className="relative h-8 rounded-md overflow-hidden bg-black/30">
          {/* Session blocks */}
          {timelineBlocks.map(block => {
            const pos = blockToPositionWrap(block.start, block.end);
            if ('left1' in pos) {
              return (
                <div key={block.id}>
                  <div
                    className={`absolute top-0 h-full rounded-l-sm transition-opacity duration-500 ${
                      block.isActive ? 'opacity-90' : 'opacity-30'
                    }`}
                    style={{
                      left: pos.left1,
                      width: pos.width1,
                      backgroundColor: block.color,
                      boxShadow: block.isActive ? `0 0 12px ${block.color}60` : 'none',
                    }}
                  />
                  <div
                    className={`absolute top-0 h-full rounded-r-sm transition-opacity duration-500 ${
                      block.isActive ? 'opacity-90' : 'opacity-30'
                    }`}
                    style={{
                      left: pos.left2,
                      width: pos.width2,
                      backgroundColor: block.color,
                      boxShadow: block.isActive ? `0 0 12px ${block.color}60` : 'none',
                    }}
                  />
                </div>
              );
            }
            return (
              <div
                key={block.id}
                className={`absolute top-0 h-full rounded-sm transition-opacity duration-500 ${
                  block.isActive ? 'opacity-90' : 'opacity-30'
                }`}
                style={{
                  left: pos.left,
                  width: pos.width,
                  backgroundColor: block.color,
                  boxShadow: block.isActive ? `0 0 12px ${block.color}60` : 'none',
                }}
              />
            );
          })}

          {/* Overlap highlights */}
          {OVERLAPS.map(o => {
            const pos = blockToPosition(o.start, o.end);
            const isActive = activeOverlaps.some(ao => ao.id === o.id);
            return (
              <div
                key={o.id}
                className={`absolute top-0 h-full transition-opacity duration-500 ${
                  isActive ? 'opacity-70' : 'opacity-10'
                }`}
                style={{
                  left: pos.left,
                  width: pos.width,
                  background: `repeating-linear-gradient(45deg, ${o.color1}40, ${o.color1}40 2px, ${o.color2}40 2px, ${o.color2}40 4px)`,
                }}
              />
            );
          })}

          {/* UTC time marker */}
          <motion.div
            className="absolute top-0 h-full w-0.5 bg-white z-10"
            style={{ left: timeMarkerLeft }}
            animate={{ opacity: [0.6, 1, 0.6] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          >
            <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_6px_rgba(255,255,255,0.8)]" />
          </motion.div>
        </div>

        {/* Session legend */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {SESSIONS.map(s => {
            const active = activeSessions.includes(s.id as SessionId);
            return (
              <div key={s.id} className="flex items-center gap-1">
                <span
                  className={`w-2 h-2 rounded-sm transition-all duration-300 ${active ? 'badge-pulse' : 'opacity-40'}`}
                  style={{ backgroundColor: s.color, boxShadow: active ? `0 0 6px ${s.color}` : 'none' }}
                />\n                <span className={`text-[9px] ${active ? s.text : 'text-muted-foreground'}`}>{s.label}</span>
              </div>
            );
          })}
          <span className="text-[9px] text-muted-foreground ml-auto">
            {activeSessions.length > 0 ? `${activeSessions.length} active` : 'No active sessions'}
          </span>
        </div>
      </div>

      {/* Grid: Overlaps + Volatility + Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">

        {/* Overlap Detection Card */}
        <div className="glass-card-premium rounded-xl card-hover-lift p-3 space-y-2 sm:col-span-2 lg:col-span-2">
          <div className="flex items-center gap-1.5 mb-1">
            <Zap className="w-3 h-3 text-amber-400" />\n            <span className="text-[10px] font-medium">Overlap Zones</span>
          </div>

          <div className="space-y-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
            <AnimatePresence mode="popLayout">
              {activeOverlaps.map(o => (
                <motion.div
                  key={o.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.3 }}
                  className="rounded-md p-2.5 border border-emerald-500/30 bg-emerald-500/5 shadow-[0_0_12px_rgba(16,185,129,0.1)]"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className="pulse-dot w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />\n                      <span className="text-[10px] font-semibold text-emerald-300">{o.label}</span>
                      <span className="text-[8px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded-full">ACTIVE</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[9px] text-muted-foreground">Closes in</span>
                      <span className="text-[10px] font-mono tabular-nums text-emerald-300 live-value">
                        {formatCountdown(timeRemainingInSession(utcH, o.end))}
                      </span>
                    </div>
                  </div>
                  <p className="text-[9px] text-muted-foreground mb-1.5">{o.description}</p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <Activity className="w-2.5 h-2.5 text-muted-foreground" />
                      <span className="text-[9px] text-muted-foreground">Volatility:</span>
                      <span className={`text-[9px] font-semibold ${o.volatilityColor}`}>{o.volatility}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="w-2.5 h-2.5 text-muted-foreground" />
                      <span className="text-[9px] text-muted-foreground">{String(o.start).padStart(2, '0')}:00–{String(o.end).padStart(2, '0')}:00 UTC</span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {/* Upcoming overlaps */}
            {activeOverlaps.length === 0 && nextOverlap && (
              <div className="rounded-md p-2.5 border border-green-500/20 bg-green-500/5">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    <ArrowRight className="w-3 h-3 text-green-400" />
                    <span className="text-[10px] font-semibold text-green-300">Next: {nextOverlap.label}</span>
                  </div>
                  <span className="text-[10px] font-mono tabular-nums text-green-300 live-value">
                    in {formatCountdown(timeUntilSessionStart(utcH, nextOverlap.start))}
                  </span>
                </div>
                <p className="text-[9px] text-muted-foreground">{nextOverlap.description}</p>
                <div className="flex items-center gap-1 mt-1">
                  <Activity className="w-2.5 h-2.5 text-muted-foreground" />\n                  <span className="text-[9px] text-muted-foreground">Expected Volatility:</span>
                  <span className={`text-[9px] font-semibold ${nextOverlap.volatilityColor}`}>{nextOverlap.volatility}</span>
                </div>
              </div>
            )}

            {/* All overlaps summary when none active and no upcoming soon */}
            {activeOverlaps.length === 0 && !nextOverlap && (
              <div className="text-center py-3">
                <p className="text-[9px] text-muted-foreground">No overlap zones - checking...</p>
              </div>
            )}
          </div>

          {/* Quick upcoming overlaps list */}
          {OVERLAPS.map(o => {
            const isAct = activeOverlaps.some(ao => ao.id === o.id);
            if (isAct) return null;
            const dist = timeUntilSessionStart(utcH, o.start);
            if (dist > 12) return null; // don't show if too far
            return (
              <div key={`up-${o.id}`} className="flex items-center justify-between text-[9px] py-1 border-t border-white/5">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-sm opacity-60" style={{ background: `linear-gradient(135deg, ${o.color1}, ${o.color2})` }} />
                  <span className="text-muted-foreground">{o.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`font-medium ${o.volatilityColor}`}>{o.volatility}</span>
                  <span className="tabular-nums text-muted-foreground">{formatCountdown(dist)}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Volatility Prediction Card */}
        <div className="glass-card-premium rounded-xl card-hover-lift p-3 space-y-2.5">
          <div className="flex items-center gap-1.5 mb-1">
            <BarChart3 className="w-3 h-3 text-orange-400" />\n            <span className="text-[10px] font-medium">Volatility Prediction</span>
          </div>

          {/* Volatility gauge */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[9px] text-muted-foreground">Current Level</span>
              <motion.span
                key={currentVolatility}
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className={`text-[10px] font-bold ${
                  currentVolatility === 'Extreme' ? 'text-red-400' :
                  currentVolatility === 'High' ? 'text-orange-400' :
                  currentVolatility === 'Medium' ? 'text-amber-400' :
                  'text-slate-400'
                }`}
              >
                {currentVolatility}
              </motion.span>
            </div>
            <div className="h-2 rounded-full bg-black/40 overflow-hidden">
              <motion.div
                className={`h-full rounded-full ${volColor}`}
                initial={{ width: 0 }}
                animate={{ width: `${volPct}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
              />
            </div>
            <div className="flex justify-between text-[8px] text-muted-foreground">
              <span>Low</span><span>Med</span><span>High</span><span>Extreme</span>
            </div>
          </div>

          {/* Recommended Strategies */}
          <div className="space-y-1.5">
            <span className="text-[9px] text-muted-foreground">Recommended Strategies</span>
            <div className="space-y-1">
              {recommendedStrategies.map(sName => {
                const strat = STRATEGIES[sName];
                return (
                  <div key={sName} className="flex items-start gap-1.5 p-1.5 rounded bg-white/[0.02] hover:bg-white/[0.04] transition-colors">
                    <TrendingUp className="w-2.5 h-2.5 text-emerald-400 mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <span className="text-[9px] font-medium block">{strat.label}</span>
                      <span className="text-[8px] text-muted-foreground block truncate">{strat.timeframe} · {strat.indicators.slice(0, 2).join(', ')}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recommended Pairs */}
          <div className="space-y-1.5">
            <span className="text-[9px] text-muted-foreground">Best Pairs Now</span>
            <div className="space-y-1">
              {recommendedPairs.slice(0, 3).map((p, i) => (
                <div key={i} className="flex items-center justify-between p-1.5 rounded bg-white/[0.02]">
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    <span className="text-[9px] font-medium font-mono">{p.symbol}</span>
                  </div>
                  <span className="text-[8px] text-muted-foreground truncate max-w-[100px] text-right">{p.reason}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Session Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Current Session */}
        {currentSessionMeta && currentSessionId && (
          <div className="glass-card card-hover p-3 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[9px] text-muted-foreground">Current Session</span>
              <span className="pulse-dot w-1.5 h-1.5 rounded-full inline-block" style={{ backgroundColor: currentSessionMeta.color }} />
            </div>
            <span className="text-[10px] font-semibold" style={{ color: currentSessionMeta.color }}>{currentSessionMeta.label}</span>
            <div className="flex items-center justify-between">
              <span className="text-[8px] text-muted-foreground">Time Remaining</span>
              <span className="text-[9px] font-mono tabular-nums live-value">
                {formatCountdown(timeRemainingInSession(utcH, SESSIONS.find(s => s.id === currentSessionId)!.end))}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[8px] text-muted-foreground">Typical Pip Range</span>
              <span className="text-[9px] font-mono tabular-nums">
                {SESSION_PIP_RANGE[currentSessionId].min}–{SESSION_PIP_RANGE[currentSessionId].max}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[8px] text-muted-foreground">Avg Daily Range</span>
              <span className="text-[9px] font-mono tabular-nums metric-compact">
                {SESSION_PIP_RANGE[currentSessionId].avg} pips
              </span>
            </div>
          </div>
        )}

        {/* No active session fallback */}
        {!currentSessionMeta && (
          <div className="glass-card p-3 space-y-1.5">
            <span className="text-[9px] text-muted-foreground">Current Session</span>
            <span className="text-[10px] text-muted-foreground">Between Sessions</span>
            <span className="text-[8px] text-muted-foreground">Low liquidity - avoid trading</span>
          </div>
        )}

        {/* Next Session */}
        {nextSessionMeta && nextSessionId && (
          <div className="glass-card card-hover p-3 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[9px] text-muted-foreground">Next Session</span>
              <ArrowRight className="w-3 h-3 text-muted-foreground" />
            </div>
            <span className="text-[10px] font-semibold" style={{ color: nextSessionMeta.color }}>{nextSessionMeta.label}</span>
            <div className="flex items-center justify-between">
              <span className="text-[8px] text-muted-foreground">Opens In</span>
              <motion.span
                className="text-[9px] font-mono tabular-nums live-value text-green-400"
                key={Math.floor(utcH)}
                initial={{ opacity: 0.7 }}
                animate={{ opacity: 1 }}
              >
                {formatCountdown(timeUntilSessionStart(utcH, SESSIONS.find(s => s.id === nextSessionId)!.start))}
              </motion.span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[8px] text-muted-foreground">Expected Range</span>
              <span className="text-[9px] font-mono tabular-nums">
                {SESSION_PIP_RANGE[nextSessionId].min}–{SESSION_PIP_RANGE[nextSessionId].max} pips
              </span>
            </div>
          </div>
        )}

        {/* Best Session per Pair */}
        <div className="glass-card p-3 space-y-1.5 sm:col-span-2">
          <div className="flex items-center gap-1.5 mb-1">
            <BarChart3 className="w-3 h-3 text-violet-400" />
            <span className="text-[9px] text-muted-foreground">Best Session by Pair</span>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {SYMBOLS.map(sym => {
              // determine best session based on currency exposure
              let bestSession: { id: SessionId; reason: string };
              if (sym === 'USDJPY') {
                bestSession = { id: 'tokyo', reason: 'JPY peak' };
              } else if (sym === 'XAUUSD') {
                bestSession = { id: 'newyork', reason: 'Gold peak vol' };
              } else if (sym === 'GBPUSD') {
                bestSession = { id: 'london', reason: 'Cable session' };
              } else {
                bestSession = { id: 'london', reason: 'EUR liquidity' };
              }
              const meta = SESSIONS.find(s => s.id === bestSession.id)!;
              const isActive = activeSessions.includes(bestSession.id);
              return (
                <div
                  key={sym}
                  className={`flex items-center justify-between p-1.5 rounded text-[9px] ${
                    isActive ? 'bg-white/[0.04]' : 'bg-white/[0.01]'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`w-2 h-2 rounded-sm ${isActive ? 'badge-pulse' : 'opacity-40'}`}
                      style={{ backgroundColor: meta.color }}
                    />
                    <span className="font-mono font-medium">{sym}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span style={{ color: meta.color }}>{meta.label}</span>
                    {isActive && (
                      <span className="text-[7px] bg-emerald-500/20 text-emerald-400 px-1 py-0.5 rounded-full">NOW</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
