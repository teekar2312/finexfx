'use client';

import { useState, useMemo } from 'react';
import {
  ComposedChart,
  Bar,
  Area,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';
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

// Candlestick shape: proper body (~6px filled rect) + wick (1px line)
const CandlestickShape = (props: any) => {
  const { x, y, width, height, payload } = props;
  if (!payload || !payload.open) return null;

  const { open, close, high, low } = payload;
  const isGreen = close >= open;
  const color = isGreen ? '#10b981' : '#ef4444';

  const range = high - low || 0.0001;
  const priceToY = (price: number) => {
    return y + height - ((price - low) / range) * height;
  };

  const bodyTop = Math.min(open, close);
  const bodyBottom = Math.max(open, close);
  const bodyHeightPx = Math.max(((bodyBottom - bodyTop) / range) * height, 1);
  const bodyYPx = priceToY(bodyBottom);

  const wickTopY = priceToY(high);
  const wickBottomY = priceToY(low);

  // Body: ~6px wide, centered on the wick
  const bodyWidth = Math.min(width * 0.7, 6);
  const bodyX = x + (width - bodyWidth) / 2;

  return (
    <g>
      {/* Wick: 1px line from low to high */}
      <line
        x1={x + width / 2}
        y1={wickTopY}
        x2={x + width / 2}
        y2={wickBottomY}
        stroke={color}
        strokeWidth={1}
      />
      {/* Body: filled emerald/red rectangle */}
      <rect
        x={bodyX}
        y={bodyYPx}
        width={bodyWidth}
        height={bodyHeightPx}
        fill={color}
        stroke={color}
        strokeWidth={0.5}
      />
    </g>
  );
};

// Volume bar shape: dynamic fill based on candle direction
const VolumeShape = (props: any) => {
  const { x, y, width, height, payload } = props;
  if (!payload) return null;
  const isGreen = payload.close >= payload.open;
  const color = isGreen ? 'rgba(16, 185, 129, 0.25)' : 'rgba(239, 68, 68, 0.25)';
  return <rect x={x} y={y} width={width} height={height} fill={color} />;
};

// Vertical crosshair cursor that follows the mouse
const CrosshairCursor = (props: any) => {
  const { active, points, height } = props;
  if (!active || !points || points.length === 0) return null;
  const cx = points[0]?.x;
  if (cx === undefined || cx === null) return null;
  return (
    <line
      x1={cx}
      y1={0}
      x2={cx}
      y2={height}
      stroke="rgba(255, 255, 255, 0.15)"
      strokeWidth={1}
      strokeDasharray="3 3"
    />
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

  // Chart data enriched with previous close for tooltip change calculation
  const chartData = useMemo(() => {
    return data.map((d, i) => ({
      ...d,
      prevClose: i > 0 ? data[i - 1].close : d.open,
    }));
  }, [data]);

  // Round-number grid levels (e.g., 1.0800, 1.0850 for EURUSD)
  const roundLevels = useMemo(() => {
    const range = maxPrice - minPrice;
    const pipRange = range / info.pipSize;
    let pipStep: number;
    if (pipRange <= 50) pipStep = 10;
    else if (pipRange <= 200) pipStep = 50;
    else if (pipRange <= 500) pipStep = 100;
    else pipStep = 500;

    const step = info.pipSize * pipStep;
    const start = Math.ceil(minPrice / step) * step;
    const levels: number[] = [];
    for (let level = start; level <= maxPrice; level += step) {
      levels.push(parseFloat(level.toFixed(info.digits)));
    }
    return levels;
  }, [minPrice, maxPrice, info.pipSize, info.digits]);

  // Current (latest) price direction for the current price line
  const latestClose = data.length > 0 ? data[data.length - 1].close : 0;
  const prevCandleClose = data.length > 1 ? data[data.length - 2].close : 0;
  const isLatestUp = data.length > 1 ? latestClose >= prevCandleClose : true;
  const currentPriceColor = isLatestUp ? '#10b981' : '#ef4444';

  // Enhanced tooltip with glass-card-premium styling
  const tooltipContent = (props: any) => {
    const { active, payload } = props;
    if (!active || !payload || !payload.length) return null;
    const d = payload[0]?.payload;
    if (!d) return null;
    const isGreenCandle = d.close >= d.open;
    const color = isGreenCandle ? '#10b981' : '#ef4444';
    const timeStr = new Date(d.time).toLocaleString();
    const spread = ask !== undefined && bid !== undefined ? ask - bid : null;
    const spreadPips = spread !== null ? Math.round(spread / info.pipSize) : null;
    const changeFromPrev = d.prevClose !== undefined ? d.close - d.prevClose : 0;
    const changeColor = changeFromPrev >= 0 ? '#10b981' : '#ef4444';
    const changeSign = changeFromPrev >= 0 ? '+' : '';

    return (
      <div className="glass-card-premium tooltip-animated-border rounded-lg p-3 text-[11px] shadow-lg min-w-[165px]">
        <div className="text-[10px] text-slate-400 mb-2 font-medium">{timeStr}</div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-slate-400">O</span>
            <span className="font-bold tabular-nums" style={{ color }}>{d.open.toFixed(info.digits)}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-slate-400">H</span>
            <span className="font-bold tabular-nums" style={{ color }}>{d.high.toFixed(info.digits)}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-slate-400">L</span>
            <span className="font-bold tabular-nums" style={{ color }}>{d.low.toFixed(info.digits)}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-slate-400">C</span>
            <span className="font-bold tabular-nums" style={{ color }}>{d.close.toFixed(info.digits)}</span>
          </div>
        </div>
        <div className="flex items-center justify-between gap-2 mt-2 pt-1.5 border-t border-white/10">
          <span className="text-slate-400">Vol</span>
          <span className="font-bold tabular-nums text-slate-300">{d.volume.toLocaleString()}</span>
        </div>
        {spreadPips !== null && (
          <div className="flex items-center justify-between gap-2 mt-0.5">
            <span className="text-slate-400">Spread</span>
            <span className="font-bold tabular-nums text-amber-400">{spreadPips} pips</span>
          </div>
        )}
        <div className="flex items-center justify-between gap-2 mt-0.5">
          <span className="text-slate-400">Chg</span>
          <span className="font-bold tabular-nums" style={{ color: changeColor }}>
            {changeSign}{changeFromPrev.toFixed(info.digits)}
          </span>
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

  // Round-number grid ReferenceLines (shared between modes)
  const roundGridLines = (
    <>
      {roundLevels.map((level) => (
        <ReferenceLine
          key={`round-${level}`}
          yAxisId="price"
          y={level}
          stroke="rgba(255,255,255,0.04)"
          strokeDasharray="3 3"
        />
      ))}
    </>
  );

  return (
    <div className="relative w-full tooltip-fade" style={{ height }}>
      {/* Chart Mode Toggle - Sleek Pill with Sliding Indicator */}
      <div className="absolute top-2 right-2 z-10">
        <div className="chart-toggle-container">
          <div className={`chart-toggle-slider ${chartMode === 'candlestick' ? 'right' : ''}`} />
          <button
            onClick={() => setChartMode('area')}
            className={`chart-toggle-btn ${chartMode === 'area' ? 'chart-toggle-btn-active' : ''}`}
            title="Area Chart"
          >
            <BarChart3 className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setChartMode('candlestick')}
            className={`chart-toggle-btn ${chartMode === 'candlestick' ? 'chart-toggle-btn-active' : ''}`}
            title="Candlestick Chart"
          >
            <CandlestickChart className="h-3.5 w-3.5" />
          </button>
        </div>
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
            <RechartsTooltip content={tooltipContent} cursor={<CrosshairCursor />} />
            {roundGridLines}
            {/* Current price line: dashed, colored emerald for up / red for down */}
            <ReferenceLine
              yAxisId="price"
              y={latestClose}
              stroke={currentPriceColor}
              strokeDasharray="5 5"
              strokeWidth={1}
              label={{
                value: formatPrice(latestClose),
                position: 'right',
                fill: currentPriceColor,
                fontSize: 10,
                fontWeight: 'bold',
              }}
            />
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
              shape={<VolumeShape />}
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
            <RechartsTooltip content={tooltipContent} cursor={<CrosshairCursor />} />
            {roundGridLines}
            {/* Current price line: dashed, colored emerald for up / red for down */}
            <ReferenceLine
              yAxisId="price"
              y={latestClose}
              stroke={currentPriceColor}
              strokeDasharray="5 5"
              strokeWidth={1}
              label={{
                value: formatPrice(latestClose),
                position: 'right',
                fill: currentPriceColor,
                fontSize: 10,
                fontWeight: 'bold',
              }}
            />
            {/* Candlestick bars: dataKey=high so bar occupies full low-high range */}
            <Bar
              yAxisId="price"
              dataKey="high"
              isAnimationActive={false}
              shape={<CandlestickShape />}
            />
            {/* Volume bars with per-candle coloring */}
            <Bar
              yAxisId="volume"
              dataKey="volume"
              shape={<VolumeShape />}
              isAnimationActive={false}
            />
          </ComposedChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
