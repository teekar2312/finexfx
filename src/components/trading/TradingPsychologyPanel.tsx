'use client';

import { useState } from 'react';
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

// ─── Seeded Random ──────────────────────────────────────────────────────────

function createSeededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

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

// ─── Mock Data Generation ──────────────────────────────────────────────────

function generateMockData() {
  const rng = createSeededRandom(42);

  // Discipline sub-scores
  const subScoreNames: Array<{ name: string; icon: React.ElementType }> = [
    { name: 'Plan Adherence', icon: Target },
    { name: 'Risk Management', icon: Shield },
    { name: 'Patience', icon: Meh },
    { name: 'Emotional Control', icon: Brain },
    { name: 'Trade Selection', icon: Activity },
    { name: 'Position Sizing', icon: TrendingUp },
    { name: 'Exit Discipline', icon: Zap },
  ];

  const subScores: DisciplineSubScore[] = subScoreNames.map((item) => ({
    name: item.name,
    score: Math.round(rng() * 35 + 60), // 60-95 range for realistic good trader
    icon: item.icon,
  }));

  const overall = Math.round(
    subScores.reduce((sum, s) => sum + s.score, 0) / subScores.length
  );

  const grade =
    overall >= 90 ? 'A' : overall >= 80 ? 'B' : overall >= 70 ? 'C' : overall >= 60 ? 'D' : 'F';

  const disciplineData: DisciplineData = { overall, grade, subScores };

  // Session mood timeline — last 8 sessions
  const moods: Mood[] = ['Great', 'Good', 'Neutral', 'Frustrated', 'Tilted'];
  const moodNotes: Record<Mood, string[]> = {
    Great: [
      'Followed plan perfectly, no deviations',
      'Best session this week, excellent focus',
    ],
    Good: [
      'Solid session, minor overtrading',
      'Good execution on main setups',
    ],
    Neutral: [
      'Mixed results, mostly wait-and-see',
      'No strong conviction, kept size small',
    ],
    Frustrated: [
      'Missed entry on USD/JPY breakout',
      'Two stop-outs early, confidence shaken',
    ],
    Tilted: [
      'Revenge traded after GBP/USD loss',
      'Overleveraged on XAU/USD, need cooldown',
    ],
  };

  const sessions: SessionMood[] = [];
  const baseDates = [
    '2024-12-02', '2024-12-03', '2024-12-04', '2024-12-05',
    '2024-12-08', '2024-12-09', '2024-12-10', '2024-12-11',
  ];

  for (let i = 0; i < 8; i++) {
    const mood = moods[Math.floor(rng() * moods.length)];
    const pnl =
      mood === 'Great' ? Math.round(rng() * 300 + 100) :
      mood === 'Good' ? Math.round(rng() * 200 - 30) :
      mood === 'Neutral' ? Math.round(rng() * 100 - 50) :
      mood === 'Frustrated' ? Math.round(rng() * 200 - 250) :
      Math.round(rng() * 300 - 400);

    const notesArr = moodNotes[mood];
    const notes = notesArr[Math.floor(rng() * notesArr.length)];

    sessions.push({
      date: baseDates[i],
      shortDate: baseDates[i].slice(5).replace('-', '/'),
      mood,
      pnl,
      notes,
      tradeCount: Math.round(rng() * 8 + 2),
      isCurrent: i === 7,
    });
  }

  // Emotion stats
  const emotionStats: EmotionStat[] = [
    { name: 'Confident', count: 12, winRate: 72, color: 'text-emerald-400', bgColor: 'bg-emerald-500', icon: SmilePlus },
    { name: 'Anxious', count: 8, winRate: 45, color: 'text-amber-400', bgColor: 'bg-amber-500', icon: AlertTriangle },
    { name: 'FOMO', count: 5, winRate: 30, color: 'text-orange-400', bgColor: 'bg-orange-500', icon: Zap },
    { name: 'Revenge', count: 3, winRate: 15, color: 'text-red-400', bgColor: 'bg-red-500', icon: Frown },
  ];

  // Streak data
  const streakData: StreakData = {
    currentWin: 4,
    currentLoss: 0,
    bestWin: 12,
    worstLoss: 5,
  };

  return { disciplineData, sessions, emotionStats, streakData };
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function getGaugeColor(score: number): string {
  if (score <= 30) return 'rgb(239, 68, 68)';   // red-500
  if (score <= 60) return 'rgb(245, 158, 11)';   // amber-500
  return 'rgb(16, 185, 129)';                    // emerald-500
}

function getGaugeStroke(score: number): string {
  if (score <= 30) return 'stroke-red-500';
  if (score <= 60) return 'stroke-amber-500';
  return 'stroke-emerald-500';
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
  return `${sign}$${val}`;
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

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Heart className="w-3.5 h-3.5 text-pink-400" />
        <h3 className="text-xs font-semibold">Session Mood Timeline</h3>
        <span className="text-[9px] text-muted-foreground ml-auto">Last 8 Sessions</span>
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
  const maxCount = Math.max(...stats.map((s) => s.count));

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
      <motion.div
        className="flex items-start gap-2 mt-3 p-2.5 rounded-lg bg-emerald-500/[0.06] border border-emerald-500/10"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.2, duration: 0.5 }}
      >
        <Activity className="w-3.5 h-3.5 text-emerald-400 mt-0.5 flex-shrink-0" />
        <p className="text-[10px] text-emerald-400/90 leading-relaxed">
          Your best trades come from a <span className="font-semibold text-emerald-400">Confident</span> state (72% WR). 
          Avoid trading when feeling <span className="font-semibold text-red-400">Revenge</span> — only 15% win rate.
        </p>
      </motion.div>
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

// ─── Main Component ─────────────────────────────────────────────────────────

const mockData = generateMockData();

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.12, delayChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
};

export default function TradingPsychologyPanel() {
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
          <DisciplineGauge data={mockData.disciplineData} />
        </div>

        {/* Mood Timeline */}
        <div className="glass-card rounded-lg p-4 border border-border/50">
          <MoodTimeline sessions={mockData.sessions} />
        </div>
      </motion.div>

      {/* Bottom row: Emotion Chart + Streaks */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Emotion Impact */}
        <div className="glass-card rounded-lg p-4 border border-border/50">
          <EmotionImpactChart stats={mockData.emotionStats} />
        </div>

        {/* Streaks */}
        <div className="glass-card rounded-lg p-4 border border-border/50">
          <StreakDisplay data={mockData.streakData} />
        </div>
      </motion.div>
    </motion.div>
  );
}
