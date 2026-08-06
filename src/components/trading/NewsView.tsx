'use client';

import { useState, useMemo, useEffect } from 'react';
import { useTradingStore } from '@/store/trading-store';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { motion, AnimatePresence } from 'framer-motion';
import { Newspaper, AlertTriangle, Clock, Globe, Filter, X, Radio, ArrowUpRight, ArrowDownRight, Minus, Flame, TrendingUp, Building2, BarChart3, Landmark, Percent } from 'lucide-react';
import EconomicCalendar from './EconomicCalendar';

const MOCK_NEWS: Array<{
  id: string;
  source: string;
  title: string;
  summary: string;
  category: string;
  impact: 'high' | 'medium' | 'low';
  currency: string;
  publishedAt: string;
}> = [
  { id: 'n1', source: 'Reuters', title: 'ECB Holds Rates Steady, Signals Potential Cut in September', summary: 'The European Central Bank kept interest rates unchanged at 3.75% but hinted at possible rate reductions in the coming months as inflation continues to ease toward the 2% target.', category: 'Central Bank', impact: 'high', currency: 'EUR', publishedAt: new Date(Date.now() - 3600000).toISOString() },
  { id: 'n2', source: 'Bloomberg', title: 'US Non-Farm Payrolls Beat Expectations at 215K', summary: 'The US labor market showed resilience with NFP coming in at 215K versus the expected 180K, suggesting the Federal Reserve may maintain its current monetary policy stance.', category: 'Employment', impact: 'high', currency: 'USD', publishedAt: new Date(Date.now() - 7200000).toISOString() },
  { id: 'n3', source: 'FX Street', title: 'GBPUSD Breaks Above 1.2700 Resistance Level', summary: 'Cable surged past the key 1.2700 resistance level as dollar weakness and UK economic data support further upside potential.', category: 'Technical', impact: 'medium', currency: 'GBP', publishedAt: new Date(Date.now() - 10800000).toISOString() },
  { id: 'n4', source: 'MarketWatch', title: 'Gold Prices Rally Amid Geopolitical Tensions', summary: 'XAUUSD rose to new weekly highs as escalating geopolitical tensions in the Middle East drove safe-haven demand.', category: 'Commodities', impact: 'high', currency: 'XAU', publishedAt: new Date(Date.now() - 14400000).toISOString() },
  { id: 'n5', source: 'CNBC', title: 'Japan Yen Weakens Past 155 Level', summary: 'USDJPY extended gains beyond 155 as the Bank of Japan maintained its ultra-loose monetary policy despite government pressure.', category: 'Central Bank', impact: 'medium', currency: 'JPY', publishedAt: new Date(Date.now() - 18000000).toISOString() },
  { id: 'n6', source: 'Financial Times', title: 'US CPI Data Shows Inflation Cooling to 2.5%', summary: 'Consumer prices in the US rose 2.5% year-over-year in the latest reading, down from 2.9%, supporting expectations for Fed rate cuts.', category: 'Inflation', impact: 'high', currency: 'USD', publishedAt: new Date(Date.now() - 21600000).toISOString() },
  { id: 'n7', source: 'Reuters', title: 'UK GDP Growth Exceeds Forecasts at 0.4% QoQ', summary: 'The UK economy grew 0.4% quarter-over-quarter, beating the 0.2% forecast, driven by strong services sector performance.', category: 'GDP', impact: 'medium', currency: 'GBP', publishedAt: new Date(Date.now() - 25200000).toISOString() },
  { id: 'n8', source: 'Bloomberg', title: 'Eurozone PMI Indicates Manufacturing Recovery', summary: 'The eurozone manufacturing PMI rose to 48.5 from 47.3, suggesting the sector may be nearing a return to expansion territory.', category: 'Economic', impact: 'low', currency: 'EUR', publishedAt: new Date(Date.now() - 28800000).toISOString() },
  // Additional breaking news for marquee
  { id: 'n9', source: 'CNBC', title: 'Federal Reserve Officials Signal Cautious Approach to Rate Cuts', summary: 'Multiple Fed governors expressed a preference for waiting on more data before adjusting rates, pushing market expectations for cuts further into the year.', category: 'Central Bank', impact: 'high', currency: 'USD', publishedAt: new Date(Date.now() - 1800000).toISOString() },
  { id: 'n10', source: 'Reuters', title: 'Oil Prices Surge on OPEC+ Production Cut Extension', summary: 'Brent crude jumped 3% after OPEC+ members agreed to extend production cuts through Q3, raising inflation concerns across currency markets.', category: 'Commodities', impact: 'high', currency: 'USD', publishedAt: new Date(Date.now() - 900000).toISOString() },
];

