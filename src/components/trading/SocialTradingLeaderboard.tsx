'use client';

import { useState, useMemo, useCallback, useEffect, memo } from 'react';
import { useTradingStore } from '@/store/trading-store';
import { STRATEGIES, type StrategyName, type Symbol } from '@/lib/types';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Trophy,
  Crown,
  Medal,
  Search,
  Filter,
  Users,
  TrendingUp,
  TrendingDown,
  ChevronDown,
  ChevronUp,
  Star,
  Eye,
  UserPlus,
  UserCheck,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

// ── Types ──────────────────────────────────────────────────────────────
type RiskLevel = 'Conservative' | 'Moderate' | 'Aggressive';
type TimeTab = 'overall' | 'weekly' | 'monthly';

interface MockTrader {
  id: string;
  name: string;
  initials: string;
  avatarColor: string;
  isUser: boolean;
  totalPnl: number;
  winRate: number;
  totalTrades: number;
  bestStreak: number;
  strategy: StrategyName;
  riskLevel: RiskLevel;
  weeklyChange: number;
  sparkline: number[];
  dailyPnl: number[];
  topPairs: { symbol: Symbol; pct: number }[];
  strategyDist: { strategy: StrategyName; pct: number }[];
}

// ── Constants ──────────────────────────────────────────────────────────
const TRADER_NAMES = [
  'Andi S.', 'Rina W.', 'Budi P.', 'Sari M.', 'Dedi K.',
  'Lina H.', 'Hendra T.', 'Dewi A.', 'Agus R.', 'Nurul F.',
  'Wahyu B.', 'Fitri C.', 'Eko J.', 'Maya D.', 'Rudi N.',
  'Yuli S.', 'Joko M.', 'Ani P.', 'Toni W.', 'Ratna K.',
];

const AVATAR_COLORS = [
  '#F59E0B', '#10B981', '#EF4444', '#8B5CF6', '#EC4899',
  '#06B6D4', '#F97316', '#14B8A6', '#A855F7', '#3B82F6',
  '#E11D48', '#84CC16', '#6366F1', '#F43F5E', '#0EA5E9',
  '#D946EF', '#22C55E', '#F59E0B', '#64748B', '#EAB308',
];

const STRATEGY_KEYS: StrategyName[] = [
  'MA_Ribbon', 'Momentum_Scalping', 'Pivot_Points', 'EMA_Crossover',
  'RMI_Trend_Sync', 'Linear_Regression', 'EMA_RSI_Filter',
];

const RISK_LEVELS: RiskLevel[] = ['Conservative', 'Moderate', 'Aggressive'];

const ALL_SYMBOLS: Symbol[] = ['EURUSD', 'USDJPY', 'GBPUSD', 'XAUUSD'];

const GOLD = '#F59E0B';
const SILVER = '#94A3B8';
const BRONZE = '#CD7F32';

// ── Seed-based random for consistent data ─────────────────────────────
function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// ── Generate sparkline data ────────────────────────────────────────────
function genSparkline(rand: () => number, base: number, volatility: number, len = 15): number[] {
  const arr: number[] = [base];
  for (let i = 1; i < len; i++) {
    arr.push(arr[i - 1] + (rand() - 0.45) * volatility);
  }
  return arr;
}

// ── Generate daily P&L (7 days) ───────────────────────────────────────
function genDailyPnl(rand: () => number, scale: number): number[] {
  return Array.from({ length: 7 }, () => (rand() - 0.35) * scale);
}

// ── Generate top pairs ─────────────────────────────────────────────────
function genTopPairs(rand: () => number): { symbol: Symbol; pct: number }[] {
  const shuffled = [...ALL_SYMBOLS].sort(() => rand() - 0.5);
  const count = 2 + Math.floor(rand() * 3);
  const picked = shuffled.slice(0, count);
  let remaining = 100;
  return picked.map((sym, i) => {
    const pct = i === picked.length - 1 ? remaining : Math.floor(rand() * (remaining - (picked.length - i - 1)) + (picked.length - i - 1));
    remaining -= pct;
    return { symbol: sym, pct };
  }).filter(p => p.pct > 0).sort((a, b) => b.pct - a.pct);
}

