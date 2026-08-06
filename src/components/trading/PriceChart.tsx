'use client';

import { useState, useMemo } from 'react';
import { ComposedChart, Bar, Area, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from 'recharts';
import { CandlestickChart, BarChart3 } from 'lucide-react';
import { SYMBOL_INFO, type Symbol } from '@/lib/types';

interface PriceChartProps {
  data: Array<{ time: number; open: number; high: number; low: number; close: number; volume: number }>;
  symbol: Symbol;
  bid?: number;
  ask?: number;
  height?: number;
}

type ChartMode = 'area' | 'candlestick';

// Candlestick shape component for recharts Bar
const CandlestickShape = (props: any) => {
  const { x, y, width, height, payload } = props;
  if (!payload || !payload.open) return null;

  const { open, close, high, low } = payload;
  const isGreen = close >= open;
  const color = isGreen ? '#10b981' : '#ef4444';

  // The Y axis domain is [minPrice, maxPrice] where y coordinate maps linearly.
  // The Bar receives y=top of bar area and height = bar area height.
  // We need to compute pixel positions relative to this bar area.
  const range = high - low || 0.0001;

  // Scale helper: maps a price value to a y-pixel within the bar area
  // y is the top of the bar area (maps to maxPrice), y+height is bottom (maps to minPrice)
  const priceToY = (price: number) => {
    return y + height - ((price - low) / range) * height;
  };

  const bodyTop = Math.min(open, close);
  const bodyBottom = Math.max(open, close);
  const bodyHeightPx = Math.max(((bodyBottom - bodyTop) / range) * height, 1);
  const bodyYPx = priceToY(bodyBottom);

  const wickTopY = priceToY(high);
  const wickBottomY = priceToY(low);

  return (
    <g>
      {/* Wick line from low to high */}
      <line
        x1={x + width / 2}
        y1={wickTopY}
        x2={x + width / 2}
        y2={wickBottomY}
        stroke={color}
        strokeWidth={1}
      />
      {/* Body */}
      <rect
        x={x + width * 0.15}
        y={bodyYPx}
        width={width * 0.7}
        height={bodyHeightPx}
        fill={isGreen ? color : color}
        stroke={color}
        strokeWidth={0.5}
      />
    </g>
  );
};

export default function PriceChart({ data, symbol, bid, ask, height = 350 }: PriceChartProps) {
  const [chartMode, setChartMode] = useState<ChartMode>('area');
  const info = SYMBOL_INFO[symbol];

  const { minPrice, maxPrice, maxVolume } = useMemo(() => {
    if (!data || data.length === 0) return { minPrice: 0, maxPrice: 1, maxVolume: 1 };
    const prices = data.flatMap(d => [d.high, d.low]);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const padding = (max - min) * 0.1 || 0.001;
    const vol = Math.max(...data.map(d => d.volume)) || 1;
    return {
      minPrice: min - padding,
      maxPrice: max + padding,
      maxVolume: vol,
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

  // Prepare data with bar colors for volume
  const chartData = useMemo(() => {
    return data.map(d => ({
      ...d,
      barColor: d.close >= d.open ? '#10b98150' : '#ef444450',
    }));
  }, [data]);

  // For candlestick mode, the Y axis uses high/low range per candle
  // We use the global minPrice/maxPrice for the domain

  const tooltipContent = (props: any) => {
    const { active, payload } = props;
    if (!active || !payload || !payload.length) return null;
    const d = payload[0]?.payload;
    if (!d) return null;
    const isGreenCandle = d.close >= d.open;
    const color = isGreenCandle ? '#10b981' : '#ef4444';
    const timeStr = new Date(d.time).toLocaleString();
    return (
      <div className="bg-[#1e293b] border border-white/10 rounded-lg p-2.5 text-[11px] shadow-lg">
        <div className="text-[10px] text-slate-400 mb-1.5">{timeStr}</div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-slate-400">Open</span>
            <span className={`font-bold tabular-nums ${color}`}>{d.open.toFixed(info.digits)}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-slate-400">High</span>
            <span className={`font-bold tabular-nums ${color}`}>{d.high.toFixed(info.digits)}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-slate-400">Low</span>
            <span className={`font-bold tabular-nums ${color}`}>{d.low.toFixed(info.digits)}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-slate-400">Close</span>
            <span className={`font-bold tabular-nums ${color}`}>{d.close.toFixed(info.digits)}</span>
          </div>
        </div>
        <div className="flex items-center justify-between gap-2 mt-1 pt-1 border-t border-white/10">
          <span className="text-slate-400">Volume</span>
          <span className="font-bold tabular-nums text-slate-300">{d.volume.toLocaleString()}</span>
        </div>
      </div>
    );
  };

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        Waiting for price data...
      </div>
    );
  }

  return (
    <div className="relative w-full" style={{ height }}>
      {/* Chart Mode Toggle */}
      <div className="absolute top-2 right-2 z-10 flex items-center gap-1">
        <button
          onClick={() => setChartMode('area')}
          className={`p-1.5 rounded-md transition-colors ${
            chartMode === 'area'
              ? 'bg-primary/20 text-primary border border-primary/30'
              : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
          }`}
          title="Area Chart"
        >
          <BarChart3 className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => setChartMode('candlestick')}
          className={`p-1.5 rounded-md transition-colors ${
            chartMode === 'candlestick'
              ? 'bg-primary/20 text-primary border border-primary/30'
              : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
          }`}
          title="Candlestick Chart"
        >
          <CandlestickChart className="h-3.5 w-3.5" />
        </button>
      </div>

      <ResponsiveContainer width="100%" height="100%">
        {chartMode === 'area' ? (
          <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
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
              yAxisId="price"
              domain={[minPrice, maxPrice]}
              tickFormatter={formatPrice}
              tick={{ fontSize: 10, fill: '#64748b' }}
              axisLine={false}
              tickLine={false}
              width={75}
            />
            <YAxis
              yAxisId="volume"
              domain={[0, maxVolume]}
              hide
              orientation="right"
            />
            <RechartsTooltip content={tooltipContent} />
            {bid !== undefined && (
              <ReferenceLine
                yAxisId="price"
                y={bid}
                stroke="#10b981"
                strokeDasharray="5 5"
                strokeWidth={1}
                label={{
                  value: formatPrice(bid),
                  position: 'insideTopRight',
                  fill: '#10b981',
                  fontSize: 10,
                }}
              />
            )}
            {ask !== undefined && (
              <ReferenceLine
                yAxisId="price"
                y={ask}
                stroke="#ef4444"
                strokeDasharray="5 5"
                strokeWidth={1}
                label={{
                  value: formatPrice(ask),
                  position: 'insideBottomRight',
                  fill: '#ef4444',
                  fontSize: 10,
                }}
              />
            )}
            <Area
              yAxisId="price"
              type="monotone"
              dataKey="close"
              stroke={strokeColor}
              strokeWidth={1.5}
              fill={`url(#gradient-${symbol})`}
              animationDuration={300}
            />
            <Bar
              yAxisId="volume"
              dataKey="volume"
              fill={gradientColor}
              fillOpacity={0.15}
              isAnimationActive={false}
            />
          </ComposedChart>
        ) : (
          <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
            <XAxis
              dataKey="time"
              tickFormatter={formatTime}
              tick={{ fontSize: 10, fill: '#64748b' }}
              axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
              tickLine={false}
              minTickGap={40}
            />
            {/* Price Y axis: domain from global min/max so CandlestickShape can compute pixel positions */}
            <YAxis
              yAxisId="price"
              domain={[minPrice, maxPrice]}
              tickFormatter={formatPrice}
              tick={{ fontSize: 10, fill: '#64748b' }}
              axisLine={false}
              tickLine={false}
              width={75}
            />
            <YAxis
              yAxisId="volume"
              domain={[0, maxVolume]}
              hide
              orientation="right"
            />
            <RechartsTooltip content={tooltipContent} />
            {/* Current bid price dashed line */}
            {bid !== undefined && (
              <ReferenceLine
                yAxisId="price"
                y={bid}
                stroke="#10b981"
                strokeDasharray="5 5"
                strokeWidth={1}
                label={{
                  value: formatPrice(bid),
                  position: 'insideTopRight',
                  fill: '#10b981',
                  fontSize: 10,
                }}
              />
            )}
            {/* Candlestick bars: use high as the dataKey so bar occupies the full low-high range.
                The custom shape will render the actual candle inside. */}
            <Bar
              yAxisId="price"
              dataKey="high"
              isAnimationActive={false}
              shape={<CandlestickShape />}
            />
            {/* Volume bars */}
            <Bar
              yAxisId="volume"
              dataKey="volume"
              fill={gradientColor}
              fillOpacity={0.15}
              isAnimationActive={false}
            />
          </ComposedChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}