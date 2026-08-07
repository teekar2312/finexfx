'use client';

import { useMemo, useState, memo } from 'react';
import { motion } from 'framer-motion';
import { useTradingStore } from '@/store/trading-store';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  CartesianGrid,
} from 'recharts';
import { TrendingDown, Activity, DollarSign, Clock, ArrowRight } from 'lucide-react';

// ── Constants ──────────────────────────────────────────────
const INITIAL_BALANCE = 10000;

type Timeframe = 'today' | 'week' | 'month' | 'all';

interface EquityPoint {
  label: string;
  equity: number;
  peak: number;
}

interface DrawdownPoint {
  label: string;
  drawdown: number;
}

// ── Animation Variants ─────────────────────────────────────
const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};
const item = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};

// ── Timeframe helpers ─────────────────────────────────────
function isInTimeframe(closedAt: string, tf: Timeframe): boolean {
  const d = new Date(closedAt);
  const now = new Date();
  switch (tf) {
    case 'today': {
      return d.toDateString() === now.toDateString();
    }
    case 'week': {
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay() + 1); // Monday
      startOfWeek.setHours(0, 0, 0, 0);
      return d >= startOfWeek;
    }
    case 'month': {
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }
    case 'all':
      return true;
  }
}

// ── Metric Card (memoized) ────────────────────────────────
interface MetricCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
}
const MetricCard = memo(function MetricCard({ icon, label, value, color }: MetricCardProps) {
  return (
    <div className="glass-card-premium rounded-xl p-4 flex items-center gap-3">
      <div className={`p-2 rounded-lg ${color}`}>{icon}</div>
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground truncate">{label}</div>
        <div className="font-mono text-sm font-semibold truncate">{value}</div>
      </div>
    </div>
  );
});

// ── Custom Tooltip (memoized) ─────────────────────────────
interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string; dataKey: string }>;
  label?: string;
}
const EquityTooltip = memo(function EquityTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-card-premium rounded-lg p-3 border border-border/50 shadow-xl min-w-[140px]">
      <div className="text-[10px] text-muted-foreground mb-1.5">{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex items-center justify-between gap-3 text-xs">
          <span className="text-muted-foreground flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: p.color }} />
            {p.name}
          </span>
          <span className="font-mono font-medium">
            ${p.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
      ))}
    </div>
  );
});

const DrawdownTooltip = memo(function DrawdownTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-card-premium rounded-lg p-3 border border-border/50 shadow-xl min-w-[140px]">
      <div className="text-[10px] text-muted-foreground mb-1.5">{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex items-center justify-between gap-3 text-xs">
          <span className="text-muted-foreground flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: p.color }} />
            {p.name}
          </span>
          <span className="font-mono font-medium text-red-400">
            -{p.value.toFixed(2)}%
          </span>
        </div>
      ))}
    </div>
  );
});

