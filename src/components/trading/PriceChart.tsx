'use client';

import { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from 'recharts';
import { SYMBOL_INFO, type Symbol } from '@/lib/types';

interface PriceChartProps {
  data: Array<{ time: number; open: number; high: number; low: number; close: number; volume: number }>;
  symbol: Symbol;
  bid?: number;
  ask?: number;
 height?: number;
}

export default function PriceChart({ data, symbol, bid, ask, height = 350 }: PriceChartProps) {
  const info = SYMBOL_INFO[symbol];

  const { minPrice, maxPrice, midPrice } = useMemo(() => {
    if (!data || data.length === 0) return { minPrice: 0, maxPrice: 1, midPrice: 0.5 };
    const prices = data.flatMap(d => [d.high, d.low]);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const padding = (max - min) * 0.1 || 0.001;
    return {
      minPrice: min - padding,
      maxPrice: max + padding,
      midPrice: (min + max) / 2,
    };
  }, [data]);

  const formatTime = (time: number) => {
    const d = new Date(time);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  const formatPrice = (price: number) => {
    return price.toFixed(info.digits);
  };

  const isUp = data.length > 1 ? data[data.length - 1].close >= data[0].open : true;
  const gradientColor = isUp ? '#10b981' : '#ef4444';
  const strokeColor = isUp ? '#10b981' : '#ef4444';

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        Waiting for price data...
      </div>
    );
  }

  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
          <defs>
            <linearGradient id={`gradient-${symbol}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={gradientColor} stopOpacity={0.3} />
              <stop offset="95%" stopColor={gradientColor} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
          <XAxis
            dataKey="time"
            tickFormatter={formatTime}
            tick={{ fontSize: 10, fill: '#64748b' }}
            axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
            tickLine={false}
            minTickGap={40}
          />
          <YAxis
            domain={[minPrice, maxPrice]}
            tickFormatter={formatPrice}
            tick={{ fontSize: 10, fill: '#64748b' }}
            axisLine={false}
            tickLine={false}
            width={75}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1e293b',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '8px',
              fontSize: '12px',
              color: '#e2e8f0',
            }}
            formatter={(value: number) => [formatPrice(value), 'Price']}
            labelFormatter={(time) => {
              const d = new Date(time as number);
              return d.toLocaleString();
            }}
          />
          {bid !== undefined && (
            <ReferenceLine
              y={bid}
              stroke="#10b981"
              strokeDasharray="4 4"
              strokeWidth={1}
              label={{
                value: `B: ${formatPrice(bid)}`,
                position: 'insideTopRight',
                fill: '#10b981',
                fontSize: 10,
              }}
            />
          )}
          {ask !== undefined && (
            <ReferenceLine
              y={ask}
              stroke="#ef4444"
              strokeDasharray="4 4"
              strokeWidth={1}
              label={{
                value: `A: ${formatPrice(ask)}`,
                position: 'insideBottomRight',
                fill: '#ef4444',
                fontSize: 10,
              }}
            />
          )}
          <Area
            type="monotone"
            dataKey="close"
            stroke={strokeColor}
            strokeWidth={1.5}
            fill={`url(#gradient-${symbol})`}
            animationDuration={300}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
