'use client';

import { useState, useMemo, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Award,
  TrendingUp,
  TrendingDown,
  Calendar,
  Target,
  Zap,
  BarChart3,
  Activity,
  Clock,
  Star,
} from 'lucide-react';
import { useTradingStore } from '@/store/trading-store';

// ─── Types ───────────────────────────────────────────────────────────────────

interface DayData {
  date: string;
  dayLabel: string;
  trades: number;
  winRate: number;
  pnl: number;
  bestPair: string;
  bestStrategy: string;
  sparkline: number[];
}

interface WeekSummary {
  weekIndex: number;
  label: string;
  totalPnl: number;
  avgDailyPnl: number;
  bestDay: string;
  worstDay: string;
  winRate: number;
  sharpeScore: number;
  sparkline: number[];
  days: DayData[];
}

interface MonthlySummary {
  totalPnl: number;
  totalTrades: number;
  winRate: number;
  bestWeek: number;
  consistencyScore: number;
  grade: string;
  gradeColor: 'emerald' | 'amber' | 'red';
  totalSessions: number;
  monthLabel: string;
}

type Timeframe = 'weekly' | 'monthly';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pnlColor(value: number): string {
  if (value > 0) return 'text-emerald-400';
  if (value < 0) return 'text-red-400';
  return 'text-amber-400';
}

function formatPnl(value: number): string {
  return `${value > 0 ? '+' : ''}$${value.toFixed(1)}`;
}