// ── Generate strategy distribution ─────────────────────────────────────
function genStrategyDist(rand: () => number): { strategy: StrategyName; pct: number }[] {
  const shuffled = [...STRATEGY_KEYS].sort(() => rand() - 0.5);
  const count = 2 + Math.floor(rand() * 3);
  const picked = shuffled.slice(0, count);
  let remaining = 100;
  return picked.map((s, i) => {
    const pct = i === picked.length - 1 ? remaining : Math.floor(rand() * (remaining - (picked.length - i - 1)) + (picked.length - i - 1));
    remaining -= pct;
    return { strategy: s, pct };
  }).filter(d => d.pct > 0).sort((a, b) => b.pct - a.pct);
}

// ── Generate mock traders for a time period ────────────────────────────
function generateTraders(tab: TimeTab, userTrader: MockTrader): MockTrader[] {
  const seedBase = tab === 'overall' ? 100 : tab === 'weekly' ? 200 : 300;
  const pnlScale = tab === 'overall' ? 1 : tab === 'weekly' ? 0.3 : 0.6;
  const tradeScale = tab === 'overall' ? 1 : tab === 'weekly' ? 0.2 : 0.5;

  const traders: MockTrader[] = [];

  // Insert user at position 7 (rank #8)
  // First generate 7 traders that rank above user
  for (let i = 0; i < 7; i++) {
    const rand = seededRandom(seedBase + i);
    const pnl = userTrader.totalPnl + (rand() * 3000 + 200) * pnlScale;
    traders.push({
      id: `mock-${i}`,
      name: TRADER_NAMES[i],
      initials: TRADER_NAMES[i].split(' ').map(w => w[0]).join(''),
      avatarColor: AVATAR_COLORS[i],
      isUser: false,
      totalPnl: pnl,
      winRate: 55 + rand() * 35,
      totalTrades: Math.floor((40 + rand() * 200) * tradeScale),
      bestStreak: Math.floor(5 + rand() * 20),
      strategy: STRATEGY_KEYS[Math.floor(rand() * STRATEGY_KEYS.length)],
      riskLevel: RISK_LEVELS[Math.floor(rand() * RISK_LEVELS.length)],
      weeklyChange: (rand() - 0.3) * 15,
      sparkline: genSparkline(rand, 100, 8 + rand() * 12),
      dailyPnl: genDailyPnl(rand, 200 + rand() * 600),
      topPairs: genTopPairs(rand),
      strategyDist: genStrategyDist(rand),
    });
  }

  // Insert user at index 7
  const userRand = seededRandom(seedBase + 77);
  traders.push({
    ...userTrader,
    sparkline: genSparkline(userRand, 100, 6),
    dailyPnl: genDailyPnl(userRand, 100 + Math.abs(userTrader.totalPnl) * 0.05),
    topPairs: genTopPairs(userRand),
    strategyDist: genStrategyDist(userRand),
  });

  // Generate 12 more traders below user
  for (let i = 8; i < 20; i++) {
    const rand = seededRandom(seedBase + i);
    const pnl = userTrader.totalPnl - (rand() * 3000 + 100) * pnlScale;
    traders.push({
      id: `mock-${i}`,
      name: TRADER_NAMES[i],
      initials: TRADER_NAMES[i].split(' ').map(w => w[0]).join(''),
      avatarColor: AVATAR_COLORS[i],
      isUser: false,
      totalPnl: pnl,
      winRate: 35 + rand() * 45,
      totalTrades: Math.floor((20 + rand() * 150) * tradeScale),
      bestStreak: Math.floor(2 + rand() * 15),
      strategy: STRATEGY_KEYS[Math.floor(rand() * STRATEGY_KEYS.length)],
      riskLevel: RISK_LEVELS[Math.floor(rand() * RISK_LEVELS.length)],
      weeklyChange: (rand() - 0.4) * 20,
      sparkline: genSparkline(rand, 100, 5 + rand() * 15),
      dailyPnl: genDailyPnl(rand, 100 + rand() * 400),
      topPairs: genTopPairs(rand),
      strategyDist: genStrategyDist(rand),
    });
  }

  // Sort by totalPnl descending and assign rank
  traders.sort((a, b) => b.totalPnl - a.totalPnl);
  return traders;
}