const MOCK_EVENTS: Array<{
  id: string;
  event: string;
  currency: string;
  impact: 'high' | 'medium' | 'low';
  actual: string;
  forecast: string;
  previous: string;
  date: string;
}> = [
  { id: 'e1', event: 'Non-Farm Payrolls', currency: 'USD', impact: 'high', actual: '215K', forecast: '180K', previous: '187K', date: '2025-01-10 13:30' },
  { id: 'e2', event: 'ECB Interest Rate Decision', currency: 'EUR', impact: 'high', actual: '3.75%', forecast: '3.75%', previous: '3.75%', date: '2025-01-10 12:45' },
  { id: 'e3', event: 'CPI YoY', currency: 'USD', impact: 'high', actual: '2.5%', forecast: '2.6%', previous: '2.9%', date: '2025-01-10 08:30' },
  { id: 'e4', event: 'UK GDP QoQ', currency: 'GBP', impact: 'medium', actual: '0.4%', forecast: '0.2%', previous: '0.1%', date: '2025-01-10 07:00' },
  { id: 'e5', event: 'Japan GDP QoQ', currency: 'JPY', impact: 'medium', actual: '0.1%', forecast: '0.2%', previous: '-0.7%', date: '2025-01-10 00:50' },
  { id: 'e6', event: 'Unemployment Claims', currency: 'USD', impact: 'medium', actual: '201K', forecast: '215K', previous: '210K', date: '2025-01-09 13:30' },
  { id: 'e7', event: 'Eurozone PMI Manufacturing', currency: 'EUR', impact: 'low', actual: '48.5', forecast: '47.8', previous: '47.3', date: '2025-01-09 09:00' },
  { id: 'e8', event: 'BoJ Policy Statement', currency: 'JPY', impact: 'high', actual: '-0.10%', forecast: '-0.10%', previous: '-0.10%', date: '2025-01-09 03:00' },
  { id: 'e9', event: 'UK Retail Sales MoM', currency: 'GBP', impact: 'low', actual: '0.3%', forecast: '0.2%', previous: '-0.1%', date: '2025-01-09 07:00' },
  { id: 'e10', event: 'US ISM Services PMI', currency: 'USD', impact: 'high', actual: '54.1', forecast: '52.5', previous: '52.7', date: '2025-01-08 15:00' },
];

function ImpactDots({ impact }: { impact: 'high' | 'medium' | 'low' }) {
  const count = impact === 'high' ? 3 : impact === 'medium' ? 2 : 1;
  const color = impact === 'high' ? 'bg-red-500' : impact === 'medium' ? 'bg-amber-500' : 'bg-green-500';
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className={`w-1.5 h-1.5 rounded-full ${i < count ? color : 'bg-slate-700'}`} />
      ))}
    </div>
  );
}

function getActualVsForecast(actual: string, forecast: string): 'better' | 'worse' | 'same' {
  const a = parseFloat(actual.replace('%', '').replace('K', ''));
  const f = parseFloat(forecast.replace('%', '').replace('K', ''));
  if (isNaN(a) || isNaN(f)) return 'same';
  if (a > f) return 'better';
  if (a < f) return 'worse';
  return 'same';
}

function getActualColor(actual: string, forecast: string): string {
  const comparison = getActualVsForecast(actual, forecast);
  return comparison === 'better' ? 'text-emerald-500' : comparison === 'worse' ? 'text-red-500' : 'text-foreground';
}

