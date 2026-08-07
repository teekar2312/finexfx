'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import {
  Calendar,
  Clock,
  Filter,
  Zap,
  TrendingUp,
  ArrowUp,
  ArrowDown,
  Minus,
  AlertTriangle,
  Activity,
} from 'lucide-react';

// ---------- Types ----------

type Currency = 'USD' | 'EUR' | 'GBP' | 'JPY';
type Impact = 'High' | 'Medium' | 'Low';

type EconomicEvent = {
  id: string;
  date: Date;
  timeUTC: string;
  currency: Currency;
  name: string;
  impact: Impact;
  previous: string;
  forecast: string;
  actual: string | null;
};

type DayGroup = { label: string; dateStr: string; events: EconomicEvent[] };
type FilterKey = 'All' | 'High Impact' | Currency;

// ---------- Helpers ----------

function getCurrencyColor(c: Currency) {
  const map: Record<Currency, { bg: string; text: string }> = {
    USD: { bg: 'bg-blue-500/20', text: 'text-blue-400' },
    EUR: { bg: 'bg-amber-500/20', text: 'text-amber-400' },
    GBP: { bg: 'bg-violet-500/20', text: 'text-violet-400' },
    JPY: { bg: 'bg-rose-500/20', text: 'text-rose-400' },
  };
  return map[c];
}

function getImpactBadge(impact: Impact) {
  const map: Record<Impact, string> = {
    High: 'bg-red-500/20 text-red-400 border-red-500/30 badge-glow-red',
    Medium: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    Low: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  };
  return map[impact];
}

function parseVal(s: string): number {
  const cleaned = s.replace(/[%,KMB]/g, '');
  return parseFloat(cleaned) || 0;
}

function formatVal(s: string): string {
  return s;
}

// ---------- Mock Data Generator ----------

function generateEvents(): EconomicEvent[] {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dayOfWeek = today.getDay(); // 0=Sun

  // Build dates for this week (Mon-Sun)
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(today);
  monday.setDate(today.getDate() + mondayOffset);

  const dates: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    dates.push(d);
  }

  // Only keep today through end of week
  const futureDates = dates.filter(
    (d) => d >= new Date(today.getFullYear(), today.getMonth(), today.getDate())
  );

  // Raw event templates: [dayOffset from 0 (today), hourUTC, minuteUTC, currency, name, impact, previous, forecast, actual]
  const templates: [number, number, number, Currency, string, Impact, string, string, string | null][] = [
    // Today
    [0, 1, 30, 'JPY', 'Japan Monetary Policy Statement', 'High', '0.10%', '0.10%', null],
    [0, 2, 0, 'EUR', 'French Flash Services PMI', 'Medium', '49.3', '49.8', '50.1'],
    [0, 3, 30, 'GBP', 'UK Construction PMI', 'Medium', '52.6', '52.2', '51.8'],
    [0, 4, 30, 'USD', 'ADP Non-Farm Employment', 'High', '122K', '115K', null],
    [0, 6, 0, 'EUR', 'Eurozone GDP (QoQ) Flash', 'High', '0.3%', '0.2%', '0.1%'],
    [0, 8, 15, 'USD', 'ISM Services PMI', 'High', '51.4', '50.8', null],
    [0, 8, 30, 'USD', 'JOLTS Job Openings', 'Medium', '8.056M', '7.900M', null],
    [0, 10, 0, 'GBP', 'BoC Rate Decision', 'High', '4.50%', '4.25%', '4.25%'],
    // Tomorrow
    [1, 0, 0, 'JPY', 'Japan Household Spending (YoY)', 'Low', '-1.2%', '-0.8%', null],
    [1, 1, 30, 'EUR', 'German Industrial Production (MoM)', 'Medium', '-0.4%', '0.2%', null],
    [1, 4, 30, 'USD', 'Initial Jobless Claims', 'Medium', '221K', '218K', null],
    [1, 5, 0, 'EUR', 'ECB Main Refinancing Rate', 'High', '3.65%', '3.50%', null],
    [1, 5, 45, 'EUR', 'ECB Press Conference', 'High', '-', '-', null],
    [1, 8, 30, 'USD', 'Trade Balance', 'Medium', '-$68.3B', '-$67.1B', null],
    [1, 10, 0, 'GBP', 'UK GDP (QoQ) Preliminary', 'High', '0.1%', '0.2%', null],
    // Later this week
    [2, 1, 50, 'JPY', 'Japan Current Account', 'Low', '¥2.77T', '¥2.50T', null],
    [2, 4, 30, 'USD', 'Core CPI (MoM)', 'High', '0.3%', '0.2%', null],
    [2, 5, 0, 'EUR', 'German ZEW Economic Sentiment', 'Medium', '15.7', '18.0', null],
    [3, 1, 30, 'JPY', 'Japan Machine Orders (MoM)', 'Low', '-3.1%', '1.5%', null],
    [3, 3, 0, 'EUR', 'French CPI (MoM) Flash', 'Medium', '0.2%', '0.1%', null],
    [3, 8, 30, 'USD', 'FOMC Meeting Minutes', 'High', '-', '-', null],
    [4, 1, 30, 'JPY', 'Japan PPI (YoY)', 'Medium', '2.8%', '2.5%', null],
    [4, 4, 30, 'USD', 'Retail Sales (MoM)', 'High', '0.4%', '0.3%', null],
    [4, 6, 0, 'GBP', 'UK Employment Change', 'High', '31K', '25K', null],
    [4, 8, 30, 'USD', 'Michigan Consumer Sentiment', 'High', '74.0', '72.5', null],
  ];

  const events: EconomicEvent[] = templates.map((t, i) => {
    const [dayOff, h, m, currency, name, impact, previous, forecast, actual] = t;
    const eventDate = new Date(futureDates[0]);
    eventDate.setDate(futureDates[0].getDate() + dayOff);
    eventDate.setUTCHours(h, m, 0, 0);

    const hh = String(h).padStart(2, '0');
    const mm = String(m).padStart(2, '0');

    return {
      id: `evt-${i}`,
      date: eventDate,
      timeUTC: `${hh}:${mm}`,
      currency,
      name,
      impact,
      previous,
      forecast,
      actual,
    };
  });

  // Sort chronologically
  events.sort((a, b) => a.date.getTime() - b.date.getTime());
   return events;
}