function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function buildWeeklyData(
  closedTrades: { profit: number; symbol: string; strategy?: string; closedAt?: string }[],
): WeekSummary[] {
  if (closedTrades.length === 0) return [];

  // Group trades by week (Monday-based) then by day
  const weekMap = new Map<string, Map<string, typeof closedTrades>>();

  for (const trade of closedTrades) {
    if (!trade.closedAt) continue;
    const closedDate = new Date(trade.closedAt);
    const monday = getMonday(closedDate);
    const weekKey = monday.toISOString().slice(0, 10);
    const dayKey = closedDate.toISOString().slice(0, 10);

    if (!weekMap.has(weekKey)) weekMap.set(weekKey, new Map());
    const dayMap = weekMap.get(weekKey)!;
    if (!dayMap.has(dayKey)) dayMap.set(dayKey, []);
    dayMap.get(dayKey)!.push(trade);
  }

  // Sort weeks chronologically
  const sortedWeeks = [...weekMap.entries()].sort(
    (a, b) => a[0].localeCompare(b[0]),
  );

  const weeks: WeekSummary[] = [];

  sortedWeeks.forEach(([weekKey, dayMap], wIdx) => {
    const monday = new Date(weekKey + 'T00:00:00');
    const friday = new Date(monday);
    friday.setDate(friday.getDate() + 4);

    const weekLabel = `${monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}–${friday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;

    const days: DayData[] = [];
    const sortedDays = [...dayMap.entries()].sort((a, b) =>
      a[0].localeCompare(b[0]),
    );

    let weekPnl = 0;
    let weekTradeCount = 0;
    let weekWins = 0;

    sortedDays.forEach(([, trades]) => {
      const sortedTrades = [...trades].sort(
        (a, b) =>
          new Date(a.closedAt!).getTime() - new Date(b.closedAt!).getTime(),
      );

      const tradeCount = trades.length;
      const wins = trades.filter((t) => t.profit > 0).length;
      const pnl = trades.reduce((s, t) => s + t.profit, 0);
      const winRate =
        tradeCount > 0 ? Math.round((wins / tradeCount) * 1000) / 10 : 0;

      // Best pair: pair with highest total profit
      const pairPnl = new Map<string, number>();
      const strategyPnl = new Map<string, number>();
      for (const t of trades) {
        pairPnl.set(t.symbol, (pairPnl.get(t.symbol) ?? 0) + t.profit);
        const strat = t.strategy || 'Manual';
        strategyPnl.set(strat, (strategyPnl.get(strat) ?? 0) + t.profit);
      }
      const bestPairEntry = [...pairPnl.entries()].sort(
        (a, b) => b[1] - a[1],
      )[0];
      const bestStrategyEntry = [...strategyPnl.entries()].sort(
        (a, b) => b[1] - a[1],
      )[0];

      // Sparkline: cumulative P&L per trade within day
      const sparkline: number[] = [];
      let running = 0;
      for (const t of sortedTrades) {
        running += t.profit;
        sparkline.push(Math.round(running * 10) / 10);
      }

      const dayDate = new Date(sortedTrades[0].closedAt!);
      const dateStr = dayDate.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });

      days.push({
        date: dateStr,
        dayLabel: DAY_LABELS[dayDate.getDay()],
        trades: tradeCount,
        winRate,
        pnl: Math.round(pnl * 10) / 10,
        bestPair: bestPairEntry ? bestPairEntry[0] : '—',
        bestStrategy: bestStrategyEntry ? bestStrategyEntry[0] : '—',
        sparkline,
      });

      weekPnl += pnl;
      weekTradeCount += tradeCount;
      weekWins += wins;
    });

    const weekWinRate =
      weekTradeCount > 0
        ? Math.round((weekWins / weekTradeCount) * 1000) / 10
        : 0;
    const tradingDays = days.length || 1;
    const avgDailyPnl = Math.round((weekPnl / tradingDays) * 10) / 10;

    // Sharpe-like score
    const mean = weekPnl / tradingDays;
    const variance =
      days.reduce((acc, day) => acc + Math.pow(day.pnl - mean, 2), 0) /
      tradingDays;
    const std = Math.sqrt(variance) || 1;
    const sharpeScore = Math.round((mean / std) * 100) / 100;

    const sorted = [...days].sort((a, b) => b.pnl - a.pnl);
    const bestDay = `${sorted[0].dayLabel} (+$${sorted[0].pnl.toFixed(0)})`;
    const worstDay = `${sorted[sorted.length - 1].dayLabel} ($${sorted[sorted.length - 1].pnl.toFixed(0)})`;

    const sparkline = days.map((d) => d.pnl);

    weeks.push({
      weekIndex: wIdx,
      label: `Week ${wIdx + 1}`,
      totalPnl: Math.round(weekPnl * 10) / 10,
      avgDailyPnl,
      bestDay,
      worstDay,
      winRate: weekWinRate,
      sharpeScore,
      sparkline,
      days,
    });
  });

  return weeks;
}

function computeMonthlySummary(weeks: WeekSummary[]): MonthlySummary {
  if (weeks.length === 0) {
    return {
      totalPnl: 0,
      totalTrades: 0,
      winRate: 0,
      bestWeek: 0,
      consistencyScore: 0,
      grade: '—',
      gradeColor: 'amber',
      totalSessions: 0,
      monthLabel: '',
    };
  }

  const totalPnl = Math.round(
    weeks.reduce((s, w) => s + w.totalPnl, 0) * 10,
  ) / 10;
  const totalTrades = weeks.reduce(
    (s, w) => s + w.days.reduce((ds, d) => ds + d.trades, 0),
    0,
  );
  const totalWins = weeks.reduce(
    (s, w) =>
      s + w.days.reduce((ds, d) => ds + d.trades * (d.winRate / 100), 0),
    0,
  );
  const winRate =
    totalTrades > 0
      ? Math.round((totalWins / totalTrades) * 1000) / 10
      : 0;

  const bestWeekIdx = weeks.reduce(
    (best, w, i) => (w.totalPnl > weeks[best].totalPnl ? i : best),
    0,
  );

  const totalSessions = weeks.reduce(
    (s, w) => s + w.days.length,
    0,
  );

  const profitableWeeks = weeks.filter((w) => w.totalPnl > 0).length;
  const consistencyScore = Math.round(
    (profitableWeeks / weeks.length) * 100,
  );

  // Month label from first week's first day
  const firstDate = weeks[0].days[0]?.date || '';
  const monthLabel = firstDate
    ? `${firstDate.split(' ')[0]} ${new Date().getFullYear()}`
    : '';

  let grade: string;
  let gradeColor: 'emerald' | 'amber' | 'red';

  if (totalPnl > 500 && consistencyScore > 65) {
    grade = 'A+';
    gradeColor = 'emerald';
  } else if (totalPnl > 350 && consistencyScore >= 50) {
    grade = 'A';
    gradeColor = 'emerald';
  } else if (totalPnl > 200 && consistencyScore >= 50) {
    grade = 'B+';
    gradeColor = 'emerald';
  } else if (totalPnl > 100) {
    grade = 'B';
    gradeColor = 'amber';
  } else if (totalPnl > 0 && consistencyScore >= 50) {
    grade = 'C';
    gradeColor = 'amber';
  } else if (totalPnl > -50) {
    grade = 'C-';
    gradeColor = 'amber';
  } else if (totalPnl > -200) {
    grade = 'D';
    gradeColor = 'red';
  } else {
    grade = 'F';
    gradeColor = 'red';
  }

  return {
    totalPnl,
    totalTrades,
    winRate,
    bestWeek: bestWeekIdx,
    consistencyScore,
    grade,
    gradeColor,
    totalSessions,
    monthLabel,
  };
}

// ─── Sparkline SVG ────────────────────────────────────────────────────────────

const MiniSparkline = memo(function MiniSparkline({
  values,
  width = 64,
  height = 22,
}: {
  values: number[];
  width?: number;
  height?: number;
}) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pad = 2;
  const points = values
    .map((v, i) => {
      const x = pad + (i / (values.length - 1)) * (width - pad * 2);
      const y = pad + (1 - (v - min) / range) * (height - pad * 2);
      return `${x},${y}`;
    })
    .join(' ');
  const isUp = values[values.length - 1] >= values[0];
  const color = isUp ? '#10b981' : '#ef4444';

  const areaClose = `${pad + (width - pad * 2)},${height} ${pad},${height}`;

  return (
    <svg width={width} height={height} className="inline-block flex-shrink-0">
      <polygon
        fill={isUp ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)'}
        points={`${points} ${areaClose}`}
      />
      <polyline
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
});

// ─── Circular Mini Gauge ─────────────────────────────────────────────────────

const WinRateGauge = memo(function WinRateGauge({ value }: { value: number }) {
  const radius = 14;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;
  const color =
    value >= 60 ? '#10b981' : value >= 40 ? '#f59e0b' : '#ef4444';

  return (
    <svg width={36} height={36} className="flex-shrink-0">
      <circle
        cx={18}
        cy={18}
        r={radius}
        fill="none"
        stroke="rgba(255,255,255,0.06)"
        strokeWidth={3}
      />
      <circle
        cx={18}
        cy={18}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={3}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform="rotate(-90 18 18)"
      />
      <text
        x={18}
        y={19}
        textAnchor="middle"
        dominantBaseline="middle"
        fill={color}
        fontSize={8}
        fontFamily="monospace"
        fontWeight={600}
      >
        {Math.round(value)}%
      </text>
    </svg>
  );
});

// ─── Animation Variants ───────────────────────────────────────────────────────

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.05 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.35,
      ease: [0.25, 0.46, 0.45, 0.94] as const,
    },
  },
} as const;

// ─── Component ────────────────────────────────────────────────────────────────

export default function PerformanceScorecard() {
  const [timeframe, setTimeframe] = useState<Timeframe>('weekly');
  const [selectedWeek, setSelectedWeek] = useState(0);
  const closedTrades = useTradingStore((s) => s.closedTrades);

  const weeks = useMemo(() => buildWeeklyData(closedTrades), [closedTrades]);
  const monthly = useMemo(() => computeMonthlySummary(weeks), [weeks]);

  // Clamp selectedWeek when weeks shrink
  const safeSelectedWeek = Math.min(selectedWeek, Math.max(0, weeks.length - 1));
  const currentWeek = weeks[safeSelectedWeek];

  if (weeks.length === 0) {
    return (
      <div className="glass-card-premium rounded-xl p-4 md:p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="p-1.5 rounded-lg bg-emerald-500/10">
            <Award className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              Performance Scorecard
            </h3>
            <p className="text-[11px] text-muted-foreground">
              Weekly &amp; monthly trading metrics
            </p>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center py-12 space-y-3">
          <div className="p-3 rounded-full bg-muted/40">
            <Award className="w-8 h-8 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground text-center max-w-[260px]">
            No trading history yet. Complete trades to see your performance
            scorecard.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card-premium rounded-xl p-4 md:p-5 space-y-4">
      {/* ── Header ─────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-emerald-500/10">
            <Award className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              Performance Scorecard
            </h3>
            <p className="text-[11px] text-muted-foreground">
              Weekly &amp; monthly trading metrics
            </p>
          </div>
        </div>

        {/* Timeframe toggle pills */}
        <div className="flex items-center rounded-lg bg-muted/40 border border-border/50 p-0.5">
          {(['weekly', 'monthly'] as const).map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200 ${
                timeframe === tf
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tf === 'weekly' ? 'Weekly' : 'Monthly'}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content ─────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        {timeframe === 'weekly' ? (
          <motion.div
            key="weekly"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="space-y-4"
          >
            {/* Week selector cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {weeks.map((week) => (
                <motion.button
                  key={week.weekIndex}
                  variants={itemVariants}
                  onClick={() => setSelectedWeek(week.weekIndex)}
                  className={`relative p-3 rounded-lg text-left transition-all duration-200 ${
                    safeSelectedWeek === week.weekIndex
                      ? 'bg-emerald-500/10 border border-emerald-500/25 shadow-sm'
                      : 'stat-card-premium hover:bg-muted/30 border border-transparent'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span
                      className={`text-[11px] font-medium ${
                        safeSelectedWeek === week.weekIndex
                          ? 'text-emerald-400'
                          : 'text-muted-foreground'
                      }`}
                    >
                      {week.label}
                    </span>
                    <MiniSparkline
                      values={week.sparkline}
                      width={44}
                      height={16}
                    />
                  </div>
                  <p
                    className={`font-mono text-sm font-semibold ${pnlColor(
                      week.totalPnl,
                    )}`}
                  >
                    {formatPnl(week.totalPnl)}
                  </p>
                  <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                    {week.winRate}% win &middot;{' '}
                    {week.sharpeScore > 0 ? '↑' : '↓'}{' '}
                    {Math.abs(week.sharpeScore).toFixed(2)}
                  </p>
                </motion.button>
              ))}
            </div>

            {/* Selected week detail: day cards */}
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground">
                  {currentWeek.label} — Daily Breakdown
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
                {currentWeek.days.map((day, idx) => (
                  <motion.div
                    key={`${currentWeek.weekIndex}-${idx}`}
                    variants={itemVariants}
                    className={`stat-card-premium rounded-lg p-3 space-y-2 ${
                      day.pnl > 0
                        ? 'border-l-2 border-l-emerald-500/40'
                        : day.pnl < 0
                          ? 'border-l-2 border-l-red-500/40'
                          : 'border-l-2 border-l-amber-500/40'
                    }`}
                  >
                    {/* Day header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-foreground">
                          {day.dayLabel}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {day.date}
                        </span>
                      </div>
                      <WinRateGauge value={day.winRate} />
                    </div>

                    {/* P&L */}
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-muted-foreground">
                        {day.trades} trades
                      </span>
                      <span
                        className={`font-mono text-sm font-bold ${pnlColor(
                          day.pnl,
                        )}`}
                      >
                        {formatPnl(day.pnl)}
                      </span>
                    </div>

                    {/* Day sparkline */}
                    <MiniSparkline
                      values={day.sparkline}
                      width={80}
                      height={18}
                    />

                    {/* Best pair & strategy */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/15">
                        <Target className="w-2.5 h-2.5" />
                        {day.bestPair}
                      </span>
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/15">
                        <Zap className="w-2.5 h-2.5" />
                        {day.bestStrategy}
                      </span>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Week summary stats row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {[
                {
                  icon: <BarChart3 className="w-3.5 h-3.5 text-emerald-400" />,
                  label: 'Total P&L',
                  value: formatPnl(currentWeek.totalPnl),
                  color: pnlColor(currentWeek.totalPnl),
                },
                {
                  icon: <Activity className="w-3.5 h-3.5 text-blue-400" />,
                  label: 'Avg Daily',
                  value: formatPnl(currentWeek.avgDailyPnl),
                  color: pnlColor(currentWeek.avgDailyPnl),
                },
                {
                  icon: <Star className="w-3.5 h-3.5 text-amber-400" />,
                  label: 'Best Day',
                  value: currentWeek.bestDay,
                  color: 'text-foreground',
                },
                {
                  icon: <Target className="w-3.5 h-3.5 text-purple-400" />,
                  label: 'Consistency',
                  value: `${currentWeek.winRate}%`,
                  color:
                    currentWeek.winRate >= 55
                      ? 'text-emerald-400'
                      : currentWeek.winRate >= 45
                        ? 'text-amber-400'
                        : 'text-red-400',
                },
              ].map((stat) => (
                <motion.div
                  key={stat.label}
                  variants={itemVariants}
                  className="stat-card-premium rounded-lg p-3 flex items-center gap-2.5"
                >
                  <div className="p-1.5 rounded-md bg-muted/40">
                    {stat.icon}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] text-muted-foreground truncate">
                      {stat.label}
                    </p>
                    <p
                      className={`font-mono text-xs font-semibold ${stat.color} truncate`}
                    >
                      {stat.value}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        ) : (
          /* ── Monthly View ───────────────────────────────── */
          <motion.div
            key="monthly"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="space-y-4"
          >
            {/* Monthly overview card */}
            <motion.div
              variants={itemVariants}
              className="stat-card-premium rounded-lg p-5 space-y-4"
            >
              <div className="flex items-center gap-2 mb-1">
                <Calendar className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-medium text-muted-foreground">
                  {monthly.monthLabel || 'Monthly'} — Monthly Overview
                </span>
              </div>

              <div className="grid grid-cols-3 gap-4">
                {/* Big P&L */}
                <div className="text-center">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                    Total P&amp;L
                  </p>
                  <p
                    className={`font-mono text-2xl md:text-3xl font-bold ${pnlColor(
                      monthly.totalPnl,
                    )}`}
                  >
                    {formatPnl(monthly.totalPnl)}
                  </p>
                  <div className="flex items-center justify-center gap-1 mt-1">
                    {monthly.totalPnl > 0 ? (
                      <TrendingUp className="w-3 h-3 text-emerald-400" />
                    ) : monthly.totalPnl < 0 ? (
                      <TrendingDown className="w-3 h-3 text-red-400" />
                    ) : (
                      <Activity className="w-3 h-3 text-amber-400" />
                    )}
                    <span className="text-[10px] text-muted-foreground">
                      net profit
                    </span>
                  </div>
                </div>

                {/* Total trades */}
                <div className="text-center">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                    Total Trades
                  </p>
                  <p className="font-mono text-2xl md:text-3xl font-bold text-foreground">
                    {monthly.totalTrades}
                  </p>
                  <div className="flex items-center justify-center gap-1 mt-1">
                    <BarChart3 className="w-3 h-3 text-muted-foreground" />
                    <span className="text-[10px] text-muted-foreground">
                      across {monthly.totalSessions} sessions
                    </span>
                  </div>
                </div>

                {/* Win rate */}
                <div className="text-center">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                    Win Rate
                  </p>
                  <p
                    className={`font-mono text-2xl md:text-3xl font-bold ${
                      monthly.winRate >= 55
                        ? 'text-emerald-400'
                        : monthly.winRate >= 45
                          ? 'text-amber-400'
                          : 'text-red-400'
                    }`}
                  >
                    {monthly.winRate}%
                  </p>
                  <div className="flex items-center justify-center gap-1 mt-1">
                    <Target className="w-3 h-3 text-muted-foreground" />
                    <span className="text-[10px] text-muted-foreground">overall</span>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Weekly breakdown grid */}
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground">
                  Weekly Breakdown
                </span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {weeks.map((week) => {
                  const isBest = monthly.bestWeek === week.weekIndex;
                  return (
                    <motion.div
                      key={week.weekIndex}
                      variants={itemVariants}
                      className={`stat-card-premium rounded-lg p-3 space-y-2 ${
                        isBest
                          ? 'border border-emerald-500/25 bg-emerald-500/[0.04]'
                          : ''
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-medium text-foreground">
                          {week.label}
                        </span>
                        {isBest && (
                          <Star className="w-3 h-3 text-emerald-400 fill-emerald-400/50" />
                        )}
                      </div>
                      <MiniSparkline
                        values={week.sparkline}
                        width={72}
                        height={18}
                      />
                      <p
                        className={`font-mono text-sm font-bold ${pnlColor(
                          week.totalPnl,
                        )}`}
                      >
                        {formatPnl(week.totalPnl)}
                      </p>
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-muted-foreground">
                          {week.winRate}% win
                        </span>
                        <span className="text-muted-foreground font-mono">
                          {week.days.reduce((s, d) => s + d.trades, 0)}{' '}
                          trades
                        </span>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>

            {/* Consistency + Performance grade */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {/* Consistency score card */}
              <motion.div
                variants={itemVariants}
                className="stat-card-premium rounded-lg p-4 space-y-3"
              >
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-md bg-emerald-500/10">
                    <Activity className="w-3.5 h-3.5 text-emerald-400" />
                  </div>
                  <span className="text-xs font-medium text-muted-foreground">
                    Consistency Score
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="relative w-16 h-16">
                    <svg
                      viewBox="0 0 64 64"
                      className="w-full h-full -rotate-90"
                    >
                      <circle
                        cx={32}
                        cy={32}
                        r={26}
                        fill="none"
                        stroke="rgba(255,255,255,0.05)"
                        strokeWidth={5}
                      />
                      <circle
                        cx={32}
                        cy={32}
                        r={26}
                        fill="none"
                        stroke={
                          monthly.consistencyScore >= 75
                            ? '#10b981'
                            : monthly.consistencyScore >= 50
                              ? '#f59e0b'
                              : '#ef4444'
                        }
                        strokeWidth={5}
                        strokeDasharray={2 * Math.PI * 26}
                        strokeDashoffset={
                          2 * Math.PI * 26 * (1 - monthly.consistencyScore / 100)
                        }
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="font-mono text-sm font-bold text-foreground">
                        {monthly.consistencyScore}%
                      </span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[11px] text-muted-foreground">
                      {weeks.filter((w) => w.totalPnl > 0).length} of{' '}
                      {weeks.length} weeks profitable
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {monthly.consistencyScore >= 75
                        ? 'Excellent consistency — reliable performer'
                        : monthly.consistencyScore >= 50
                          ? 'Moderate consistency — room for improvement'
                          : 'Low consistency — strategy review needed'}
                    </p>
                  </div>
                </div>
              </motion.div>

              {/* Performance Grade */}
              <motion.div
                variants={itemVariants}
                className="stat-card-premium rounded-lg p-4 flex flex-col items-center justify-center space-y-2"
              >
                <span className="text-xs font-medium text-muted-foreground">
                  Performance Grade
                </span>
                <div
                  className={`relative flex items-center justify-center w-20 h-20 rounded-full ${
                    monthly.gradeColor === 'emerald'
                      ? 'bg-emerald-500/10 shadow-[0_0_30px_rgba(16,185,129,0.15)]'
                      : monthly.gradeColor === 'amber'
                        ? 'bg-amber-500/10 shadow-[0_0_30px_rgba(245,158,11,0.15)]'
                        : 'bg-red-500/10 shadow-[0_0_30px_rgba(239,68,68,0.15)]'
                  }`}
                >
                  {/* Glow ring */}
                  <div
                    className={`absolute inset-0 rounded-full ${
                      monthly.gradeColor === 'emerald'
                        ? 'ring-2 ring-emerald-500/20'
                        : monthly.gradeColor === 'amber'
                          ? 'ring-2 ring-amber-500/20'
                          : 'ring-2 ring-red-500/20'
                    }`}
                  />
                  <span
                    className={`font-mono text-3xl font-bold ${
                      monthly.gradeColor === 'emerald'
                        ? 'text-emerald-400'
                        : monthly.gradeColor === 'amber'
                          ? 'text-amber-400'
                          : 'text-red-400'
                    }`}
                  >
                    {monthly.grade}
                  </span>
                </div>
                <div className="text-center space-y-0.5">
                  <p className="text-[11px] text-muted-foreground">
                    {monthly.grade.startsWith('A')
                      ? 'Outstanding performance'
                      : monthly.grade.startsWith('B')
                        ? 'Good performance'
                        : monthly.grade.startsWith('C')
                          ? 'Average performance'
                          : monthly.grade.startsWith('D')
                            ? 'Below expectations'
                            : 'Needs immediate review'}
                  </p>
                  <p className="text-[10px] text-muted-foreground font-mono">
                    P&amp;L: {formatPnl(monthly.totalPnl)} &middot;{' '}
                    {monthly.consistencyScore}% consistency
                  </p>
                </div>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
