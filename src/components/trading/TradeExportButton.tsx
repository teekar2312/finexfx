'use client';

import { useCallback } from 'react';
import { useTradingStore } from '@/store/trading-store';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

function formatDuration(openedAt: string, closedAt?: string): string {
  if (!closedAt) return 'N/A';
  const open = new Date(openedAt).getTime();
  const close = new Date(closedAt).getTime();
  const diffMs = close - open;
  if (diffMs < 0) return 'N/A';

  const totalSeconds = Math.floor(diffMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

function escapeCsv(value: string | number | undefined): string {
  const str = value == null ? '' : String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export default function TradeExportButton() {
  const closedTrades = useTradingStore((s) => s.closedTrades);

  const handleExport = useCallback(() => {
    if (closedTrades.length === 0) {
      toast({
        title: 'No trades to export',
        description: 'Close some trades first to build history.',
      });
      return;
    }

    const headers = [
      'ID',
      'Symbol',
      'Direction',
      'Lot Size',
      'Entry Price',
      'Exit Price',
      'SL',
      'TP',
      'Pips',
      'P&L ($)',
      'Commission',
      'Spread',
      'Duration',
      'Status',
      'Strategy',
      'Opened At',
      'Closed At',
    ];

    const rows = closedTrades.map((t) => [
      t.id,
      t.symbol,
      t.direction,
      t.lotSize,
      t.entryPrice,
      t.currentPrice, // exit price stored in currentPrice at close time
      t.stopLoss ?? '',
      t.takeProfit ?? '',
      t.pips.toFixed(1),
      t.profit.toFixed(2),
      t.commission.toFixed(2),
      t.spread.toFixed(1),
      formatDuration(t.openedAt, t.closedAt),
      t.status,
      t.strategy ?? '',
      formatTimestamp(t.openedAt),
      t.closedAt ? formatTimestamp(t.closedAt) : '',
    ]);

    // Build CSV with BOM for Excel UTF-8 compatibility
    const csvContent = [
      '\uFEFF' + headers.map(escapeCsv).join(','),
      ...rows.map((row) => row.map(escapeCsv).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `trade-history-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      title: 'Export complete',
      description: `${closedTrades.length} trades exported as CSV`,
    });
  }, [closedTrades]);

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleExport}
      className="scale-click h-6 px-2 text-[11px] gap-1 border-border/50 text-muted-foreground hover:text-emerald-400 hover:border-emerald-500/30"
      disabled={closedTrades.length === 0}
    >
      <Download className="h-3 w-3" />
      <span className="hidden sm:inline">Export CSV</span>
      <span className="text-[10px] opacity-60">({closedTrades.length})</span>
    </Button>
  );
}
