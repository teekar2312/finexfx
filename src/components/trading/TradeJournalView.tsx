'use client';

import { useState, useMemo } from 'react';
import { useTradingStore, type JournalEntry } from '@/store/trading-store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BookOpen,
  Plus,
  Search,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Target,
  Star,
  ChevronDown,
  ChevronUp,
  Pencil,
  Trash2,
  X,
  Filter,
  BarChart3,
  Smile,
  Meh,
  Frown,
  Angry,
  Clock,
  Tag,
  Lightbulb,
  AlertTriangle,
  Trophy,
  Percent,
  ArrowUpRight,
  ArrowDownRight,
  CalendarDays,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

const MOOD_CONFIG = {
  great: { emoji: '🏆', label: 'Great', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', Icon: Trophy },
  good: { emoji: '😊', label: 'Good', color: 'text-emerald-300', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', Icon: Smile },
  neutral: { emoji: '😐', label: 'Neutral', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20', Icon: Meh },
  bad: { emoji: '😟', label: 'Bad', color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20', Icon: Frown },
  terrible: { emoji: '💀', label: 'Terrible', color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20', Icon: Angry },
} as const;

const STRATEGIES = [
  'EMA Crossover', 'MA Ribbon', 'Momentum Scalping', 'Pivot Points',
  'RMI Trend Sync', 'Linear Regression', 'EMA/RSI Filter', 'Manual',
];

const SYMBOLS_LIST = ['EURUSD', 'GBPUSD', 'USDJPY', 'XAUUSD'];

const SYMBOL_DISPLAY: Record<string, string> = {
  EURUSD: 'EUR/USD', GBPUSD: 'GBP/USD', USDJPY: 'USD/JPY', XAUUSD: 'XAU/USD',
};

const MOOD_COLORS = ['#10b981', '#34d399', '#f59e0b', '#f97316', '#ef4444'];

function formatPrice(price: number, symbol: string) {
  if (symbol === 'XAUUSD') return price.toFixed(2);
  if (symbol === 'USDJPY') return price.toFixed(3);
  return price.toFixed(5);
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function StarRating({ rating, onChange, size = 'sm' }: { rating: number; onChange?: (r: number) => void; size?: 'sm' | 'md' }) {
  const sz = size === 'sm' ? 'h-3.5 w-3.5' : 'h-5 w-5';
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange?.(star)}
          className={`${onChange ? 'cursor-pointer hover:scale-110' : 'cursor-default'} transition-transform`}
        >
          <Star
            className={`${sz} ${star <= rating ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground/30'}`}
          />
        </button>
      ))}
    </div>
  );
}

// --- Journal Entry Form ---
function JournalEntryForm({
  entry,
  onSave,
  onCancel,
}: {
  entry?: JournalEntry;
  onSave: (data: Omit<JournalEntry, 'id' | 'createdAt'>) => void;
  onCancel: () => void;
}) {
  const isEdit = !!entry;
  const [symbol, setSymbol] = useState(entry?.symbol || 'EURUSD');
  const [direction, setDirection] = useState<'BUY' | 'SELL'>(entry?.direction || 'BUY');
  const [entryPrice, setEntryPrice] = useState(entry?.entryPrice.toString() || '');
  const [exitPrice, setExitPrice] = useState(entry?.exitPrice.toString() || '');
  const [lotSize, setLotSize] = useState(entry?.lotSize.toString() || '0.1');
  const [pips, setPips] = useState(entry?.pips.toString() || '');
  const [pnl, setPnl] = useState(entry?.pnl.toString() || '');
  const [strategy, setStrategy] = useState(entry?.strategy || 'EMA Crossover');
  const [openTime, setOpenTime] = useState(entry?.openTime ? entry.openTime.slice(0, 16) : '');
  const [closeTime, setCloseTime] = useState(entry?.closeTime ? entry.closeTime.slice(0, 16) : '');
  const [duration, setDuration] = useState(entry?.duration || '');
  const [notes, setNotes] = useState(entry?.notes || '');
  const [tagsStr, setTagsStr] = useState(entry?.tags.join(', ') || '');
  const [mood, setMood] = useState<JournalEntry['mood']>(entry?.mood || 'neutral');
  const [mistakesStr, setMistakesStr] = useState(entry?.mistakes.join(', ') || '');
  const [lessons, setLessons] = useState(entry?.lessons || '');
  const [rating, setRating] = useState(entry?.rating || 3);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      tradeId: entry?.tradeId || `t-${Date.now()}`,
      symbol,
      direction,
      entryPrice: parseFloat(entryPrice) || 0,
      exitPrice: parseFloat(exitPrice) || 0,
      pips: parseFloat(pips) || 0,
      pnl: parseFloat(pnl) || 0,
      lotSize: parseFloat(lotSize) || 0.01,
      strategy,
      openTime: openTime ? new Date(openTime).toISOString() : new Date().toISOString(),
      closeTime: closeTime ? new Date(closeTime).toISOString() : new Date().toISOString(),
      duration: duration || 'N/A',
      notes,
      tags: tagsStr.split(',').map((t) => t.trim()).filter(Boolean),
      mood,
      mistakes: mistakesStr.split(',').map((m) => m.trim()).filter(Boolean),
      lessons,
      rating,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Symbol</Label>
          <Select value={symbol} onValueChange={setSymbol}>
            <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {SYMBOLS_LIST.map((s) => (
                <SelectItem key={s} value={s} className="text-xs">{SYMBOL_DISPLAY[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Direction</Label>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant={direction === 'BUY' ? 'default' : 'outline'}
              className={`flex-1 h-9 text-xs ${direction === 'BUY' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}`}
              onClick={() => setDirection('BUY')}
            >BUY</Button>
            <Button
              type="button"
              size="sm"
              variant={direction === 'SELL' ? 'default' : 'outline'}
              className={`flex-1 h-9 text-xs ${direction === 'SELL' ? 'bg-red-600 hover:bg-red-700' : ''}`}
              onClick={() => setDirection('SELL')}
            >SELL</Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Entry Price</Label>
          <Input type="number" step="any" value={entryPrice} onChange={(e) => setEntryPrice(e.target.value)} className="h-9 text-xs" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Exit Price</Label>
          <Input type="number" step="any" value={exitPrice} onChange={(e) => setExitPrice(e.target.value)} className="h-9 text-xs" />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Pips</Label>
          <Input type="number" step="any" value={pips} onChange={(e) => setPips(e.target.value)} className="h-9 text-xs" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">P&L ($)</Label>
          <Input type="number" step="any" value={pnl} onChange={(e) => setPnl(e.target.value)} className="h-9 text-xs" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Lot Size</Label>
          <Input type="number" step="0.01" value={lotSize} onChange={(e) => setLotSize(e.target.value)} className="h-9 text-xs" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Strategy</Label>
          <Select value={strategy} onValueChange={setStrategy}>
            <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {STRATEGIES.map((s) => (
                <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Duration</Label>
          <Input value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="e.g. 1h 30m" className="h-9 text-xs" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Open Time</Label>
          <Input type="datetime-local" value={openTime} onChange={(e) => setOpenTime(e.target.value)} className="h-9 text-xs" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Close Time</Label>
          <Input type="datetime-local" value={closeTime} onChange={(e) => setCloseTime(e.target.value)} className="h-9 text-xs" />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Tags (comma-separated)</Label>
        <Input value={tagsStr} onChange={(e) => setTagsStr(e.target.value)} placeholder="trending, London session, breakout" className="h-9 text-xs" />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Trade Notes</Label>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="text-xs resize-none" placeholder="Describe what happened in this trade..." />
      </div>

      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Mood</Label>
        <div className="flex gap-2">
          {(Object.keys(MOOD_CONFIG) as Array<JournalEntry['mood']>).map((m) => {
            const cfg = MOOD_CONFIG[m];
            return (
              <button
                key={m}
                type="button"
                onClick={() => setMood(m)}
                className={`flex-1 flex flex-col items-center gap-1 p-2 rounded-lg border transition-all text-xs
                  ${mood === m ? `${cfg.bg} ${cfg.border} ${cfg.color} ring-1 ring-current/30` : 'border-border hover:bg-accent text-muted-foreground'}`}
              >
                <span className="text-base">{cfg.emoji}</span>
                <span>{cfg.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Mistakes (comma-separated)</Label>
        <Textarea value={mistakesStr} onChange={(e) => setMistakesStr(e.target.value)} rows={2} className="text-xs resize-none" placeholder="What went wrong?" />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Lessons Learned</Label>
        <Textarea value={lessons} onChange={(e) => setLessons(e.target.value)} rows={2} className="text-xs resize-none" placeholder="What did you learn from this trade?" />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Trade Rating</Label>
        <StarRating rating={rating} onChange={setRating} size="md" />
      </div>

      <div className="flex gap-2 pt-2">
        <Button type="button" variant="outline" size="sm" onClick={onCancel} className="flex-1 h-9 text-xs">
          Cancel
        </Button>
        <Button type="submit" size="sm" className="flex-1 h-9 text-xs">
          {isEdit ? 'Update Entry' : 'Add Entry'}
        </Button>
      </div>
    </form>
  );
}

// --- Journal Entry Card ---
function JournalEntryCard({
  entry,
  index,
  onEdit,
  onDelete,
}: {
  entry: JournalEntry;
  index: number;
  onEdit: (entry: JournalEntry) => void;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const isWin = entry.pnl >= 0;
  const moodCfg = MOOD_CONFIG[entry.mood];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.2 }}
      className="glass-card rounded-lg overflow-hidden parallax-hover"
    >
      {/* Card Header */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {/* Direction indicator */}
            <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center
              ${entry.direction === 'BUY' ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}>
              {entry.direction === 'BUY'
                ? <ArrowUpRight className={`h-5 w-5 text-emerald-400`} />
                : <ArrowDownRight className={`h-5 w-5 text-red-400`} />
              }
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold">{SYMBOL_DISPLAY[entry.symbol] || entry.symbol}</span>
                <Badge
                  variant="outline"
                  className={`text-[10px] px-1.5 py-0 font-semibold
                    ${entry.direction === 'BUY' ? 'border-emerald-500/40 text-emerald-400' : 'border-red-500/40 text-red-400'}`}
                >
                  {entry.direction}
                </Badge>
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground">
                  {entry.strategy}
                </Badge>
              </div>
              <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <CalendarDays className="h-3 w-3" />
                  {formatDate(entry.openTime)}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {entry.duration}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-end gap-1 flex-shrink-0">
            <span className={`text-sm font-bold tabular-nums ${isWin ? 'text-emerald-400' : 'text-red-400'}`}>
              {isWin ? '+' : ''}{entry.pnl.toFixed(2)}
            </span>
            <span className={`text-[11px] tabular-nums ${isWin ? 'text-emerald-400/70' : 'text-red-400/70'}`}>
              {isWin ? '+' : ''}{entry.pips} pips
            </span>
          </div>
        </div>

        {/* Price info row */}
        <div className="flex items-center gap-4 mt-3 text-[11px] text-muted-foreground">
          <span>Entry: <span className="text-foreground font-medium tabular-nums">{formatPrice(entry.entryPrice, entry.symbol)}</span></span>
          <span className="text-muted-foreground/40">→</span>
          <span>Exit: <span className="text-foreground font-medium tabular-nums">{formatPrice(entry.exitPrice, entry.symbol)}</span></span>
          <span className="ml-auto">Lot: <span className="text-foreground font-medium tabular-nums">{entry.lotSize}</span></span>
        </div>

        {/* Mood, rating, tags row */}
        <div className="flex items-center gap-3 mt-3 flex-wrap">
          <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium ${moodCfg.bg} ${moodCfg.color} border ${moodCfg.border}`}>
            <span>{moodCfg.emoji}</span>
            <span>{moodCfg.label}</span>
          </div>
          <StarRating rating={entry.rating} />
          <div className="flex items-center gap-1 ml-auto flex-wrap">
            {entry.tags.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="secondary" className="text-[9px] px-1.5 py-0 h-5 font-normal">
                {tag}
              </Badge>
            ))}
            {entry.tags.length > 3 && (
              <span className="text-[10px] text-muted-foreground">+{entry.tags.length - 3}</span>
            )}
          </div>
        </div>

        {/* Preview of notes */
          !expanded && entry.notes && (
            <p className="text-[11px] text-muted-foreground mt-3 line-clamp-2 leading-relaxed">
              {entry.notes}
            </p>
          )
        }
      </div>

      {/* Expand/Collapse Button */
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-center gap-1 py-2 text-[11px] text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors border-t border-border/50"
        >
          {expanded ? (
            <><ChevronUp className="h-3 w-3" /> Show less</>
          ) : (
            <><ChevronDown className="h-3 w-3" /> Show details</>
          )}
        </button>
      }

      {/* Expanded Content */
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="px-4 pb-4 space-y-4">
                <Separator />

                {/* Full Notes */}
                {entry.notes && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <BookOpen className="h-3 w-3 text-muted-foreground" />
                      <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Notes</span>
                    </div>
                    <p className="text-xs text-foreground/80 leading-relaxed bg-accent/30 rounded-lg p-3">
                      {entry.notes}
                    </p>
                  </div>
                )}

                {/* Mistakes */}
                {entry.mistakes.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <AlertTriangle className="h-3 w-3 text-amber-400" />
                      <span className="text-[11px] font-medium text-amber-400 uppercase tracking-wider">Mistakes</span>
                    </div>
                    <ul className="space-y-1">
                      {entry.mistakes.map((m, i) => (
                        <li key={i} className="text-xs text-foreground/70 flex items-start gap-2">
                          <span className="text-amber-400 mt-0.5">•</span>
                          {m}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Lessons */}
                {entry.lessons && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Lightbulb className="h-3 w-3 text-emerald-400" />
                      <span className="text-[11px] font-medium text-emerald-400 uppercase tracking-wider">Lessons</span>
                    </div>
                    <p className="text-xs text-foreground/80 leading-relaxed bg-emerald-500/5 border border-emerald-500/10 rounded-lg p-3">
                      {entry.lessons}
                    </p>
                  </div>
                )}

                {/* All Tags */}
                {entry.tags.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Tag className="h-3 w-3 text-muted-foreground" />
                      <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Tags</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {entry.tags.map((tag) => (
                        <Badge key={tag} variant="outline" className="text-[10px] px-2 py-0.5 font-normal">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Time Details */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-accent/30 rounded-lg p-2.5">
                    <span className="text-[10px] text-muted-foreground block">Opened</span>
                    <span className="text-xs font-medium tabular-nums">{formatDate(entry.openTime)} {formatTime(entry.openTime)}</span>
                  </div>
                  <div className="bg-accent/30 rounded-lg p-2.5">
                    <span className="text-[10px] text-muted-foreground block">Closed</span>
                    <span className="text-xs font-medium tabular-nums">{formatDate(entry.closeTime)} {formatTime(entry.closeTime)}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 h-8 text-xs gap-1.5"
                    onClick={() => onEdit(entry)}
                  >
                    <Pencil className="h-3 w-3" /> Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs gap-1.5 text-red-400 hover:text-red-300 border-red-500/20 hover:bg-red-500/10"
                    onClick={() => onDelete(entry.id)}
                  >
                    <Trash2 className="h-3 w-3" /> Delete
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
    }
    </motion.div>
  );
}

// --- Analytics Section ---
function JournalAnalytics({ entries }: { entries: JournalEntry[] }) {
  const wins = entries.filter((e) => e.pnl >= 0);
  const losses = entries.filter((e) => e.pnl < 0);
  const winRate = entries.length > 0 ? (wins.length / entries.length) * 100 : 0;
  const totalPnl = entries.reduce((s, e) => s + e.pnl, 0);
  const avgPnl = entries.length > 0 ? totalPnl / entries.length : 0;
  const avgRating = entries.length > 0 ? entries.reduce((s, e) => s + e.rating, 0) / entries.length : 0;
  const avgWin = wins.length > 0 ? wins.reduce((s, e) => s + e.pnl, 0) / wins.length : 0;
  const avgLoss = losses.length > 0 ? losses.reduce((s, e) => s + e.pnl, 0) / losses.length : 0;

  // Strategy performance
  const strategyMap = new Map<string, { count: number; pnl: number; wins: number }>();
  entries.forEach((e) => {
    const s = strategyMap.get(e.strategy) || { count: 0, pnl: 0, wins: 0 };
    s.count++;
    s.pnl += e.pnl;
    if (e.pnl >= 0) s.wins++;
    strategyMap.set(e.strategy, s);
  });
  const strategyData = Array.from(strategyMap.entries()).map(([name, data]) => ({
    name,
    trades: data.count,
    pnl: parseFloat(data.pnl.toFixed(2)),
    winRate: parseFloat(((data.wins / data.count) * 100).toFixed(0)),
  }));

  // Mood distribution
  const moodMap = new Map<string, number>();
  entries.forEach((e) => moodMap.set(e.mood, (moodMap.get(e.mood) || 0) + 1));
  const moodData = (Object.keys(MOOD_CONFIG) as Array<JournalEntry['mood']>).map((m) => ({
    name: MOOD_CONFIG[m].label,
    value: moodMap.get(m) || 0,
  })).filter((d) => d.value > 0);

  // P&L by symbol
  const symbolMap = new Map<string, number>();
  entries.forEach((e) => symbolMap.set(e.symbol, (symbolMap.get(e.symbol) || 0) + e.pnl));
  const symbolPnlData = Array.from(symbolMap.entries()).map(([sym, pnl]) => ({
    name: SYMBOL_DISPLAY[sym] || sym,
    pnl: parseFloat(pnl.toFixed(2)),
  }));

  return (
    <div className="space-y-4 elevated-card rounded-xl p-4">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 stagger-children">
        <Card className="glass-card border-0 p-0 card-hover">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                <Target className="h-3.5 w-3.5 text-primary" />
              </div>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Win Rate</span>
            </div>
            <div className="text-xl font-bold tabular-nums">{winRate.toFixed(0)}%</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">{wins.length}W / {losses.length}L</div>
          </CardContent>
        </Card>

        <Card className="glass-card border-0 p-0 card-hover">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <div className={`w-7 h-7 rounded-lg ${totalPnl >= 0 ? 'bg-emerald-500/10' : 'bg-red-500/10'} flex items-center justify-center`}>
                <DollarSign className={`h-3.5 w-3.5 ${totalPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`} />
              </div>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Total P&L</span>
            </div>
            <div className={`text-xl font-bold tabular-nums ${totalPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {totalPnl >= 0 ? '+' : ''}{totalPnl.toFixed(2)}
            </div>
            <div className={`text-[10px] mt-0.5 ${avgPnl >= 0 ? 'text-emerald-400/70' : 'text-red-400/70'}`}
            >Avg: {avgPnl >= 0 ? '+' : ''}{avgPnl.toFixed(2)}/trade</div>
          </CardContent>
        </Card>

        <Card className="glass-card border-0 p-0 card-hover">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-7 h-7 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <Star className="h-3.5 w-3.5 text-amber-400" />
              </div>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Avg Rating</span>
            </div>
            <div className="text-xl font-bold tabular-nums">{avgRating.toFixed(1)}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">out of 5.0</div>
          </CardContent>
        </Card>

        <Card className="glass-card border-0 p-0 card-hover">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                <TrendingUp className="h-3.5 w-3.5 text-primary" />
              </div>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Avg W/L</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-bold tabular-nums text-emerald-400">+{avgWin.toFixed(2)}</span>
              <span className="text-[10px] text-muted-foreground">/</span>
              <span className="text-sm font-bold tabular-nums text-red-400">{avgLoss.toFixed(2)}</span>
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">Win avg / Loss avg</div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 stagger-children">
        {/* P&L by Strategy */}
        <Card className="glass-card border-0 p-0 card-hover md:col-span-2">
          <CardHeader className="pb-2 pt-4 px-4">
            <span className="section-title-accent"><CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <BarChart3 className="h-3.5 w-3.5" /> P&L by Strategy
            </CardTitle></span>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={strategyData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 10, fill: '#94a3b8' }}
                    axisLine={{ stroke: 'rgba(255,255,255,0.06)' }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: '#94a3b8' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `$${v}`}
                  />
                  <RechartsTooltip
                    contentStyle={{
                      background: 'rgba(17,24,39,0.9)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '8px',
                      fontSize: '11px',
                    }}
                    formatter={(value: number) => [`$${value.toFixed(2)}`, 'P&L']}
                    labelStyle={{ color: '#e2e8f0' }}
                  />
                  <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                    {strategyData.map((entry, i) => (
                      <Cell
                        key={`cell-${i}`}
                        fill={entry.pnl >= 0 ? '#10b981' : '#ef4444'}
                        fillOpacity={0.8}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Mood Distribution */}
        <Card className="glass-card border-0 p-0 card-hover">
          <CardHeader className="pb-2 pt-4 px-4">
            <span className="section-title-accent"><CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Smile className="h-3.5 w-3.5" /> Mood Distribution
            </CardTitle></span>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="h-48 flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={moodData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={65}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {moodData.map((_, i) => (
                      <Cell key={`mood-${i}`} fill={MOOD_COLORS[i]} fillOpacity={0.8} />
                    ))}
                  </Pie>
                  <RechartsTooltip
                    contentStyle={{
                      background: 'rgba(17,24,39,0.9)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '8px',
                      fontSize: '11px',
                    }}
                    formatter={(value: number) => [`${value} trades`, 'Count']}
                    labelStyle={{ color: '#e2e8f0' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 justify-center">
              {moodData.map((d, i) => (
                <div key={d.name} className="flex items-center gap-1 text-[10px]">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: MOOD_COLORS[i] }} />
                  <span className="text-muted-foreground">{d.name} ({d.value})</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* P&L by Symbol */}
      <Card className="glass-card border-0 p-0 card-hover">
        <CardHeader className="pb-2 pt-4 px-4">
          <span className="section-title-accent"><CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <DollarSign className="h-3.5 w-3.5" /> P&L by Symbol
          </CardTitle></span>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="flex flex-wrap gap-3">
            {symbolPnlData.map((s) => (
              <div key={s.name} className="flex items-center gap-2 bg-accent/30 rounded-lg px-3 py-2">
                <span className="text-xs font-medium">{s.name}</span>
                <span className={`text-xs font-bold tabular-nums ${s.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {s.pnl >= 0 ? '+' : ''}{s.pnl.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// --- Main Journal View ---
export default function TradeJournalView() {
  const { journalEntries, addJournalEntry, updateJournalEntry, deleteJournalEntry, addNotification } = useTradingStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterSymbol, setFilterSymbol] = useState<string>('all');
  const [filterMood, setFilterMood] = useState<string>('all');
  const [filterStrategy, setFilterStrategy] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'date' | 'pnl' | 'pips' | 'rating'>('date');
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc');
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<JournalEntry | undefined>(undefined);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Extract unique strategies from entries for filter
  const allStrategies = useMemo(() => {
    const set = new Set(journalEntries.map((e) => e.strategy));
    return Array.from(set).sort();
  }, [journalEntries]);

  // Filter and sort entries
  const filteredEntries = useMemo(() => {
    let result = [...journalEntries];

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (e) =>
          e.symbol.toLowerCase().includes(q) ||
          e.strategy.toLowerCase().includes(q) ||
          e.notes.toLowerCase().includes(q) ||
          e.tags.some((t) => t.toLowerCase().includes(q)) ||
          e.lessons.toLowerCase().includes(q)
      );
    }

    if (filterSymbol !== 'all') {
      result = result.filter((e) => e.symbol === filterSymbol);
    }
    if (filterMood !== 'all') {
      result = result.filter((e) => e.mood === filterMood);
    }
    if (filterStrategy !== 'all') {
      result = result.filter((e) => e.strategy === filterStrategy);
    }

    result.sort((a, b) => {
      const dir = sortDir === 'desc' ? -1 : 1;
      switch (sortBy) {
        case 'date': return dir * (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        case 'pnl': return dir * (a.pnl - b.pnl);
        case 'pips': return dir * (a.pips - b.pips);
        case 'rating': return dir * (a.rating - b.rating);
        default: return 0;
      }
    });

    return result;
  }, [journalEntries, searchQuery, filterSymbol, filterMood, filterStrategy, sortBy, sortDir]);

  const handleAddEntry = (data: Omit<JournalEntry, 'id' | 'createdAt'>) => {
    addJournalEntry({
      ...data,
      id: `j-${Date.now()}`,
      createdAt: new Date().toISOString(),
    });
    setDialogOpen(false);
    setEditingEntry(undefined);
    addNotification({ type: 'success', title: 'Journal Entry Added', message: `${data.direction} ${data.symbol} logged in journal` });
  };

  const handleUpdateEntry = (data: Omit<JournalEntry, 'id' | 'createdAt'>) => {
    if (editingEntry) {
      updateJournalEntry(editingEntry.id, data);
      setDialogOpen(false);
      setEditingEntry(undefined);
      addNotification({ type: 'success', title: 'Entry Updated', message: 'Journal entry has been updated' });
    }
  };

  const handleEdit = (entry: JournalEntry) => {
    setEditingEntry(entry);
    setDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    deleteJournalEntry(id);
    setDeleteConfirm(null);
    addNotification({ type: 'info', title: 'Entry Deleted', message: 'Journal entry removed' });
  };

  const handleSave = editingEntry ? handleUpdateEntry : handleAddEntry;

  const handleToggleSort = (field: typeof sortBy) => {
    if (sortBy === field) {
      setSortDir(sortDir === 'desc' ? 'asc' : 'desc');
    } else {
      setSortBy(field);
      setSortDir('desc');
    }
  };

  const hasActiveFilters = searchQuery || filterSymbol !== 'all' || filterMood !== 'all' || filterStrategy !== 'all';

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <BookOpen className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-bold">Trade Journal</h1>
              <p className="text-xs text-muted-foreground">Review, annotate, and learn from your closed trades</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={showAnalytics ? 'default' : 'outline'}
            size="sm"
            className="h-8 text-xs gap-1.5"
            onClick={() => setShowAnalytics(!showAnalytics)}
          >
            <BarChart3 className="h-3.5 w-3.5" />
            Analytics
          </Button>
          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditingEntry(undefined); }}>
            <DialogTrigger asChild>
              <Button size="sm" className="h-8 text-xs gap-1.5">
                <Plus className="h-3.5 w-3.5" />
                New Entry
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-sm">{editingEntry ? 'Edit Journal Entry' : 'New Journal Entry'}</DialogTitle>
              </DialogHeader>
              <JournalEntryForm
                entry={editingEntry}
                onSave={handleSave}
                onCancel={() => { setDialogOpen(false); setEditingEntry(undefined); }}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Analytics Panel */}
      <AnimatePresence>
        {showAnalytics && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <JournalAnalytics entries={journalEntries} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filters Bar */}
      <Card className="glass-card border-0 p-0 card-hover">
        <CardContent className="p-3">
          <div className="flex flex-col md:flex-row gap-3">
            {/* Search */}
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search notes, tags, strategies..."
                className="h-8 pl-8 text-xs"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>

            {/* Symbol Filter */}
            <Select value={filterSymbol} onValueChange={setFilterSymbol}>
              <SelectTrigger className="h-8 w-full md:w-[130px] text-xs">
                <SelectValue placeholder="Symbol" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">All Symbols</SelectItem>
                {SYMBOLS_LIST.map((s) => (
                  <SelectItem key={s} value={s} className="text-xs">{SYMBOL_DISPLAY[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Mood Filter */}
            <Select value={filterMood} onValueChange={setFilterMood}>
              <SelectTrigger className="h-8 w-full md:w-[120px] text-xs">
                <SelectValue placeholder="Mood" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">All Moods</SelectItem>
                {(Object.keys(MOOD_CONFIG) as Array<JournalEntry['mood']>).map((m) => (
                  <SelectItem key={m} value={m} className="text-xs">
                    {MOOD_CONFIG[m].emoji} {MOOD_CONFIG[m].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Strategy Filter */}
            <Select value={filterStrategy} onValueChange={setFilterStrategy}>
              <SelectTrigger className="h-8 w-full md:w-[150px] text-xs">
                <SelectValue placeholder="Strategy" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">All Strategies</SelectItem>
                {allStrategies.map((s) => (
                  <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Sort Options + Clear */}
          <div className="flex items-center justify-between mt-2.5 pt-2.5 border-t border-border/50">
            <div className="flex items-center gap-1">
              <Filter className="h-3 w-3 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground mr-1">Sort:</span>
              {([['date', 'Date'], ['pnl', 'P&L'], ['pips', 'Pips'], ['rating', 'Rating']] as const).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => handleToggleSort(key)}
                  className={`text-[10px] px-2 py-0.5 rounded-md transition-colors
                    ${sortBy === key
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent'}`}
                >
                  {label}
                  {sortBy === key && (
                    <span className="ml-0.5">{sortDir === 'desc' ? '↓' : '↑'}</span>
                  )}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              {hasActiveFilters && (
                <button
                  onClick={() => { setSearchQuery(''); setFilterSymbol('all'); setFilterMood('all'); setFilterStrategy('all'); }}
                  className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                >
                  Clear filters
                </button>
              )}
              <span className="text-[10px] text-muted-foreground">
                {filteredEntries.length} {filteredEntries.length === 1 ? 'entry' : 'entries'}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Journal Entries List */}
      <div className="space-y-3 stagger-children">
        {filteredEntries.length === 0 ? (
          <div className="glass-card rounded-lg p-12 text-center">
            <BookOpen className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <h3 className="text-sm font-medium text-muted-foreground mb-1">
              {hasActiveFilters ? 'No matching entries' : 'No journal entries yet'}
            </h3>
            <p className="text-xs text-muted-foreground">
              {hasActiveFilters
                ? 'Try adjusting your filters to find what you\'re looking for.'
                : 'Start documenting your trades to build a trading diary and improve your performance.'}
            </p>
            {!hasActiveFilters && (
              <Button
                size="sm"
                className="mt-4 h-8 text-xs gap-1.5"
                onClick={() => setDialogOpen(true)}
              >
                <Plus className="h-3.5 w-3.5" />
                Add First Entry
              </Button>
            )}
          </div>
        ) : (
          filteredEntries.map((entry, i) => (
            <JournalEntryCard
              key={entry.id}
              entry={entry}
              index={i}
              onEdit={handleEdit}
              onDelete={(id) => setDeleteConfirm(id)}
            />
          ))
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm">Delete Journal Entry</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            Are you sure you want to delete this journal entry? This action cannot be undone.
          </p>
          <div className="flex gap-2 mt-3">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 h-8 text-xs"
              onClick={() => setDeleteConfirm(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              className="flex-1 h-8 text-xs"
              onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
            >
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