// ── Mini Sparkline Component ───────────────────────────────────────────
const MiniSparkline = memo(function MiniSparkline({
  values,
  width = 64,
  height = 20,
  strokeWidth = 1.2,
}: {
  values: number[];
  width?: number;
  height?: number;
  strokeWidth?: number;
}) {
  if (values.length < 2) return null;
  const pts = values.slice(-15);
  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const range = max - min || 1;
  const pad = 1;
  const points = pts
    .map((v, i) => {
      const x = pad + (i / (pts.length - 1)) * (width - pad * 2);
      const y = pad + (1 - (v - min) / range) * (height - pad * 2);
      return `${x},${y}`;
    })
    .join(' ');
  const isUp = pts[pts.length - 1] >= pts[0];
  const color = isUp ? '#10b981' : '#ef4444';
  return (
    <svg width={width} height={height} className="inline-block flex-shrink-0">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
});

// ── Large Podium Sparkline ─────────────────────────────────────────────
const PodiumSparkline = memo(function PodiumSparkline({
  values,
  width = 120,
  height = 40,
}: {
  values: number[];
  width?: number;
  height?: number;
}) {
  if (values.length < 2) return null;
  const pts = values.slice(-15);
  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const range = max - min || 1;
  const pad = 2;
  const points = pts
    .map((v, i) => {
      const x = pad + (i / (pts.length - 1)) * (width - pad * 2);
      const y = pad + (1 - (v - min) / range) * (height - pad * 2);
      return `${x},${y}`;
    })
    .join(' ');
  const isUp = pts[pts.length - 1] >= pts[0];
  const color = isUp ? '#10b981' : '#ef4444';
  const gradId = `podium-grad-${Math.random().toString(36).slice(2, 8)}`;
  return (
    <svg width={width} height={height} className="inline-block">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon
        fill={`url(#${gradId})`}
        points={`${pad},${height - pad} ${points} ${width - pad},${height - pad}`}
      />
      <polyline
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
});

// ── Rank Badge ─────────────────────────────────────────────────────────
function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <div
        className="flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold"
        style={{ backgroundColor: `${GOLD}20`, color: GOLD, border: `1.5px solid ${GOLD}` }}
      >
        <Crown className="w-3.5 h-3.5" />
      </div>
    );
  }
  if (rank === 2) {
    return (
      <div
        className="flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold"
        style={{ backgroundColor: `${SILVER}20`, color: SILVER, border: `1.5px solid ${SILVER}` }}
      >
        <Trophy className="w-3.5 h-3.5" />
      </div>
    );
  }
  if (rank === 3) {
    return (
      <div
        className="flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold"
        style={{ backgroundColor: `${BRONZE}20`, color: BRONZE, border: `1.5px solid ${BRONZE}` }}
      >
        <Medal className="w-3.5 h-3.5" />
      </div>
    );
  }
  return (
    <div className="flex items-center justify-center w-7 h-7 rounded-full bg-muted/50 text-muted-foreground text-xs font-mono font-medium">
      {rank}
    </div>
  );
}