// ---------- Mini Value Bar ----------

function ValueBar({
  previous,
  forecast,
  actual,
}: {
  previous: string;
  forecast: string;
  actual: string | null;
}) {
  const vals = [parseVal(previous), parseVal(forecast)];
  if (actual !== null) vals.push(parseVal(actual));
  const maxAbs = Math.max(...vals.map(Math.abs), 0.01);

  const normPrev = (parseVal(previous) / maxAbs) * 50;
  const normFore = (parseVal(forecast) / maxAbs) * 50;
  const normAct = actual !== null ? (parseVal(actual) / maxAbs) * 50 : 0;

  // Determine direction of actual vs forecast
  let dir: 'up' | 'down' | 'neutral' = 'neutral';
  if (actual !== null) {
    const diff = parseVal(actual) - parseVal(forecast);
    if (diff > 0.001) dir = 'up';
    else if (diff < -0.001) dir = 'down';
  }

  const DirIcon = dir === 'up' ? ArrowUp : dir === 'down' ? ArrowDown : Minus;
  const dirColor =
    dir === 'up'
      ? 'text-emerald-400'
      : dir === 'down'
        ? 'text-red-400'
        : 'text-muted-foreground';

  return (
    <div className="flex items-center gap-1.5 w-full">
      <div className="relative w-full h-3 rounded-full bg-white/5 overflow-hidden">
        {/* Previous bar */}
        <div
          className="absolute top-0 left-1/2 h-full w-px bg-muted-foreground/30"
          style={{ left: '50%' }}
        />
        <motion.div
          initial={{ width: 0 }}
          animate={{
            width: `${Math.abs(normPrev)}%`,
            left: normPrev >= 0 ? '50%' : `${50 + normPrev}%`,
          }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="absolute top-0.5 h-2 rounded-sm bg-muted-foreground/30"
        />
        {/* Forecast bar */}
        <motion.div
          initial={{ width: 0 }}
          animate={{
            width: `${Math.abs(normFore)}%`,
            left: normFore >= 0 ? '50%' : `${50 + normFore}%`,
          }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="absolute top-0.5 h-2 rounded-sm bg-amber-500/40"
        />
        {/* Actual bar */}
        {actual !== null && (
          <motion.div
            initial={{ width: 0 }}
            animate={{
              width: `${Math.abs(normAct)}%`,
              left: normAct >= 0 ? '50%' : `${50 + normAct}%`,
            }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className={`absolute top-0.5 h-2 rounded-sm ${dir === 'up' ? 'bg-emerald-500/50' : dir === 'down' ? 'bg-red-500/50' : 'bg-blue-500/50'}`}
          />
        )}
      </div>
      {actual !== null && (
        <DirIcon className={`h-3 w-3 shrink-0 ${dirColor}`} />
      )}
    </div>
  );
}

// ---------- Countdown Timer ----------

function CountdownTimer({ targetDate }: { targetDate: Date | null }) {
  const [diff, setDiff] = useState(0);

  useEffect(() => {
    if (!targetDate) return;
    const tick = () => {
      const now = Date.now();
      setDiff(Math.max(0, targetDate.getTime() - now));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetDate]);

  if (!targetDate || diff <= 0) return null;

  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);

  return (
    <span className="font-mono text-emerald-400 text-xs tabular-nums tracking-wider">
      {String(h).padStart(2, '0')}:{String(m).padStart(2, '0')}:{String(s).padStart(2, '0')}
    </span>
  );
}

// ---------- Event Row ----------

function EventRow({ event, now }: { event: EconomicEvent; now: Date }) {
  const msUntil = event.date.getTime() - now.getTime();
  const isUpcoming = msUntil > 0 && msUntil <= 30 * 60 * 1000;
  const isPast = msUntil <= 0;
  const { bg: currBg, text: currText } = getCurrencyColor(event.currency);

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.25 }}
      className={`relative flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors hover:bg-white/5 ${isUpcoming ? 'ring-1 ring-red-500/20' : ''}`}
    >
      {/* Pulse dot for upcoming high-impact */}
      {isUpcoming && event.impact === 'High' && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1 w-2 h-2 rounded-full bg-red-500">
          <span className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-75" />
        </span>
      )}

      {/* Time */}
      <div className="w-12 text-xs tabular-nums text-muted-foreground shrink-0">
        {event.timeUTC}
      </div>

      {/* Currency badge */}
      <div
        className={`w-10 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${currBg} ${currText}`}
      >
        {event.currency}
      </div>

      {/* Event name */}
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium text-foreground truncate">
          {event.name}
        </div>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[10px] text-muted-foreground">
            Prev: <span className="tabular-nums">{formatVal(event.previous)}</span>
          </span>
          <span className="text-[10px] text-amber-400/80">
            Fore: <span className="tabular-nums">{formatVal(event.forecast)}</span>
          </span>
          <span
            className={`text-[10px] tabular-nums ${event.actual !== null ? (parseVal(event.actual) > parseVal(event.forecast) ? 'neon-text-emerald' : parseVal(event.actual) < parseVal(event.forecast) ? 'neon-text-red' : 'text-blue-400') : 'text-muted-foreground/50'}`}
          >
            Act: {event.actual ?? 'Pending'}
          </span>
        </div>
        {/* Mini value comparison bar */}
        <div className="mt-1.5 w-full max-w-[180px]">
          <ValueBar
            previous={event.previous}
            forecast={event.forecast}
            actual={event.actual}
          />
        </div>
      </div>

      {/* Impact badge */}
      <Badge
        variant="outline"
        className={`rounded-full text-[10px] font-bold uppercase border px-2 py-0 ${getImpactBadge(event.impact)}`}
      >
        {event.impact === 'High' && <Zap className="h-2.5 w-2.5 mr-1" />}
        {event.impact}
      </Badge>

      {/* Countdown or released */}
      <div className="w-20 text-right shrink-0">
        {isPast ? (
          <span className="text-[10px] text-muted-foreground/60">Released</span>
        ) : (
          <CountdownTimer targetDate={event.date} />
        )}
      </div>
    </motion.div>
  );
}