function ActualVsForecastArrow({ actual, forecast }: { actual: string; forecast: string }) {
  const comparison = getActualVsForecast(actual, forecast);
  if (comparison === 'better') return <ArrowUpRight className="h-3 w-3 text-emerald-500" />;
  if (comparison === 'worse') return <ArrowDownRight className="h-3 w-3 text-red-500" />;
  return <Minus className="h-3 w-3 text-slate-500" />;
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.floor((now - then) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function getCategoryIcon(category: string) {
  switch (category) {
    case 'Central Bank': return <Landmark className="h-3 w-3 text-violet-400" />;
    case 'Employment': return <Building2 className="h-3 w-3 text-cyan-400" />;
    case 'Technical': return <BarChart3 className="h-3 w-3 text-amber-400" />;
    case 'Commodities': return <Flame className="h-3 w-3 text-orange-400" />;
    case 'Inflation': return <Percent className="h-3 w-3 text-red-400" />;
    case 'GDP': return <TrendingUp className="h-3 w-3 text-emerald-400" />;
    case 'Economic': return <Globe className="h-3 w-3 text-blue-400" />;
    default: return <Newspaper className="h-3 w-3 text-slate-400" />;
  }
}

function getCategoryColor(category: string): string {
  switch (category) {
    case 'Central Bank': return 'border-violet-500/30 text-violet-400 bg-violet-500/10';
    case 'Employment': return 'border-cyan-500/30 text-cyan-400 bg-cyan-500/10';
    case 'Technical': return 'border-amber-500/30 text-amber-400 bg-amber-500/10';
    case 'Commodities': return 'border-orange-500/30 text-orange-400 bg-orange-500/10';
    case 'Inflation': return 'border-red-500/30 text-red-400 bg-red-500/10';
    case 'GDP': return 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10';
    case 'Economic': return 'border-blue-500/30 text-blue-400 bg-blue-500/10';
    default: return 'border-slate-500/30 text-slate-400 bg-slate-500/10';
  }
}

function getReadingTime(text: string): string {
  const words = text.split(/\s+/).length;
  const minutes = Math.max(1, Math.ceil(words / 200));
  return `${minutes} min read`;
}

function SourceCircle({ source }: { source: string }) {
  const colors: Record<string, string> = {
    'Reuters': 'bg-orange-500',
    'Bloomberg': 'bg-blue-500',
    'FX Street': 'bg-emerald-500',
    'MarketWatch': 'bg-violet-500',
    'CNBC': 'bg-cyan-500',
    'Financial Times': 'bg-pink-500',
  };
  const bgColor = colors[source] || 'bg-slate-500';
  return (
    <div className={`w-6 h-6 rounded-full ${bgColor} flex items-center justify-center flex-shrink-0 ring-2 ring-white/10`}>
      <span className="text-[9px] font-bold text-white">{source.charAt(0)}</span>
    </div>
  );
}

export default function NewsView() {
  const { newsItems } = useTradingStore();
  const allNews = newsItems.length > 0 ? newsItems : MOCK_NEWS;
  const [currencyFilter, setCurrencyFilter] = useState<string>('all');
  const [impactFilter, setImpactFilter] = useState<string>('all');
  const [showBreaking, setShowBreaking] = useState(true);
  const [marqueeIndex, setMarqueeIndex] = useState(0);

  const filteredNews = allNews.filter(n => {
    if (currencyFilter !== 'all' && n.currency !== currencyFilter) return false;
    if (impactFilter !== 'all' && n.impact !== impactFilter) return false;
    return true;
  });

  const filteredEvents = MOCK_EVENTS.filter(e => {
    if (currencyFilter !== 'all' && e.currency !== currencyFilter) return false;
    if (impactFilter !== 'all' && e.impact !== impactFilter) return false;
    return true;
  });

  const breakingNews = allNews.filter(n => n.impact === 'high');

  // Currency strength summary: count high-impact events per currency
  const currencyStrength = useMemo(() => {
    const counts: Record<string, number> = {};
    MOCK_EVENTS.filter(e => e.impact === 'high').forEach(e => {
      counts[e.currency] = (counts[e.currency] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, []);

  // Auto-rotate marquee
  useEffect(() => {
    if (breakingNews.length <= 1) return;
    const interval = setInterval(() => {
      setMarqueeIndex(prev => (prev + 1) % breakingNews.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [breakingNews.length]);

  const currentBreaking = breakingNews[marqueeIndex % breakingNews.length];

  return (
    <div className="p-4 space-y-4">
      {/* Enhanced Breaking News Banner with marquee, pulsing dot, timestamp */}
      <AnimatePresence>
        {showBreaking && breakingNews.length > 0 && currentBreaking && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="relative overflow-hidden rounded-lg bg-red-500/10 border border-red-500/30 shimmer-border-red"
          >
            {/* CSS animations for marquee and pulse */}
            <style dangerouslySetInnerHTML={{ __html: `
              @keyframes pulse-dot {
                0%, 100% { opacity: 1; transform: scale(1); }
                50% { opacity: 0.3; transform: scale(0.8); }
              }
              .pulse-dot-anim {
                animation: pulse-dot 1.5s ease-in-out infinite;
              }
            ` }} />
            <div className="flex items-center gap-3 p-3">
              <div className="flex items-center gap-2 flex-shrink-0">
                {/* Pulsing red dot */}
                <div className="relative">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500 pulse-dot-anim" />
                </div>
                <Badge className="badge-glow-red bg-red-500 text-white text-[10px] px-2.5 py-0 font-bold flex items-center gap-1 time-fade">
                  <Radio className="h-2.5 w-2.5" />
                  BREAKING
                </Badge>
              </div>
              <div className="flex-1 min-w-0 overflow-hidden relative">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentBreaking.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.3 }}
                    className="flex items-center gap-3"
                  >
                    <span className="text-sm font-medium text-red-400 truncate block flex-1">{currentBreaking.title}</span>
                    {currentBreaking.publishedAt && (
                      <span className="text-[10px] text-red-500/60 flex-shrink-0 flex items-center gap-1">
                        <Clock className="h-2.5 w-2.5" />
                        {timeAgo(currentBreaking.publishedAt)}
                      </span>
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>
              {/* Indicator dots for multiple breaking news */}
              {breakingNews.length > 1 && (
                <div className="flex items-center gap-1 flex-shrink-0">
                  {breakingNews.map((_, i) => (
                    <div
                      key={i}
                      className={`w-1.5 h-1.5 rounded-full transition-colors ${
                        i === marqueeIndex % breakingNews.length ? 'bg-red-500' : 'bg-red-500/30'
                      }`}
                    />
                  ))}
                </div>
              )}
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground flex-shrink-0" onClick={() => setShowBreaking(false)}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Filters:</span>
        </div>
        <Select value={currencyFilter} onValueChange={setCurrencyFilter}>
          <SelectTrigger className="w-[100px] h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="EUR">EUR</SelectItem>
            <SelectItem value="USD">USD</SelectItem>
            <SelectItem value="GBP">GBP</SelectItem>
            <SelectItem value="JPY">JPY</SelectItem>
          </SelectContent>
        </Select>
        <div className="tab-pill-group">
          {['all', 'high', 'medium', 'low'].map((val) => (
            <button
              key={val}
              onClick={() => setImpactFilter(val)}
              className={`text-[11px] ${impactFilter === val ? 'tab-pill-active' : 'tab-pill'}`}
            >
              {val === 'all' ? 'All Impact' : val.charAt(0).toUpperCase() + val.slice(1)}
            </button>
          ))}
        </div>
        <div className="flex-1" />
        <span className="text-[10px] text-muted-foreground">{filteredNews.length} articles • {filteredEvents.length} events</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 stagger-children">
        {/* News Feed - Enhanced */}
        <div className="glass-card-premium rounded-xl card-hover-lift">
          <div className="flex items-center gap-2 mb-3 pb-2 pt-3 px-4">
            <div className="flex items-center gap-2">
              <Newspaper className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold section-title-accent">News Feed</span>
            </div>
          </div>
          <div className="px-4 pb-3">
            <ScrollArea className="h-[600px]">
              <div className="space-y-3 stagger-children">
                {filteredNews.map((news, i) => {
                  const isNew = news.publishedAt ? (Date.now() - new Date(news.publishedAt).getTime()) < 1800000 : false;
                  const summary = (news as any).summary || '';
                  const isFirst = i === 0;
                  return (
                    <motion.div
                      key={news.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.03 }}
                      className={`p-3 rounded-lg border transition-all transition-colors duration-200 border-l-2 hover:bg-accent/30 group card-hover ${isFirst ? 'shimmer-border ' : ''}
                        news.impact === 'high' ? 'border-l-red-500/50 border-red-500/20 hover:border-l-red-400 hover:shadow-[0_0_12px_rgba(239,68,68,0.1)]' :
                        news.impact === 'medium' ? 'border-l-amber-500/40 border-amber-500/20 hover:border-l-amber-400 hover:shadow-[0_0_12px_rgba(245,158,11,0.1)]' :
                        'border-l-slate-500 border-border hover:border-l-slate-400'
                      }`}
                    >
                      <div className="flex items-start gap-2 mb-1.5">
                        {/* Source logo circle */}
                        <SourceCircle source={(news as any).source || 'News'} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <h4 className={`font-semibold leading-tight ${news.impact === 'high' ? 'text-sm' : 'text-xs'}`}>{news.title}</h4>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              {isNew && (
                                <Badge className="badge-glow-red bg-red-500 text-white text-[8px] px-1 py-0 font-bold">
                                  NEW
                                </Badge>
                              )}
                              <ImpactDots impact={news.impact} />
                            </div>
                          </div>
                        </div>
                      </div>
                      {summary && (
                        <p className="text-[11px] text-muted-foreground mb-2 line-clamp-2 pl-7">{summary}</p>
                      )}
                      <div className="flex items-center justify-between pl-7">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[9px] px-1.5 py-0">{news.currency}</Badge>
                          {(news as any).category && (
                            <Badge variant="outline" className={`rounded-full px-2 py-0.5 text-[9px] font-medium tracking-wide uppercase flex items-center gap-1 ${getCategoryColor((news as any).category)}`}>
                              {getCategoryIcon((news as any).category)}
                              {(news as any).category}
                            </Badge>
                          )}
                          {/* Reading time */}
                          {summary && (
                            <span className="text-[9px] text-muted-foreground">{getReadingTime(summary)}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                          <Badge variant="outline" className={`${(news as any).source === 'Reuters' ? 'badge-glow-emerald' : (news as any).source === 'Bloomberg' ? 'badge-glow-amber' : ''} text-[9px] px-1.5 py-0`}>{(news as any).source || 'News'}</Badge>
                          <span>•</span>
                          <div className="flex items-center gap-1">
                            <Clock className="h-2.5 w-2.5" />
                            {timeAgo(news.publishedAt || '')}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
                {filteredNews.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    No news matching filters
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        </div>

        {/* Economic Calendar - Enhanced with timeline, color-coded actual vs forecast */}
        <div className="glass-card-premium rounded-xl card-hover-lift">
          <div className="flex items-center gap-2 mb-3 pb-2 pt-3 px-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold section-title-accent">Economic Calendar</span>
              </div>
              {/* Currency Strength summary */}
              <div className="flex items-center gap-2 elevated-card px-2 py-1 rounded-lg">
                <Flame className="h-3 w-3 text-red-500" />
                <div className="flex items-center gap-1.5">
                  {currencyStrength.slice(0, 4).map(([currency, count]) => (
                    <TooltipProvider key={currency} delayDuration={100}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge variant="outline" className="text-[9px] px-1.5 py-0 cursor-default border-red-500/20 text-red-400 hover:bg-red-500/10">
                            {currency} <span className="font-bold">{count}</span>
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent>
                          <span className="text-[10px]">{count} high-impact {currency} event{count > 1 ? 's' : ''} today</span>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div className="px-4 pb-3">
            <ScrollArea className="h-[600px]">
              <div className="relative">
                {/* Vertical timeline line */}
                <div className="absolute left-[19px] top-0 bottom-0 w-px bg-border" />
                <div className="space-y-0">
                  {filteredEvents.map((event, idx) => {
                    const comparison = getActualVsForecast(event.actual, event.forecast);
                    return (
                      <motion.div
                        key={event.id}
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.02 }}
                        className="flex items-stretch"
                      >
                        {/* Timeline dot */}
                        <div className="flex flex-col items-center mr-3 pt-2 flex-shrink-0" style={{ width: 24 }}>
                          <div className={`w-2.5 h-2.5 rounded-full border-2 z-10 ${
                            event.impact === 'high' ? 'bg-red-500 border-red-400' :
                            event.impact === 'medium' ? 'bg-amber-500 border-amber-400' :
                            'bg-green-500 border-green-400'
                          }`} />
                          {idx < filteredEvents.length - 1 && <div className="flex-1 w-px bg-border" />}
                        </div>
                        {/* Event row content */}
                        <div className="flex-1 flex items-center py-2 border-b border-border/50 min-w-0">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <span className="text-[10px] tabular-nums text-muted-foreground whitespace-nowrap w-10">{event.date.split(' ')[1]}</span>
                            <span className="text-[10px] font-medium truncate">{event.event}</span>
                            <Badge variant="outline" className="text-[9px] px-1.5 py-0 flex-shrink-0">{event.currency}</Badge>
                            <ImpactDots impact={event.impact} />
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <div className="text-right">
                              <div className={`text-[10px] tabular-nums font-semibold ${getActualColor(event.actual, event.forecast)}`}>{event.actual}</div>
                              <div className="text-[9px] text-muted-foreground tabular-nums">F: {event.forecast}</div>
                            </div>
                            <ActualVsForecastArrow actual={event.actual} forecast={event.forecast} />
                            <div className="text-right pl-1">
                              <div className="text-[9px] text-muted-foreground tabular-nums">P: {event.previous}</div>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                  {filteredEvents.length === 0 && (
                    <div className="text-center py-8 text-sm text-muted-foreground">
                      No events matching filters
                    </div>
                  )}
                </div>
              </div>
            </ScrollArea>
          </div>
        </div>
      </div>

      {/* Economic Calendar */}
      <EconomicCalendar />
    </div>
  );
}
