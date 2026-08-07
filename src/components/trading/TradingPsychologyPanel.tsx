'use client';

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Brain,
  Heart,
  Flame,
  Trophy,
  Shield,
  Target,
  TrendingUp,
  AlertTriangle,
  Activity,
  SmilePlus,
  Frown,
  Meh,
  Zap,
} from 'lucide-react';
import { useTradingStore } from '@/store/trading-store';
import type { Trade } from '@/lib/types';
import type { JournalEntry } from '@/store/trading-store';

// ─── Types ──────────────────────────────────────────────────────────────────

type Mood = 'Great' | 'Good' | 'Neutral' | 'Frustrated' | 'Tilted';

interface DisciplineSubScore {
  name: string;
  score: number;
  icon: React.ElementType;
}

interface DisciplineData {
  overall: number;
  grade: string;
  subScores: DisciplineSubScore[];
}

interface SessionMood {
  date: string;
  shortDate: string;
  mood: Mood;
  pnl: number;
  notes: string;
  tradeCount: number;
  isCurrent: boolean;
}

interface EmotionStat {
  name: string;
  count: number;
  winRate: number;
  color: string;
  bgColor: string;
  icon: React.ElementType;
}

interface StreakData {
  currentWin: number;
  currentLoss: number;
  bestWin: number;
  worstLoss: number;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const MOOD_DISPLAY_MAP: Record<string, Mood> = {
  great: 'Great',
  good: 'Good',
  neutral: 'Neutral',
  bad: 'Frustrated',
  terrible: 'Tilted',
};

const MOOD_SCORE_MAP: Record<string, number> = {
  great: 95,
  good: 82,
  neutral: 65,
  bad: 40,
  terrible: 18,
};

// ─── Helpers ───────────────────────────────────────────────────────────────

function parseDurationToMinutes(duration: string): number {
  const hourMatch = duration.match(/(\d+)h/);
  const minuteMatch = duration.match(/(\d+)m/);
  const hours = hourMatch ? parseInt(hourMatch[1], 10) : 0;
  const minutes = minuteMatch ? parseInt(minuteMatch[1], 10) : 0;
  return hours * 60 + minutes;
}

function getGaugeColor(score: number): string {
  if (score <= 30) return 'rgb(239, 68, 68)';   // red-500
  if (score <= 60) return 'rgb(245, 158, 11)';   // amber-500
  return 'rgb(16, 185, 129)';                    // emerald-500
}

function getGaugeGlowClass(score: number): string {
  if (score <= 30) return 'text-red-400 drop-shadow-[0_0_8px_rgba(239,68,68,0.6)]';
  if (score <= 60) return 'text-amber-400 drop-shadow-[0_0_8px_rgba(245,158,11,0.6)]';
  return 'text-emerald-400 drop-shadow-[0_0_8px_rgba(16,185,129,0.6)]';
}

function getMoodColor(mood: Mood): string {
  switch (mood) {
    case 'Great': return 'bg-emerald-500';
    case 'Good': return 'bg-lime-500';
    case 'Neutral': return 'bg-gray-400';
    case 'Frustrated': return 'bg-amber-500';
    case 'Tilted': return 'bg-red-500';
  }
}

function getMoodRing(mood: Mood): string {
  switch (mood) {
    case 'Great': return 'ring-emerald-500/30';
    case 'Good': return 'ring-lime-500/30';
    case 'Neutral': return 'ring-gray-400/30';
    case 'Frustrated': return 'ring-amber-500/30';
    case 'Tilted': return 'ring-red-500/30';
  }
}

function formatPnl(val: number): string {
  const sign = val >= 0 ? '+' : '';
  return `${sign}$${val.toFixed(2)}`;
}

// ─── Discipline Computation Helpers ────────────────────────────────────────

function computePlanAdherence(trades: Trade[]): number {
  if (trades.length === 0) return 0;
  const withStrategy = trades.filter(t => t.strategy && t.strategy.trim() !== '').length;
  return Math.round((withStrategy / trades.length) * 100);
}

function computeRiskManagement(trades: Trade[]): number {
  if (trades.length === 0) return 0;
  const withSL = trades.filter(t => t.stopLoss !== undefined && t.stopLoss !== null).length;
  return Math.round((withSL / trades.length) * 100);
}

function computeEmotionalControl(entries: JournalEntry[]): number {
  if (entries.length === 0) return 0;
  const total = entries.reduce((sum, e) => sum + (MOOD_SCORE_MAP[e.mood] ?? 50), 0);
  return Math.round(total / entries.length);
}

function computePatience(entries: JournalEntry[]): number {
  if (entries.length === 0) return 0;
  const durations = entries.map(e => parseDurationToMinutes(e.duration)).filter(d => d > 0);
  if (durations.length === 0) return 0;
  const avgMinutes = durations.reduce((a, b) => a + b, 0) / durations.length;
  return Math.round(100 * (1 - Math.exp(-avgMinutes / 45)));
}

function computeConsistency(trades: Trade[]): number {
  const dailyPnl: Record<string, number> = {};
  for (const trade of trades) {
    if (!trade.closedAt) continue;
    const date = trade.closedAt.slice(0, 10);
    dailyPnl[date] = (dailyPnl[date] || 0) + (trade.profit ?? 0);
  }
  const values = Object.values(dailyPnl);
  if (values.length < 2) return 50;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
  const sd = Math.sqrt(variance);
  return Math.round(100 * Math.exp(-sd / 200));
}

function computeRecovery(trades: Trade[]): number {
  const sorted = [...trades]
    .filter(t => t.closedAt)
    .sort((a, b) => new Date(a.closedAt!).getTime() - new Date(b.closedAt!).getTime());
  if (sorted.length < 3) return 50;
  const recoveryTrades: boolean[] = [];
  let consecutiveLosses = 0;
  for (const trade of sorted) {
    const isWin = (trade.profit ?? 0) >= 0;
    if (consecutiveLosses >= 2) {
      recoveryTrades.push(isWin);
      consecutiveLosses = isWin ? 0 : consecutiveLosses + 1;
    } else if (isWin) {
      consecutiveLosses = 0;
    } else {
      consecutiveLosses++;
    }
  }
  if (recoveryTrades.length === 0) return 50;
  const wins = recoveryTrades.filter(Boolean).length;
  return Math.round((wins / recoveryTrades.length) * 100);
}

function computeWinRate(trades: Trade[]): number {
  if (trades.length === 0) return 0;
  const wins = trades.filter(t => (t.profit ?? 0) >= 0).length;
  return Math.round((wins / trades.length) * 100);
}

function computeStreaks(trades: Trade[]): StreakData {
  const sorted = [...trades]
    .filter(t => t.closedAt)
    .sort((a, b) => new Date(a.closedAt!).getTime() - new Date(b.closedAt!).getTime());
  if (sorted.length === 0) {
    return { currentWin: 0, currentLoss: 0, bestWin: 0, worstLoss: 0 };
  }
  let bestWin = 0;
  let worstLoss = 0;
  let tempWin = 0;
  let tempLoss = 0;
  for (const trade of sorted) {
    const isWin = (trade.profit ?? 0) >= 0;
    if (isWin) {
      tempWin++;
      tempLoss = 0;
      bestWin = Math.max(bestWin, tempWin);
    } else {
      tempLoss++;
      tempWin = 0;
      worstLoss = Math.max(worstLoss, tempLoss);
    }
  }
  let currentWin = 0;
  let currentLoss = 0;
  const lastIsWin = (sorted[sorted.length - 1].profit ?? 0) >= 0;
  if (lastIsWin) {
    for (let i = sorted.length - 1; i >= 0; i--) {
      if ((sorted[i].profit ?? 0) >= 0) currentWin++;
      else break;
    }
  } else {
    for (let i = sorted.length - 1; i >= 0; i--) {
      if ((sorted[i].profit ?? 0) < 0) currentLoss++;
      else break;
    }
  }
  return { currentWin, currentLoss, bestWin, worstLoss };
}

// ─── Discipline Gauge ───────────────────────────────────────────────────────

function DisciplineGauge({ data }: { data: DisciplineData }) {
  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  const gaugeColor = getGaugeColor(data.overall);

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Gauge */}
      <div className="relative w-[120px] h-[120px]">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
          {/* Track */}
          <circle
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            className="text-white/[0.06]"
          />
          {/* Animated fill */}
          <motion.circle
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            stroke={gaugeColor}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: circumference - (circumference * data.overall) / 100 }}
            transition={{ duration: 1.6, ease: 'easeOut', delay: 0.3 }}
          />
        </svg>
        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.span
            className="text-2xl font-bold font-mono leading-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8, duration: 0.5 }}
          >
            {data.overall}
          </motion.span>
          <span className="text-[9px] text-muted-foreground mt-0.5 uppercase tracking-wider">Score</span>
        </div>
      </div>

      {/* Grade */}
      <motion.div
        className={`text-3xl font-black font-mono ${getGaugeGlowClass(data.overall)}`}
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 1.2, type: 'spring', stiffness: 200 }}
      >
        {data.grade}
      </motion.div>

      {/* Sub-scores grid */}
      <div className="w-full grid grid-cols-2 gap-x-4 gap-y-2.5 mt-1">
        {data.subScores.map((sub, i) => (
          <motion.div
            key={sub.name}
            className="space-y-1"
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 + i * 0.08, duration: 0.4 }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <sub.icon className="w-3 h-3 text-muted-foreground" />
                <span className="text-[10px] text-muted-foreground leading-none">{sub.name}</span>
              </div>
              <span className={`text-[11px] font-mono font-bold ${
                sub.score >= 80 ? 'text-emerald-400' :
                sub.score >= 60 ? 'text-amber-400' : 'text-red-400'
              }`}>{sub.score}</span>
            </div>
            <div className="h-1 bg-white/[0.06] rounded-full overflow-hidden">
              <motion.div
                className={`h-full rounded-full ${
                  sub.score >= 80 ? 'bg-emerald-500' :
                  sub.score >= 60 ? 'bg-amber-500' : 'bg-red-500'
                }`}
                initial={{ width: 0 }}
                animate={{ width: `${sub.score}%` }}
                transition={{ duration: 0.8, delay: 0.6 + i * 0.06, ease: 'easeOut' }}
              />
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ─── Mood Timeline ──────────────────────────────────────────────────────────

function MoodTimeline({ sessions }: { sessions: SessionMood[] }) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  if (sessions.length === 0) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Heart className="w-3.5 h-3.5 text-pink-400" />
          <h3 className="text-xs font-semibold">Session Mood Timeline</h3>
        </div>
        <div className="flex items-center justify-center py-8">
          <div className="text-center space-y-2">
            <Heart className="w-8 h-8 text-muted-foreground/30 mx-auto" />
            <p className="text-[11px] text-muted-foreground">No journal entries yet</p>
            <p className="text-[9px] text-muted-foreground/60">Start logging your trades to track mood patterns</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Heart className="w-3.5 h-3.5 text-pink-400" />
        <h3 className="text-xs font-semibold">Session Mood Timeline</h3>
        <span className="text-[9px] text-muted-foreground ml-auto">Last {sessions.length} Session{sessions.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Timeline */}
      <div className="relative overflow-x-auto pb-2 scrollbar-thin">
        <div className="flex items-start gap-0 min-w-max px-2 py-4">
          {sessions.map((session, i) => (
            <div
              key={session.date}
              className="relative flex flex-col items-center"
              onMouseEnter={() => setHoveredIndex(i)}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              {/* Connecting line */}
              {i < sessions.length - 1 && (
                <div className="absolute top-3 left-[calc(50%+10px)] w-[calc(100%-20px)] h-[2px] bg-white/[0.08]" />
              )}

              {/* Circle */}
              <div className="relative z-10 mb-2">
                <motion.div
                  className={`w-5 h-5 rounded-full ${getMoodColor(session.mood)} ring-2 ${getMoodRing(session.mood)} transition-transform cursor-pointer`}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.3 + i * 0.08, type: 'spring', stiffness: 300 }}
                  whileHover={{ scale: 1.25 }}
                />
                {session.isCurrent && (
                  <motion.div
                    className={`absolute inset-0 rounded-full ${getMoodColor(session.mood)} opacity-40`}
                    animate={{ scale: [1, 1.8, 1], opacity: [0.4, 0, 0.4] }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                  />
                )}
              </div>

              {/* Labels */}
              <div className="flex flex-col items-center gap-0.5 min-w-[52px]">
                <span className="text-[10px] text-muted-foreground font-medium">{session.shortDate}</span>
                <span className={`text-[10px] font-mono font-bold ${
                  session.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'
                }`}>{formatPnl(session.pnl)}</span>
                <span className="text-[9px] text-muted-foreground/60">{session.tradeCount} trades</span>
              </div>

              {/* Hover card */}
              {hoveredIndex === i && (
                <motion.div
                  className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 z-50 w-56 glass-card-premium rounded-lg p-3 border border-border/50 shadow-2xl"
                  initial={{ opacity: 0, y: 6, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 6 }}
                  transition={{ duration: 0.15 }}
                >
                  {/* Arrow */}
                  <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-border/50" />

                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-semibold">{session.date}</span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      session.mood === 'Great' ? 'bg-emerald-500/20 text-emerald-400' :
                      session.mood === 'Good' ? 'bg-lime-500/20 text-lime-400' :
                      session.mood === 'Neutral' ? 'bg-gray-500/20 text-gray-400' :
                      session.mood === 'Frustrated' ? 'bg-amber-500/20 text-amber-400' :
                      'bg-red-500/20 text-red-400'
                    }`}>{session.mood}</span>
                  </div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className={`text-xs font-mono font-bold ${
                      session.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'
                    }`}>{formatPnl(session.pnl)}</span>
                    <span className="text-[10px] text-muted-foreground">{session.tradeCount} trades</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-relaxed">{session.notes}</p>
                </motion.div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Mood legend */}
      <div className="flex items-center gap-3 flex-wrap">
        {(['Great', 'Good', 'Neutral', 'Frustrated', 'Tilted'] as Mood[]).map((mood) => (
          <div key={mood} className="flex items-center gap-1">
            <div className={`w-2 h-2 rounded-full ${getMoodColor(mood)}`} />
            <span className="text-[9px] text-muted-foreground">{mood}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Emotion Impact Chart ───────────────────────────────────────────────────

function EmotionImpactChart({ stats }: { stats: EmotionStat[] }) {
  const maxCount = stats.length > 0 ? Math.max(...stats.map((s) => s.count)) : 1;

  const sorted = useMemo(() => {
    if (stats.length < 2) return null;
    return [...stats].sort((a, b) => b.winRate - a.winRate);
  }, [stats]);

  const bestEmotion = sorted ? sorted[0] : null;
  const worstEmotion = sorted ? sorted[sorted.length - 1] : null;

  if (stats.length === 0) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Brain className="w-3.5 h-3.5 text-violet-400" />
          <h3 className="text-xs font-semibold">Emotion Impact</h3>
        </div>
        <div className="flex items-center justify-center py-8">
          <div className="text-center space-y-2">
            <Brain className="w-8 h-8 text-muted-foreground/30 mx-auto" />
            <p className="text-[11px] text-muted-foreground">No emotion data yet</p>
            <p className="text-[9px] text-muted-foreground/60">Journal entries will populate this chart</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Brain className="w-3.5 h-3.5 text-violet-400" />
        <h3 className="text-xs font-semibold">Emotion Impact</h3>
        <span className="text-[9px] text-muted-foreground ml-auto">{stats.reduce((s, e) => s + e.count, 0)} Total Trades</span>
      </div>

      <div className="space-y-2.5">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.name}
            className="space-y-1"
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 + i * 0.1, duration: 0.4 }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <stat.icon className={`w-3 h-3 ${stat.color}`} />
                <span className="text-[11px] font-medium">{stat.name}</span>
                <span className="text-[9px] font-mono bg-white/[0.06] text-muted-foreground px-1.5 py-0.5 rounded">
                  {stat.count}
                </span>
              </div>
              <span className="text-[11px] font-mono font-bold">{stat.winRate}% WR</span>
            </div>
            <div className="h-2 bg-white/[0.04] rounded-full overflow-hidden">
              <motion.div
                className={`h-full rounded-full ${stat.bgColor}`}
                initial={{ width: 0 }}
                animate={{ width: `${(stat.count / maxCount) * 100}%` }}
                transition={{ duration: 1, delay: 0.6 + i * 0.1, ease: 'easeOut' }}
              />
            </div>
          </motion.div>
        ))}
      </div>

      {/* Insight */}
      {bestEmotion && worstEmotion && (
        <motion.div
          className="flex items-start gap-2 mt-3 p-2.5 rounded-lg bg-emerald-500/[0.06] border border-emerald-500/10"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.2, duration: 0.5 }}
        >
          <Activity className="w-3.5 h-3.5 text-emerald-400 mt-0.5 flex-shrink-0" />
          <p className="text-[10px] text-emerald-400/90 leading-relaxed">
            Your best trades come from a <span className="font-semibold text-emerald-400">{bestEmotion.name}</span> state ({bestEmotion.winRate}% WR).{' '}
            {bestEmotion.name !== worstEmotion.name && (
              <>Avoid trading when feeling <span className="font-semibold text-red-400">{worstEmotion.name}</span> — only {worstEmotion.winRate}% win rate.</>
            )}
          </p>
        </motion.div>
      )}
    </div>
  );
}

// ─── Streak Display ────────────────────────────────────────────────────────

function StreakDisplay({ data }: { data: StreakData }) {
  const streaks = [
    {
      label: 'Current Win',
      value: data.currentWin,
      icon: Flame,
      highlight: data.currentWin > 3,
      highlightClass: 'text-orange-400 ring-orange-500/20',
      normalClass: 'text-muted-foreground',
      accentColor: 'text-emerald-400',
    },
    {
      label: 'Current Loss',
      value: data.currentLoss,
      icon: AlertTriangle,
      highlight: data.currentLoss > 2,
      highlightClass: 'text-red-400 ring-red-500/20',
      normalClass: 'text-muted-foreground',
      accentColor: 'text-red-400',
    },
    {
      label: 'Best Win',
      value: data.bestWin,
      icon: Trophy,
      highlight: data.bestWin >= 10,
      highlightClass: 'text-amber-400 ring-amber-500/20',
      normalClass: 'text-muted-foreground',
      accentColor: 'text-emerald-400',
    },
    {
      label: 'Worst Loss',
      value: data.worstLoss,
      icon: Shield,
      highlight: data.worstLoss >= 4,
      highlightClass: 'text-red-400 ring-red-500/20',
      normalClass: 'text-muted-foreground',
      accentColor: 'text-red-400',
    },
  ];

  const hasAnyStreak = data.currentWin > 0 || data.currentLoss > 0 || data.bestWin > 0 || data.worstLoss > 0;

  if (!hasAnyStreak) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-3.5 h-3.5 text-cyan-400" />
          <h3 className="text-xs font-semibold">Streak Tracker</h3>
        </div>
        <div className="flex items-center justify-center py-8">
          <div className="text-center space-y-2">
            <TrendingUp className="w-8 h-8 text-muted-foreground/30 mx-auto" />
            <p className="text-[11px] text-muted-foreground">No streak data yet</p>
            <p className="text-[9px] text-muted-foreground/60">Close some trades to track your streaks</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <TrendingUp className="w-3.5 h-3.5 text-cyan-400" />
        <h3 className="text-xs font-semibold">Streak Tracker</h3>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {streaks.map((streak, i) => (
          <motion.div
            key={streak.label}
            className={`glass-card rounded-lg p-3 text-center border transition-colors ${
              streak.highlight
                ? `ring-1 ${streak.highlightClass}`
                : 'border-border/50'
            }`}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5 + i * 0.1, type: 'spring', stiffness: 250 }}
          >
            <streak.icon className={`w-4 h-4 mx-auto mb-1.5 ${
              streak.highlight ? streak.accentColor : streak.normalClass
            }`} />
            <span className={`text-lg font-bold font-mono leading-none block ${
              streak.accentColor
            }`}>{streak.value}</span>
            <span className="text-[9px] text-muted-foreground uppercase tracking-wider mt-1 block">{streak.label}</span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ─── Animation Variants ─────────────────────────────────────────────────────

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.12, delayChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' as const } },
} as const;

// ─── Main Component ─────────────────────────────────────────────────────────

export default function TradingPsychologyPanel() {
  const journalEntries = useTradingStore((s) => s.journalEntries);
  const closedTrades = useTradingStore((s) => s.closedTrades);

  // ── Discipline Data ──
  const disciplineData = useMemo((): DisciplineData => {
    const subScores: DisciplineSubScore[] = [
      {
        name: 'Plan Adherence',
        score: computePlanAdherence(closedTrades),
        icon: Target,
      },
      {
        name: 'Risk Management',
        score: computeRiskManagement(closedTrades),
        icon: Shield,
      },
      {
        name: 'Emotional Control',
        score: computeEmotionalControl(journalEntries),
        icon: Brain,
      },
      {
        name: 'Patience',
        score: computePatience(journalEntries),
        icon: Meh,
      },
      {
        name: 'Consistency',
        score: computeConsistency(closedTrades),
        icon: Activity,
      },
      {
        name: 'Recovery',
        score: computeRecovery(closedTrades),
        icon: TrendingUp,
      },
      {
        name: 'Win Rate',
        score: computeWinRate(closedTrades),
        icon: Zap,
      },
    ];

    const overall = Math.round(
      subScores.reduce((sum, s) => sum + s.score, 0) / subScores.length
    );

    const grade =
      overall >= 90 ? 'A' : overall >= 80 ? 'B' : overall >= 70 ? 'C' : overall >= 60 ? 'D' : 'F';

    return { overall, grade, subScores };
  }, [closedTrades, journalEntries]);

  // ── Mood Sessions ──
  const sessions = useMemo((): SessionMood[] => {
    if (journalEntries.length === 0) return [];

    // Build daily P&L map from closedTrades
    const dailyPnlMap: Record<string, number> = {};
    const dailyTradeCountMap: Record<string, number> = {};
    for (const trade of closedTrades) {
      if (!trade.closedAt) continue;
      const date = trade.closedAt.slice(0, 10);
      dailyPnlMap[date] = (dailyPnlMap[date] || 0) + (trade.profit ?? 0);
      dailyTradeCountMap[date] = (dailyTradeCountMap[date] || 0) + 1;
    }

    // Group journal entries by date, keeping last entry per date
    const byDate = new Map<string, JournalEntry>();
    const entriesByDate = new Map<string, JournalEntry[]>();
    for (const entry of journalEntries) {
      const date = entry.createdAt.slice(0, 10);
      byDate.set(date, entry);
      if (!entriesByDate.has(date)) entriesByDate.set(date, []);
      entriesByDate.get(date)!.push(entry);
    }

    const sortedDates = Array.from(byDate.keys()).sort();
    const last8 = sortedDates.slice(-8);

    return last8.map((date, i) => {
      const entry = byDate.get(date)!;
      const allEntriesForDate = entriesByDate.get(date) || [];
      const mood = MOOD_DISPLAY_MAP[entry.mood] || 'Neutral';
      const pnl = dailyPnlMap[date] || 0;
      const tradeCount = dailyTradeCountMap[date] || allEntriesForDate.length;
      const shortDate = date.slice(5).replace('-', '/');
      const notes = allEntriesForDate.length === 1
        ? entry.notes
        : allEntriesForDate.map(e => e.notes).filter(n => n).join(' | ').slice(0, 200);

      return {
        date,
        shortDate,
        mood,
        pnl,
        notes,
        tradeCount,
        isCurrent: i === last8.length - 1,
      };
    });
  }, [journalEntries, closedTrades]);

  // ── Emotion Stats ──
  const emotionStats = useMemo((): EmotionStat[] => {
    if (journalEntries.length === 0) return [];

    const categories: Array<{
      moods: string[];
      name: string;
      color: string;
      bgColor: string;
      icon: React.ElementType;
    }> = [
      { moods: ['great', 'good'], name: 'Confident', color: 'text-emerald-400', bgColor: 'bg-emerald-500', icon: SmilePlus },
      { moods: ['neutral'], name: 'Cautious', color: 'text-amber-400', bgColor: 'bg-amber-500', icon: AlertTriangle },
      { moods: ['bad'], name: 'Anxious', color: 'text-orange-400', bgColor: 'bg-orange-500', icon: Zap },
      { moods: ['terrible'], name: 'Tilted', color: 'text-red-400', bgColor: 'bg-red-500', icon: Frown },
    ];

    return categories
      .map((cat) => {
        const entries = journalEntries.filter(e => cat.moods.includes(e.mood));
        if (entries.length === 0) return null;
        const wins = entries.filter(e => (e.pnl ?? 0) >= 0).length;
        return {
          name: cat.name,
          count: entries.length,
          winRate: Math.round((wins / entries.length) * 100),
          color: cat.color,
          bgColor: cat.bgColor,
          icon: cat.icon,
        };
      })
      .filter((s): s is EmotionStat => s !== null);
  }, [journalEntries]);

  // ── Streak Data ──
  const streakData = useMemo((): StreakData => {
    return computeStreaks(closedTrades);
  }, [closedTrades]);

  return (
    <motion.div
      className="glass-card-premium rounded-xl p-5 space-y-6"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="flex items-center gap-2">
        <Brain className="w-4 h-4 text-violet-400" />
        <h2 className="text-sm font-semibold">Trading Psychology</h2>
        <span className="text-[9px] text-muted-foreground bg-white/[0.05] px-2 py-0.5 rounded-full ml-auto uppercase tracking-wider">
          Mental Edge
        </span>
      </motion.div>

      {/* Top row: Gauge + Mood Timeline */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Discipline Gauge */}
        <div className="glass-card rounded-lg p-4 border border-border/50">
          <div className="flex items-center gap-2 mb-4">
            <Target className="w-3.5 h-3.5 text-emerald-400" />
            <h3 className="text-xs font-semibold">Discipline Score</h3>
          </div>
          <DisciplineGauge data={disciplineData} />
        </div>

        {/* Mood Timeline */}
        <div className="glass-card rounded-lg p-4 border border-border/50">
          <MoodTimeline sessions={sessions} />
        </div>
      </motion.div>

      {/* Bottom row: Emotion Chart + Streaks */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Emotion Impact */}
        <div className="glass-card rounded-lg p-4 border border-border/50">
          <EmotionImpactChart stats={emotionStats} />
        </div>

        {/* Streaks */}
        <div className="glass-card rounded-lg p-4 border border-border/50">
          <StreakDisplay data={streakData} />
        </div>
      </motion.div>
    </motion.div>
  );
}