// ---------- Main Component ----------

const FILTERS: FilterKey[] = ['All', 'High Impact', 'USD', 'EUR', 'GBP', 'JPY'];

export default function EconomicCalendar() {
  const [filter, setFilter] = useState<FilterKey>('All');
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const events = useMemo(() => generateEvents(), []);

  const filtered = useMemo(() => {
    if (filter === 'All') return events;
    if (filter === 'High Impact') return events.filter((e) => e.impact === 'High');
    return events.filter((e) => e.currency === filter);
  }, [events, filter]);

  // Group by day
  const groups = useMemo(() => {
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const dayAfterTomorrow = new Date(today);
    dayAfterTomorrow.setDate(today.getDate() + 2);

    const map = new Map<string, DayGroup>();

    for (const evt of filtered) {
      const evtDay = new Date(
        evt.date.getFullYear(),
        evt.date.getMonth(),
        evt.date.getDate()
      );

      let label: string;
      const dateStr = evtDay.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });

      if (evtDay.getTime() === today.getTime()) {
        label = 'Today';
      } else if (evtDay.getTime() === tomorrow.getTime()) {
        label = 'Tomorrow';
      } else {
        label = dateStr;
      }

      const key = evtDay.toISOString();
      if (!map.has(key)) {
        map.set(key, { label, dateStr, events: [] });
      }
      map.get(key)!.events.push(evt);
    }

    return Array.from(map.values());
  }, [filtered, now]);

  // Next high-impact event
  const nextHighImpact = useMemo(() => {
    return events.find(
      (e) => e.impact === 'High' && e.date.getTime() > now.getTime()
    );
  }, [events, now]);

  const filterIcon = (f: FilterKey) => {
    switch (f) {
      case 'All':
        return <Filter className="h-3 w-3" />;
      case 'High Impact':
        return <Zap className="h-3 w-3" />;
      default:
        return <Activity className="h-3 w-3" />;
    }
  };

  return (
    <div className="glass-card-premium rounded-xl card-hover-lift border-white/[0.06] overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3 pb-3 px-4 pt-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <Calendar className="h-4 w-4 text-emerald-400" />
            </div>
            <div>
              <span className="text-sm font-semibold text-foreground leading-tight section-title-accent">
                Economic Calendar
              </span>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {events.length} events this week · All times in UTC
              </p>
            </div>
          </div>

          {/* Next high-impact countdown */}
          {nextHighImpact && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20">
              <Zap className="h-3.5 w-3.5 text-red-400 animate-pulse" />
              <div className="flex flex-col">
                <span className="text-[9px] text-red-400/80 font-medium leading-none">
                  Next High Impact
                </span>
                <span className="text-[10px] text-red-300 font-medium leading-tight mt-0.5">
                  {nextHighImpact.name}
                </span>
              </div>
              <CountdownTimer targetDate={nextHighImpact.date} />
            </div>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="px-4 pb-3">
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <Button
              key={f}
              variant={filter === f ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setFilter(f)}
              className={`h-7 px-2.5 text-[11px] font-medium rounded-md transition-all ${filter === f ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 hover:text-emerald-300 shadow-none' : 'text-muted-foreground hover:text-foreground hover:bg-white/5'}`}
            >
              {filterIcon(f)}
              {f}
            </Button>
          ))}
        </div>
      </div>

      <div className="px-2 pb-3">
        <div className="max-h-[520px] overflow-y-auto custom-scrollbar">
          <AnimatePresence mode="popLayout">
            {groups.map((group) => (
              <motion.div
                key={group.label}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.3 }}
                className="mb-3 last:mb-0"
              >
                {/* Day header */}
                <div className="flex items-center gap-2 px-3 mb-1.5">
                  <Clock className="h-3 w-3 text-muted-foreground" />
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                    {group.label}
                  </span>
                  <span className="text-[10px] text-muted-foreground/50">
                    {group.events.length} events
                  </span>
                  <div className="flex-1 h-px bg-white/5" />
                </div>

                {/* Event rows */}
                <div className="space-y-0.5">
                  {group.events.map((evt) => (
                    <EventRow key={evt.id} event={evt} now={now} />
                  ))}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <AlertTriangle className="h-8 w-8 mb-2 opacity-40" />
              <span className="text-xs">No events match the selected filter</span>
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 mt-3 px-3 pt-3 border-t border-white/5">
          <span className="text-[10px] text-muted-foreground">Legend:</span>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-muted-foreground/30" />
            <span className="text-[10px] text-muted-foreground">Prev</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-amber-500/50" />
            <span className="text-[10px] text-muted-foreground">Forecast</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-emerald-500/50" />
            <span className="text-[10px] text-muted-foreground">Actual</span>
          </div>
          <div className="ml-auto flex items-center gap-1 text-[10px] text-muted-foreground/50">
            <TrendingUp className="h-3 w-3" />
            Powered by ForexPro
          </div>
        </div>
      </div>
    </div>
  );
}