// ── Podium Card ────────────────────────────────────────────────────────
function PodiumCard({
  trader,
  rank,
}: {
  trader: MockTrader;
  rank: number;
}) {
  const accentColor = rank === 1 ? GOLD : rank === 2 ? SILVER : BRONZE;
  const glowClass = rank === 1
    ? 'shadow-[0_0_30px_rgba(245,158,11,0.15)]'
    : rank === 2
      ? 'shadow-[0_0_20px_rgba(148,163,184,0.1)]'
      : 'shadow-[0_0_15px_rgba(205,127,50,0.1)]';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, delay: rank * 0.1 }}
      className={`glass-card-premium rounded-xl p-4 flex flex-col gap-3 relative overflow-hidden ${glowClass}`}
    >
      {/* Accent line */}
      <div
        className="absolute top-0 left-0 right-0 h-0.5"
        style={{ background: `linear-gradient(90deg, transparent, ${accentColor}, transparent)` }}
      />

      {/* Rank + Avatar */}
      <div className="flex items-center gap-3">
        <div
          className="flex items-center justify-center w-10 h-10 rounded-full"
          style={{ backgroundColor: `${accentColor}25`, color: accentColor }}
        >
          {rank === 1 ? <Crown className="w-5 h-5" /> : rank === 2 ? <Trophy className="w-5 h-5" /> : <Medal className="w-5 h-5" />}
        </div>
        <Avatar className="w-10 h-10">
          <AvatarFallback
            className="text-foreground font-semibold text-sm"
            style={{ backgroundColor: trader.avatarColor }}
          >
            {trader.initials}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">{trader.name}</p>
          <p className="text-[10px] text-muted-foreground">{STRATEGIES[trader.strategy].label}</p>
        </div>
        <Badge
          variant="outline"
          className="text-[10px] px-1.5 py-0"
          style={{ borderColor: `${accentColor}40`, color: accentColor }}
        >
          #{rank}
        </Badge>
      </div>

      {/* Sparkline */}
      <div className="flex justify-center">
        <PodiumSparkline values={trader.sparkline} />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2">
        <div className="text-center">
          <p className={`text-sm font-mono font-semibold ${trader.totalPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {trader.totalPnl >= 0 ? '+' : ''}${trader.totalPnl.toFixed(0)}
          </p>
          <p className="text-[10px] text-muted-foreground">Total P&L</p>
        </div>
        <div className="text-center">
          <p className="text-sm font-mono font-semibold text-foreground">{trader.winRate.toFixed(1)}%</p>
          <p className="text-[10px] text-muted-foreground">Win Rate</p>
        </div>
      </div>

      {/* Risk badge */}
      <Badge
        variant="secondary"
        className="w-fit text-[10px] self-center"
      >
        {trader.riskLevel}
      </Badge>
    </motion.div>
  );
}

// ── Trader Expanded Detail ─────────────────────────────────────────────
function TraderDetail({ trader }: { trader: MockTrader }) {
  const maxDaily = Math.max(...trader.dailyPnl.map(Math.abs), 1);
  const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="overflow-hidden"
    >
      <div className="px-4 pb-4 pt-2 border-t border-border/50">
        {/* Daily P&L bar chart */}
        <p className="text-xs text-muted-foreground mb-2 font-medium">Daily P&L (Last 7 Days)</p>
        <div className="flex items-end gap-1.5 h-16 mb-4">
          {trader.dailyPnl.map((val, i) => {
            const h = Math.max(4, (Math.abs(val) / maxDaily) * 56);
            const isUp = val >= 0;
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-[9px] font-mono text-muted-foreground">
                  {val >= 0 ? '+' : ''}{val.toFixed(0)}
                </span>
                <div
                  className={`w-full rounded-sm ${isUp ? 'bg-emerald-500/70' : 'bg-red-500/70'}`}
                  style={{ height: `${h}px` }}
                />
                <span className="text-[9px] text-muted-foreground">{dayLabels[i]}</span>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Top pairs */}
          <div>
            <p className="text-xs text-muted-foreground mb-2 font-medium">Top Pairs</p>
            <div className="flex flex-wrap gap-1.5">
              {trader.topPairs.map((p) => (
                <Badge key={p.symbol} variant="outline" className="text-[10px] font-mono">
                  {p.symbol}
                  <span className="ml-1 text-muted-foreground">{p.pct}%</span>
                </Badge>
              ))}
            </div>
          </div>

          {/* Strategy distribution */}
          <div>
            <p className="text-xs text-muted-foreground mb-2 font-medium">Strategy Distribution</p>
            <div className="flex flex-wrap gap-1.5">
              {trader.strategyDist.map((d) => (
                <Badge key={d.strategy} variant="secondary" className="text-[10px]">
                  {STRATEGIES[d.strategy].label}
                  <span className="ml-1 font-mono text-muted-foreground">{d.pct}%</span>
                </Badge>
              ))}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ── Follow Button ──────────────────────────────────────────────────────
function FollowButton({ traderId }: { traderId: string }) {
  const [following, setFollowing] = useState(() => {
    if (typeof window === 'undefined') return false;
    const stored = localStorage.getItem('finex-followed-traders');
    if (!stored) return false;
    try {
      const list: string[] = JSON.parse(stored);
      return list.includes(traderId);
    } catch {
      return false;
    }
  });

  const toggleFollow = useCallback(() => {
    setFollowing((prev) => {
      const stored = localStorage.getItem('finex-followed-traders');
      let list: string[] = [];
      try {
        list = stored ? JSON.parse(stored) : [];
      } catch {
        list = [];
      }
      if (prev) {
        list = list.filter((id) => id !== traderId);
      } else {
        list.push(traderId);
      }
      localStorage.setItem('finex-followed-traders', JSON.stringify(list));
      return !prev;
    });
  }, [traderId]);

  return (
    <Button
      variant={following ? 'secondary' : 'outline'}
      size="sm"
      onClick={toggleFollow}
      className={`h-7 text-[10px] gap-1 ${following ? 'text-emerald-400 border-emerald-500/30' : ''}`}
    >
      {following ? <UserCheck className="w-3 h-3" /> : <UserPlus className="w-3 h-3" />}
      {following ? 'Following' : 'Follow'}
    </Button>
  );
}

// ── Main Component ─────────────────────────────────────────────────────
export default function SocialTradingLeaderboard() {
  const [activeTab, setActiveTab] = useState<TimeTab>('overall');
  const [searchQuery, setSearchQuery] = useState('');
  const [riskFilter, setRiskFilter] = useState<string>('all');
  const [strategyFilter, setStrategyFilter] = useState<string>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Store selectors for user data
  const closedTrades = useTradingStore((s) => s.closedTrades);
  const balance = useTradingStore((s) => s.balance);
  const totalPnl = useTradingStore((s) => s.totalPnl);

  // Compute user stats from store
  const userStats = useMemo(() => {
    const wins = closedTrades.filter((t) => (t.profit ?? 0) >= 0).length;
    const total = closedTrades.length || 1;
    const winRate = (wins / total) * 100;
    let streak = 0;
    let maxStreak = 0;
    for (const t of [...closedTrades].reverse()) {
      if ((t.profit ?? 0) >= 0) {
        streak++;
        maxStreak = Math.max(maxStreak, streak);
      } else {
        streak = 0;
      }
    }
    return { winRate, totalTrades: closedTrades.length, bestStreak: maxStreak };
  }, [closedTrades]);

  // Build user trader object
  const userTrader: MockTrader = useMemo(() => ({
    id: 'user-self',
    name: 'Anda',
    initials: 'AN',
    avatarColor: '#10B981',
    isUser: true,
    totalPnl,
    winRate: userStats.winRate,
    totalTrades: userStats.totalTrades,
    bestStreak: userStats.bestStreak,
    strategy: 'EMA_Crossover' as StrategyName,
    riskLevel: 'Moderate' as RiskLevel,
    weeklyChange: totalPnl > 0 ? Math.min(totalPnl / balance * 100, 25) : Math.max(totalPnl / balance * 100, -20),
    sparkline: [],
    dailyPnl: [],
    topPairs: [],
    strategyDist: [],
  }), [totalPnl, balance, userStats]);

  // Generate traders based on tab
  const traders = useMemo(() => generateTraders(activeTab, userTrader), [activeTab, userTrader]);

  // Filter traders
  const filteredTraders = useMemo(() => {
    return traders.filter((t) => {
      if (searchQuery && !t.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      if (riskFilter !== 'all' && t.riskLevel !== riskFilter) return false;
      if (strategyFilter !== 'all' && t.strategy !== strategyFilter) return false;
      return true;
    });
  }, [traders, searchQuery, riskFilter, strategyFilter]);

  // Stats summary
  const stats = useMemo(() => {
    const allTraders = traders;
    const avgWinRate = allTraders.reduce((sum, t) => sum + t.winRate, 0) / allTraders.length;
    const best = allTraders.reduce((best, t) => (t.totalPnl > best.totalPnl ? t : best), allTraders[0]);
    const userRank = allTraders.findIndex((t) => t.isUser) + 1;
    return {
      totalTraders: allTraders.length,
      avgWinRate,
      bestPnl: best?.totalPnl ?? 0,
      userRank: userRank > 0 ? userRank : '-',
    };
  }, [traders]);

  const toggleExpand = useCallback((id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  const podiumTraders = filteredTraders.slice(0, 3);
  const tableTraders = filteredTraders.slice(3);

  return (
    <div className="flex flex-col gap-4">
      {/* Stats Summary Bar */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card-premium rounded-xl p-4"
      >
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-muted-foreground" />
            <div>
              <p className="text-[10px] text-muted-foreground">Total Traders</p>
              <p className="text-sm font-mono font-semibold">{stats.totalTraders}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            <div>
              <p className="text-[10px] text-muted-foreground">Avg Win Rate</p>
              <p className="text-sm font-mono font-semibold">{stats.avgWinRate.toFixed(1)}%</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Star className="w-4 h-4 text-amber-400" />
            <div>
              <p className="text-[10px] text-muted-foreground">Best Performer</p>
              <p className={`text-sm font-mono font-semibold ${stats.bestPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {stats.bestPnl >= 0 ? '+' : ''}${stats.bestPnl.toFixed(0)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-sky-400" />
            <div>
              <p className="text-[10px] text-muted-foreground">Your Rank</p>
              <p className="text-sm font-mono font-semibold text-emerald-400">#{stats.userRank}</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Tabs + Filters */}
      <motion.div
        initial={{ opacity: 0, y: -5 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="glass-card-premium rounded-xl p-4"
      >
        {/* Time Tabs */}
        <div className="flex gap-1 mb-4 bg-muted/30 rounded-lg p-1 w-fit">
          {(['overall', 'weekly', 'monthly'] as TimeTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => { setActiveTab(tab); setExpandedId(null); }}
              className={`px-4 py-1.5 text-xs font-medium rounded-md transition-all capitalize ${
                activeTab === tab
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Search + Filters */}
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              placeholder="Search trader..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-8 text-xs"
            />
          </div>

          <Select value={riskFilter} onValueChange={setRiskFilter}>
            <SelectTrigger size="sm" className="w-[140px] h-8 text-xs">
              <Filter className="w-3 h-3 mr-1" />
              <SelectValue placeholder="Risk Level" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">All Risk Levels</SelectItem>
              <SelectItem value="Conservative" className="text-xs">Conservative</SelectItem>
              <SelectItem value="Moderate" className="text-xs">Moderate</SelectItem>
              <SelectItem value="Aggressive" className="text-xs">Aggressive</SelectItem>
            </SelectContent>
          </Select>

          <Select value={strategyFilter} onValueChange={setStrategyFilter}>
            <SelectTrigger size="sm" className="w-[180px] h-8 text-xs">
              <SelectValue placeholder="Strategy" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">All Strategies</SelectItem>
              {STRATEGY_KEYS.map((sk) => (
                <SelectItem key={sk} value={sk} className="text-xs">
                  {STRATEGIES[sk].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </motion.div>

      {/* Top 3 Podium */}
      {podiumTraders.length >= 3 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Render in order: 2nd, 1st, 3rd for podium layout */}
          {[podiumTraders[1], podiumTraders[0], podiumTraders[2]].map((trader, idx) => {
            const rank = idx === 0 ? 2 : idx === 1 ? 1 : 3;
            return <PodiumCard key={trader.id} trader={trader} rank={rank} />;
          })}
        </div>
      )}

      <Separator className="opacity-30" />

      {/* Leaderboard Table */}
      <div className="glass-card-premium rounded-xl overflow-hidden">
        {/* Table Header */}
        <div className="grid grid-cols-[40px_1fr_80px_65px_55px_55px_90px_64px_60px] gap-2 px-4 py-2.5 border-b border-border/50 text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
          <span>#</span>
          <span>Trader</span>
          <span className="text-right">P&L</span>
          <span className="text-right">Win %</span>
          <span className="text-right">Trades</span>
          <span className="text-right">Streak</span>
          <span className="text-center">Strategy</span>
          <span className="text-center">Change</span>
          <span className="text-center">Chart</span>
        </div>

        {/* Table Rows */}
        <div className="max-h-[480px] overflow-y-auto">
          {tableTraders.map((trader, idx) => {
            const rank = idx + 4; // offset by 3 podium traders
            const isExpanded = expandedId === trader.id;
            const realRank = filteredTraders.indexOf(trader) + 1;

            return (
              <div key={trader.id}>
                <motion.button
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: idx * 0.03 }}
                  onClick={() => toggleExpand(trader.id)}
                  className={`w-full grid grid-cols-[40px_1fr_80px_65px_55px_55px_90px_64px_60px] gap-2 px-4 py-2.5 text-xs items-center hover:bg-muted/20 transition-colors border-b border-border/20 ${
                    trader.isUser
                      ? 'bg-emerald-500/5 border-l-2 border-l-emerald-500'
                      : ''
                  }`}
                >
                  {/* Rank */}
                  <div>
                    <RankBadge rank={realRank} />
                  </div>

                  {/* Trader info */}
                  <div className="flex items-center gap-2 min-w-0">
                    <Avatar className="w-7 h-7 flex-shrink-0">
                      <AvatarFallback
                        className="text-[10px] text-foreground font-semibold"
                        style={{ backgroundColor: trader.avatarColor }}
                      >
                        {trader.initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 text-left">
                      <p className={`text-xs font-medium truncate ${trader.isUser ? 'text-emerald-400' : 'text-foreground'}`}>
                        {trader.name}
                        {trader.isUser && (
                          <span className="ml-1 text-[9px] text-emerald-400/70">(You)</span>
                        )}
                      </p>
                      <Badge
                        variant="outline"
                        className={`text-[9px] px-1 py-0 h-4 ${
                          trader.riskLevel === 'Conservative'
                            ? 'border-emerald-500/30 text-emerald-400'
                            : trader.riskLevel === 'Aggressive'
                              ? 'border-red-500/30 text-red-400'
                              : 'border-amber-500/30 text-amber-400'
                        }`}
                      >
                        {trader.riskLevel}
                      </Badge>
                    </div>
                  </div>

                  {/* P&L */}
                  <p
                    className={`text-right font-mono font-medium ${
                      trader.totalPnl >= 0 ? 'text-emerald-400' : 'text-red-400'
                    }`}
                  >
                    {trader.totalPnl >= 0 ? '+' : ''}
                    ${trader.totalPnl.toFixed(0)}
                  </p>

                  {/* Win Rate */}
                  <p className="text-right font-mono text-muted-foreground">{trader.winRate.toFixed(1)}%</p>

                  {/* Total Trades */}
                  <p className="text-right font-mono text-muted-foreground">{trader.totalTrades}</p>

                  {/* Best Streak */}
                  <p className="text-right font-mono text-muted-foreground">{trader.bestStreak}</p>

                  {/* Strategy */}
                  <p className="text-center text-[10px] text-muted-foreground truncate px-1">
                    {STRATEGIES[trader.strategy].label}
                  </p>

                  {/* Weekly Change */}
                  <div className="flex items-center justify-center gap-0.5">
                    {trader.weeklyChange >= 0 ? (
                      <TrendingUp className="w-3 h-3 text-emerald-400" />
                    ) : (
                      <TrendingDown className="w-3 h-3 text-red-400" />
                    )}
                    <span
                      className={`font-mono text-[10px] ${
                        trader.weeklyChange >= 0 ? 'text-emerald-400' : 'text-red-400'
                      }`}
                    >
                      {trader.weeklyChange >= 0 ? '+' : ''}{trader.weeklyChange.toFixed(1)}%
                    </span>
                  </div>

                  {/* Sparkline + Expand icon */}
                  <div className="flex items-center gap-1 justify-center">
                    <MiniSparkline values={trader.sparkline} width={36} height={14} />
                    {isExpanded ? (
                      <ChevronUp className="w-3 h-3 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="w-3 h-3 text-muted-foreground" />
                    )}
                  </div>
                </motion.button>

                {/* Expanded detail */}
                <AnimatePresence>
                  {isExpanded && (
                    <>
                      <TraderDetail trader={trader} />
                      {!trader.isUser && (
                        <div className="px-4 pb-3">
                          <FollowButton traderId={trader.id} />
                        </div>
                      )}
                    </>
                  )}
                </AnimatePresence>
              </div>
            );
          })}

          {tableTraders.length === 0 && (
            <div className="py-12 text-center text-sm text-muted-foreground">
              <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p>No traders match your filters</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
