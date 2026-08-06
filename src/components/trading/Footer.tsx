'use client';
import { useTradingStore } from '@/store/trading-store';
import { SYMBOLS, SYMBOL_INFO, BROKER_CONFIG, type Symbol } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export default function Footer() {
  const { prices, isConnected, openTrades, dailyPnl, isAutoTrading, marketConditions, totalPnl } = useTradingStore();
  const now = new Date();
  const utcTime = now.toUTCString().split(' ')[4];

  return (
    <TooltipProvider>
      <footer className="h-9 border-t border-border bg-card/90 backdrop-blur-md flex items-center px-4 gap-4 text-[10px] shrink-0 z-40 relative">
        {/* Top gradient line */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />

        {/* Market Ticker - scrolling prices */}
        <div className="flex-1 overflow-hidden scroll-horizontal">
          <div className="flex items-center gap-8 animate-ticker">
            {SYMBOLS.map((sym) => {
              const p = prices[sym];
              if (!p) return null;
              const change = p.change;
              const color = change >= 0 ? 'text-emerald-400' : 'text-red-400';
              const mc = marketConditions[sym];
              const mcColor = mc === 'trending' ? 'text-emerald-500' : mc === 'high_volatility' ? 'text-red-400' : mc === 'range_bound' ? 'text-amber-400' : 'text-slate-500';
              return (
                <div key={sym} className="flex items-center gap-2 whitespace-nowrap group">
                  <span className="text-muted-foreground font-medium group-hover:text-foreground transition-colors">{SYMBOL_INFO[sym].name}</span>
                  <span className={`tabular-nums font-semibold ${color} live-value`}>{p.bid.toFixed(SYMBOL_INFO[sym].digits)}</span>
                  <span className={`${color} tabular-nums text-[9px]`}>{change >= 0 ? '▲' : '▼'}{Math.abs(change).toFixed(SYMBOL_INFO[sym].digits)}</span>
                  <span className={`text-[9px] ${mcColor}`}>•{mc === 'trending' ? 'T' : mc === 'range_bound' ? 'R' : mc === 'high_volatility' ? 'V' : 'F'}</span>
                </div>
              );
            })}
          </div>
        </div>
        {/* Separator */}
        <div className="w-px h-4 bg-gradient-to-b from-transparent via-border to-transparent" />
        {/* Status Indicators */}
        <div className="flex items-center gap-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1.5 cursor-default">
                <div className="relative">
                  <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-red-500'}`} />
                  {isConnected && <div className="absolute inset-0 w-1.5 h-1.5 rounded-full bg-emerald-500 dot-ping" />}
                </div>
                <span className={`font-medium ${isConnected ? 'text-emerald-400' : 'text-red-400'}`}>{isConnected ? 'LIVE' : 'OFF'}</span>
              </div>
            </TooltipTrigger>
            <TooltipContent side="top"><p className="text-[10px]">Price Feed Status</p></TooltipContent>
          </Tooltip>
          {isAutoTrading && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-[9px] px-2 py-0 gap-1 neon-glow">
                  <span className="w-1 h-1 rounded-full bg-emerald-500 pulse-dot" />
                  AUTO
                </Badge>
              </TooltipTrigger>
              <TooltipContent side="top"><p className="text-[10px]">Auto Trading Active</p></TooltipContent>
            </Tooltip>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1.5 text-muted-foreground cursor-default">
                <span className="font-medium">{openTrades.length}</span>
                <span className="text-[9px]">pos</span>
                <div className="w-px h-3 bg-border" />
                <span className={`font-semibold tabular-nums ${dailyPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {dailyPnl >= 0 ? '+' : ''}{dailyPnl.toFixed(2)}
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent side="top"><p className="text-[10px]">Open Positions / Daily P&L</p></TooltipContent>
          </Tooltip>
        </div>
        {/* Separator */}
        <div className="w-px h-4 bg-gradient-to-b from-transparent via-border to-transparent" />
        {/* Right: Total P&L + UTC Time + Broker */}
        <div className="flex items-center gap-3 text-muted-foreground">
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1 cursor-default">
                <span className="text-[9px]">TOTAL</span>
                <span className={`font-semibold tabular-nums ${totalPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {totalPnl >= 0 ? '+' : ''}{totalPnl.toFixed(2)}
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent side="top"><p className="text-[10px]">Total P&L (all closed trades)</p></TooltipContent>
          </Tooltip>
          <span className="tabular-nums font-medium">UTC {utcTime}</span>
          <span>•</span>
          <span className="text-gradient-cool font-semibold text-[10px]">{BROKER_CONFIG.name}</span>
        </div>
      </footer>
    </TooltipProvider>
  );
}
