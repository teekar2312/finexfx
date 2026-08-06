'use client';
import { useTradingStore } from '@/store/trading-store';
import { SYMBOLS, SYMBOL_INFO, BROKER_CONFIG, type Symbol } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export default function Footer() {
  const { prices, isConnected, openTrades, dailyPnl, isAutoTrading, marketConditions } = useTradingStore();
  const now = new Date();
  const utcTime = now.toUTCString().split(' ')[4];

  return (
    <TooltipProvider>
      <footer className="h-8 border-t border-border bg-card/80 backdrop-blur-sm flex items-center px-3 gap-4 text-[10px] shrink-0 z-40">
        {/* Market Ticker - scrolling prices */}
        <div className="flex-1 overflow-hidden">
          <div className="flex items-center gap-6 animate-ticker">
            {SYMBOLS.map((sym) => {
              const p = prices[sym];
              if (!p) return null;
              const change = p.change;
              const color = change >= 0 ? 'text-emerald-400' : 'text-red-400';
              return (
                <div key={sym} className="flex items-center gap-1.5 whitespace-nowrap">
                  <span className="text-muted-foreground font-medium">{SYMBOL_INFO[sym].name}</span>
                  <span className={`tabular-nums font-medium ${color}`}>{p.bid.toFixed(SYMBOL_INFO[sym].digits)}</span>
                  <span className={`${color} tabular-nums`}>{change >= 0 ? '+' : ''}{change.toFixed(SYMBOL_INFO[sym].digits)}</span>
                </div>
              );
            })}
          </div>
        </div>
        {/* Separator */}
        <div className="w-px h-4 bg-border" />
        {/* Status Indicators */}
        <div className="flex items-center gap-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1">
                <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-500 pulse-dot badge-pulse' : 'bg-red-500'}`} />
                <span className="text-muted-foreground">{isConnected ? 'LIVE' : 'OFF'}</span>
              </div>
            </TooltipTrigger>
            <TooltipContent side="top"><p>Price Feed Status</p></TooltipContent>
          </Tooltip>
          {isAutoTrading && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[9px] px-1.5 py-0 gap-0.5">
                  <span className="w-1 h-1 rounded-full bg-emerald-500 pulse-dot" />
                  AUTO
                </Badge>
              </TooltipTrigger>
              <TooltipContent side="top"><p>Auto Trading Active</p></TooltipContent>
            </Tooltip>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1 text-muted-foreground">
                <span>{openTrades.length} pos</span>
                <span className={dailyPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                  {dailyPnl >= 0 ? '+' : ''}{dailyPnl.toFixed(2)}
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent side="top"><p>Positions / Daily P&L</p></TooltipContent>
          </Tooltip>
        </div>
        {/* Right: UTC Time + Broker */}
        <div className="flex items-center gap-2 text-muted-foreground">
          <span className="tabular-nums">UTC {utcTime}</span>
          <span>•</span>
          <span className="gradient-text-emerald font-medium">{BROKER_CONFIG.name}</span>
        </div>
      </footer>
    </TooltipProvider>
  );
}
