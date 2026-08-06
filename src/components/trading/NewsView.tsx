'use client';

import { useState } from 'react';
import { useTradingStore } from '@/store/trading-store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { motion, AnimatePresence } from 'framer-motion';
import { Newspaper, AlertTriangle, Clock, Globe, Filter, X } from 'lucide-react';

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

function ImpactBadge({ impact }: { impact: 'high' | 'medium' | 'low' }) {
  return (
    <Badge
      variant="outline"
      className={`text-[9px] px-1.5 py-0 ${
        impact === 'high' ? 'border-red-500/50 text-red-500 bg-red-500/10' :
        impact === 'medium' ? 'border-amber-500/50 text-amber-500 bg-amber-500/10' :
        'border-slate-500/50 text-slate-500 bg-slate-500/10'
      }`}
    >
      {impact.toUpperCase()}
    </Badge>
  );
}

function getActualColor(actual: string, forecast: string): string {
  const a = parseFloat(actual);
  const f = parseFloat(forecast);
  if (isNaN(a) || isNaN(f)) return 'text-foreground';
  return a > f ? 'text-emerald-500' : a < f ? 'text-red-500' : 'text-foreground';
}

export default function NewsView() {
  const { newsItems } = useTradingStore();
  const allNews = newsItems.length > 0 ? newsItems : MOCK_NEWS;
  const [currencyFilter, setCurrencyFilter] = useState<string>('all');
  const [impactFilter, setImpactFilter] = useState<string>('all');
  const [showBreaking, setShowBreaking] = useState(true);

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

  const breakingNews = allNews.filter(n => n.impact === 'high').slice(0, 1);

  return (
    <div className="p-4 space-y-4">
      {/* Breaking News Banner */}
      <AnimatePresence>
        {showBreaking && breakingNews.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex items-center gap-3 p-3 rounded-lg bg-red-500/10 border border-red-500/30"
          >
            <div className="flex items-center gap-2 flex-shrink-0">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <Badge className="bg-red-500 text-white text-[10px] px-2 py-0">BREAKING</Badge>
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-sm font-medium text-red-400 truncate block">{breakingNews[0].title}</span>
            </div>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground" onClick={() => setShowBreaking(false)}>
              <X className="h-3 w-3" />
            </Button>
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
        <Select value={impactFilter} onValueChange={setImpactFilter}>
          <SelectTrigger className="w-[100px] h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Impact</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex-1" />
        <span className="text-[10px] text-muted-foreground">{filteredNews.length} articles • {filteredEvents.length} events</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* News Feed */}
        <Card className="glass-card">
          <CardHeader className="pb-2 pt-3 px-4">
            <div className="flex items-center gap-2">
              <Newspaper className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm font-semibold">News Feed</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <ScrollArea className="h-[600px]">
              <div className="space-y-3">
                {filteredNews.map((news, i) => (
                  <motion.div
                    key={news.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className={`p-3 rounded-lg border transition-colors hover:bg-accent/30 ${
                      news.impact === 'high' ? 'border-red-500/20' :
                      news.impact === 'medium' ? 'border-amber-500/20' :
                      'border-border'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h4 className="text-xs font-semibold leading-tight">{news.title}</h4>
                      <ImpactBadge impact={news.impact} />
                    </div>
                    {(news as any).summary && (
                      <p className="text-[11px] text-muted-foreground mb-2 line-clamp-2">{(news as any).summary}</p>
                    )}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[9px] px-1.5 py-0">{news.currency}</Badge>
                        {(news as any).category && (
                          <Badge variant="secondary" className="text-[9px] px-1.5 py-0">{(news as any).category}</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                        <span>{(news as any).source || 'News'}</span>
                        <span>•</span>
                        <div className="flex items-center gap-1">
                          <Clock className="h-2.5 w-2.5" />
                          {news.publishedAt ? new Date(news.publishedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
                {filteredNews.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    No news matching filters
                  </div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Economic Calendar */}
        <Card className="glass-card">
          <CardHeader className="pb-2 pt-3 px-4">
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm font-semibold">Economic Calendar</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <ScrollArea className="h-[600px]">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-[10px] h-8">Date</TableHead>
                    <TableHead className="text-[10px] h-8">Event</TableHead>
                    <TableHead className="text-[10px] h-8">Currency</TableHead>
                    <TableHead className="text-[10px] h-8">Impact</TableHead>
                    <TableHead className="text-[10px] h-8 text-right">Actual</TableHead>
                    <TableHead className="text-[10px] h-8 text-right">Forecast</TableHead>
                    <TableHead className="text-[10px] h-8 text-right">Previous</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEvents.map((event) => (
                    <TableRow key={event.id} className="border-border">
                      <TableCell className="text-[10px] tabular-nums whitespace-nowrap">{event.date.split(' ')[1]}</TableCell>
                      <TableCell className="text-[10px] font-medium max-w-[140px] truncate">{event.event}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[9px] px-1.5 py-0">{event.currency}</Badge>
                      </TableCell>
                      <TableCell><ImpactBadge impact={event.impact} /></TableCell>
                      <TableCell className={`text-[10px] text-right tabular-nums font-medium ${getActualColor(event.actual, event.forecast)}`}>
                        {event.actual}
                      </TableCell>
                      <TableCell className="text-[10px] text-right tabular-nums text-muted-foreground">{event.forecast}</TableCell>
                      <TableCell className="text-[10px] text-right tabular-nums text-muted-foreground">{event.previous}</TableCell>
                    </TableRow>
                  ))}
                  {filteredEvents.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-sm text-muted-foreground">
                        No events matching filters
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