// ── Timeframe Button ──────────────────────────────────────
interface TimeframeButtonProps {
  label: string;
  active: boolean;
  onClick: () => void;
}
const TimeframeButton = memo(function TimeframeButton({ label, active, onClick }: TimeframeButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
        active
          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
          : 'text-muted-foreground hover:text-foreground border border-transparent hover:border-border/50'
      }`}
    >
      {label}
    </button>
  );
});

// ── Main Component ────────────────────────────────────────
export default function DrawdownChart() {
  // Individual Zustand selector — NOT full store
  const closedTrades = useTradingStore((s) => s.closedTrades);
  const [timeframe, setTimeframe] = useState<Timeframe>('all');

  // Filter trades by timeframe
  const filteredTrades = useMemo(
    () => {
      // closedTrades are prepended (most recent first) — reverse for chronological
      return [...closedTrades]
        .filter((t) => t.status === 'closed' && t.closedAt && isInTimeframe(t.closedAt, timeframe))
        .reverse();
    },
    [closedTrades, timeframe],
  );

  // Build equity curve data
  const equityData = useMemo<EquityPoint[]>(() => {
    if (filteredTrades.length === 0) return [];
    const points: EquityPoint[] = [];
    let equity = INITIAL_BALANCE;
    let peak = INITIAL_BALANCE;
    // Include the starting point
    points.push({ label: 'Start', equity, peak });
    for (const trade of filteredTrades) {
      equity += trade.profit;
      peak = Math.max(peak, equity);
      const label = trade.closedAt
        ? new Date(trade.closedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
        : `#${points.length}`;
      points.push({ label, equity: Math.round(equity * 100) / 100, peak: Math.round(peak * 100) / 100 });
    }
    return points;
  }, [filteredTrades]);

  // Build drawdown data
  const drawdownData = useMemo<DrawdownPoint[]>(() => {
    if (equityData.length === 0) return [];
    return equityData.map((p) => ({
      label: p.label,
      drawdown: Math.round(((p.peak - p.equity) / p.peak) * 10000) / 100,
    }));
  }, [equityData]);

  // Compute Y-axis domains
  const equityDomain = useMemo(() => {
    if (equityData.length === 0) return [INITIAL_BALANCE - 500, INITIAL_BALANCE + 500];
    const values = equityData.flatMap((p) => [p.equity, p.peak]);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const padding = Math.max((max - min) * 0.15, 50);
    return [Math.floor((min - padding) / 100) * 100, Math.ceil((max + padding) / 100) * 100];
  }, [equityData]);

  const drawdownDomain = useMemo(() => {
    if (drawdownData.length === 0) return [0, 5];
    const maxDD = Math.max(...drawdownData.map((d) => d.drawdown), 1);
    // Domain: [max, 0] so 0 is at top
    return [Math.ceil(maxDD * 1.2 / 5) * 5, 0];
  }, [drawdownData]);

  // Compute key metrics
  const metrics = useMemo(() => {
    if (filteredTrades.length === 0) {
      return {
        maxDrawdownDollar: 0,
        maxDrawdownPct: 0,
        currentDrawdown: 0,
        recoveryFactor: 0,
        longestDrawdownPeriod: 0,
      };
    }

    let equity = INITIAL_BALANCE;
    let peak = INITIAL_BALANCE;
    let maxDD$ = 0;
    let maxDDPct = 0;
    const drawdowns: number[] = [];
    let longestStreak = 0;
    let currentStreak = 0;

    for (const trade of filteredTrades) {
      equity += trade.profit;
      peak = Math.max(peak, equity);
      const dd$ = peak - equity;
      const ddPct = (dd$ / peak) * 100;
      maxDD$ = Math.max(maxDD$, dd$);
      maxDDPct = Math.max(maxDDPct, ddPct);
      drawdowns.push(ddPct);

      if (trade.profit < 0) {
        currentStreak++;
        longestStreak = Math.max(longestStreak, currentStreak);
      } else {
        currentStreak = 0;
      }
    }

    const currentDD = drawdowns.length > 0 ? drawdowns[drawdowns.length - 1] : 0;
    const totalProfit = filteredTrades.reduce((sum, t) => sum + t.profit, 0);
    const recoveryFactor = maxDD$ > 0 ? totalProfit / maxDD$ : 0;

    return {
      maxDrawdownDollar: Math.round(maxDD$ * 100) / 100,
      maxDrawdownPct: Math.round(maxDDPct * 100) / 100,
      currentDrawdown: Math.round(currentDD * 100) / 100,
      recoveryFactor: Math.round(recoveryFactor * 100) / 100,
      longestDrawdownPeriod: longestStreak,
    };
  }, [filteredTrades]);

  // Empty state
  if (equityData.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="glass-card-premium rounded-2xl p-12 flex flex-col items-center justify-center gap-4 min-h-[400px]"
      >
        <div className="p-4 rounded-full bg-slate-800/60">
          <TrendingDown className="h-8 w-8 text-slate-500" />
        </div>
        <p className="text-sm text-muted-foreground text-center max-w-[300px]">
          No closed trades yet. Complete trades to see your equity curve.
        </p>
      </motion.div>
    );
  }

  const formatEquityTick = (v: number) => `$${v.toLocaleString()}`;
  const formatDrawdownTick = (v: number) => `${v.toFixed(0)}%`;

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="flex flex-col gap-4"
    >
      {/* Header: title + timeframe filter */}
      <motion.div variants={item} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-emerald-400" />
          <h3 className="text-sm font-semibold">Equity Curve &amp; Drawdown</h3>
        </div>
        <div className="flex items-center gap-1.5">
          {([['today', 'Today'], ['week', 'This Week'], ['month', 'This Month'], ['all', 'All Time']] as const).map(
            ([key, label]) => (
              <TimeframeButton
                key={key}
                label={label}
                active={timeframe === key}
                onClick={() => setTimeframe(key)}
              />
            ),
          )}
        </div>
      </motion.div>

      {/* Key Metrics Cards */}
      <motion.div variants={item} className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <MetricCard
          icon={<DollarSign className="h-4 w-4" />}
          label="Max Drawdown ($)"
          value={`$${metrics.maxDrawdownDollar.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
          color="bg-red-500/15 text-red-400"
        />
        <MetricCard
          icon={<TrendingDown className="h-4 w-4" />}
          label="Max Drawdown (%)"
          value={`${metrics.maxDrawdownPct.toFixed(2)}%`}
          color="bg-red-500/15 text-red-400"
        />
        <MetricCard
          icon={<Activity className="h-4 w-4" />}
          label="Current Drawdown"
          value={`${metrics.currentDrawdown.toFixed(2)}%`}
          color="bg-amber-500/15 text-amber-400"
        />
        <MetricCard
          icon={<ArrowRight className="h-4 w-4" />}
          label="Recovery Factor"
          value={metrics.recoveryFactor.toFixed(2)}
          color="bg-emerald-500/15 text-emerald-400"
        />
        <MetricCard
          icon={<Clock className="h-4 w-4" />}
          label="Longest DD Streak"
          value={`${metrics.longestDrawdownPeriod} trades`}
          color="bg-slate-500/15 text-slate-400"
        />
      </motion.div>

      {/* Equity Curve Chart */}
      <motion.div variants={item} className="glass-card-premium rounded-xl p-4">
        <div className="text-xs text-muted-foreground mb-3 font-medium">Equity Curve</div>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={equityData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="equityGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity={0.35} />
                <stop offset="50%" stopColor="#10b981" stopOpacity={0.08} />
                <stop offset="50%" stopColor="#ef4444" stopOpacity={0.08} />
                <stop offset="100%" stopColor="#ef4444" stopOpacity={0.3} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: '#64748b' }}
              axisLine={{ stroke: 'rgba(255,255,255,0.06)' }}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              domain={equityDomain}
              tickFormatter={formatEquityTick}
              tick={{ fontSize: 10, fill: '#64748b' }}
              axisLine={{ stroke: 'rgba(255,255,255,0.06)' }}
              tickLine={false}
              width={65}
            />
            <Tooltip content={<EquityTooltip />} />
            <ReferenceLine
              y={INITIAL_BALANCE}
              stroke="#64748b"
              strokeDasharray="6 4"
              strokeWidth={1}
              label={{ value: 'Initial', position: 'insideTopRight', fill: '#64748b', fontSize: 10 }}
            />
            <Area
              type="monotone"
              dataKey="equity"
              name="Equity"
              stroke="#10b981"
              strokeWidth={2}
              fill="url(#equityGradient)"
              dot={equityData.length <= 30 ? { r: 2, fill: '#10b981' } : false}
              activeDot={{ r: 4, fill: '#10b981', stroke: '#0f172a', strokeWidth: 2 }}
            />
            <Area
              type="stepAfter"
              dataKey="peak"
              name="Peak"
              stroke="#94a3b8"
              strokeWidth={1}
              strokeDasharray="5 3"
              fill="none"
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </motion.div>

      {/* Drawdown Chart */}
      <motion.div variants={item} className="glass-card-premium rounded-xl p-4">
        <div className="text-xs text-muted-foreground mb-3 font-medium">Drawdown (%)</div>
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={drawdownData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="drawdownGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ef4444" stopOpacity={0.0} />
                <stop offset="40%" stopColor="#ef4444" stopOpacity={0.15} />
                <stop offset="100%" stopColor="#ef4444" stopOpacity={0.45} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: '#64748b' }}
              axisLine={{ stroke: 'rgba(255,255,255,0.06)' }}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              domain={drawdownDomain}
              tickFormatter={formatDrawdownTick}
              tick={{ fontSize: 10, fill: '#64748b' }}
              axisLine={{ stroke: 'rgba(255,255,255,0.06)' }}
              tickLine={false}
              width={50}
            />
            <Tooltip content={<DrawdownTooltip />} />
            {/* Reference lines at -5%, -10%, -20% */}
            {drawdownDomain[0] >= 5 && (
              <ReferenceLine y={5} stroke="#f59e0b" strokeDasharray="4 3" strokeWidth={0.8} label={{ value: '-5%', position: 'insideTopRight', fill: '#f59e0b', fontSize: 9 }} />
            )}
            {drawdownDomain[0] >= 10 && (
              <ReferenceLine y={10} stroke="#f97316" strokeDasharray="4 3" strokeWidth={0.8} label={{ value: '-10%', position: 'insideTopRight', fill: '#f97316', fontSize: 9 }} />
            )}
            {drawdownDomain[0] >= 20 && (
              <ReferenceLine y={20} stroke="#ef4444" strokeDasharray="4 3" strokeWidth={0.8} label={{ value: '-20%', position: 'insideTopRight', fill: '#ef4444', fontSize: 9 }} />
            )}
            <Area
              type="monotone"
              dataKey="drawdown"
              name="Drawdown"
              stroke="#ef4444"
              strokeWidth={1.5}
              fill="url(#drawdownGradient)"
              dot={false}
              activeDot={{ r: 4, fill: '#ef4444', stroke: '#0f172a', strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </motion.div>
    </motion.div>
  );
}
