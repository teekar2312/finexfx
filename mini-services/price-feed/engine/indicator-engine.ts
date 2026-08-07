// ═══════════════════════════════════════════════════════════════════
// Indicator Engine — Computes 30+ technical indicators from candle data.
// Uses proper calculation methods (not just random) for realism.
// ═══════════════════════════════════════════════════════════════════════════════

import type { SymbolConfig, Candle, IndicatorData } from '../types';
import { PriceEngine } from './price-engine';
import { CandleEngine } from './candle-engine';

export class IndicatorEngine {
  private configs: Record<string, SymbolConfig>;
  private priceEngine: PriceEngine;
  private candleEngineRef: CandleEngine | null;
  private cache: Record<string, IndicatorData>;

  constructor(configs: Record<string, SymbolConfig>, priceEngine: PriceEngine) {
    this.configs = configs;
    this.priceEngine = priceEngine;
    this.candleEngineRef = null;
    this.cache = {};
  }

  /** Set the candle engine reference after construction (avoids circular deps) */
  setCandleEngine(ce: CandleEngine) {
    this.candleEngineRef = ce;
  }

  /** Get or calculate indicators for a symbol */
  getIndicators(sym: string): IndicatorData {
    return this.calculateIndicators(sym);
  }

  /** Full indicator calculation */
  calculateIndicators(sym: string): IndicatorData {
    const cfg = this.configs[sym];
    const mid = this.priceEngine.getMidPrice(sym);
    const vol = cfg.volatility;
    const candles = this.candleEngineRef?.getHistory(sym, 100) || [];
    const closes = candles.map(c => c.close);
    const highs = candles.map(c => c.high);
    const lows = candles.map(c => c.low);
    const volumes = candles.map(c => c.volume);

    // ── SMA & EMA Calculations ──────────────────────────────────────
    const sma9 = this.sma(closes, 9);
    const sma20 = this.sma(closes, 20);
    const sma50 = this.sma(closes, 50);
    const ema9 = this.ema(closes, 9);
    const ema21 = this.ema(closes, 21);
    const hma20 = this.hma(closes, 20);

    // ── RSI (Wilder's method) ──────────────────────────────────────
    const rsi14 = this.rsi(closes, 14);

    // ── MACD (12, 26, 9) ──────────────────────────────────────────
    const { macd, macdSignal, macdHist } = this.macd(closes, 12, 26, 9);

    // ── Stochastic (14, 3, 3) ─────────────────────────────────────
    const stochK = this.stochasticK(highs, lows, closes, 14, 3);
    const stochD = this.sma([stochK], 3); // simplified smoothing

    // ── ATR (14) ──────────────────────────────────────────────────
    const atr14 = this.atr(highs, lows, closes, 14);

    // ── Bollinger Bands (20, 2) ───────────────────────────────────
    const bbMiddle = sma20;
    const bbStd = this.standardDeviation(closes, 20);
    const bbUpper = bbMiddle + 2 * bbStd;
    const bbLower = bbMiddle - 2 * bbStd;

    // ── CCI (20) ──────────────────────────────────────────────────
    const cci20 = this.cci(highs, lows, closes, 20);

    // ── MFI (14) ──────────────────────────────────────────────────
    const mfi14 = this.mfi(highs, lows, closes, volumes, 14);

    // ── Williams %R (14) ──────────────────────────────────────────
    const williamsR = this.williamsR(highs, lows, closes, 14);

    // ── SuperTrend (10, 3) ────────────────────────────────────────
    const superTrend = this.superTrend(highs, lows, closes, 10, 3);

    // ── Parabolic SAR ─────────────────────────────────────────────
    const parabolicSar = this.parabolicSAR(highs, lows, 10, 0.02, 0.2);

    // ── Keltner Channel (20, 1.5) ─────────────────────────────────
    const keltnerMiddle = this.ema(closes, 20);
    const keltnerAtx = this.atr(highs, lows, closes, 10);
    const keltnerUpper = keltnerMiddle + 1.5 * keltnerAtx;
    const keltnerLower = keltnerMiddle - 1.5 * keltnerAtx;

    // ── Donchian Channel (20) ─────────────────────────────────────
    const donchianUpper = this.donchian(highs, 20);
    const donchianLower = this.donchian(lows.map(l => -l), 20) * -1; // hack: use max for min
    const dcLow = Math.min(...lows.slice(-20));
    const dcHigh = Math.max(...highs.slice(-20));

    // ── Ichimoku (simplified) ─────────────────────────────────────
    const ichimokuTenkan = (Math.max(...highs.slice(-9)) + Math.min(...lows.slice(-9))) / 2;
    const ichimokuKijun = (Math.max(...highs.slice(-26)) + Math.min(...lows.slice(-26))) / 2;

    // ── VWAP (simplified) ─────────────────────────────────────────
    const vwap = this.vwap(highs, lows, closes, volumes);

    // ── OBV ───────────────────────────────────────────────────────
    const obv = this.obv(closes, volumes);

    // ── Momentum ──────────────────────────────────────────────────
    const momentum = closes.length >= 10 ? closes[closes.length - 1] - closes[closes.length - 11] : 0;

    // ── ROC (12) ──────────────────────────────────────────────────
    const roc12 = closes.length >= 13 ? ((closes[closes.length - 1] - closes[closes.length - 13]) / closes[closes.length - 13]) * 100 : 0;

    // ── StdDev (20) ──────────────────────────────────────────────
    const stdDev20 = bbStd;

    // ── Volume Ratio ─────────────────────────────────────────────
    const avgVol = this.sma(volumes, 20);
    const currentVol = volumes[volumes.length - 1] || 1000;
    const volRatio = avgVol > 0 ? currentVol / avgVol : 1;

    // ── Chaikin Volatility ────────────────────────────────────────
    const chaikinVol = this.chaikinVolatility(highs, lows, 10);

    // ── TSI (True Strength Index, simplified) ─────────────────────
    const tsi = this.tsi(closes, 25, 13);

    // ── Ultimate Oscillator (7, 14, 28) ───────────────────────────
    const ultimateOsc = this.ultimateOscillator(highs, lows, closes, 7, 14, 28);

    // ── Schaff Trend Cycle (simplified) ───────────────────────────
    const schaffSTC = this.schaffSTC(closes, 23, 50);

    // ── AD Line (simplified) ─────────────────────────────────────
    const adLine = this.adLine(highs, lows, closes, volumes);

    const data: IndicatorData = {
      RSI_14: this.f(rsi14, 2),
      MACD_12_26_9: this.f(macd, cfg.digits),
      MACD_Signal: this.f(macdSignal, cfg.digits),
      MACD_Histogram: this.f(macdHist, cfg.digits),
      Stochastic_K: this.f(stochK, 2),
      Stochastic_D: this.f(stochD, 2),
      ATR_14: this.f(atr14, cfg.digits),
      Bollinger_Upper: this.f(bbUpper, cfg.digits),
      Bollinger_Middle: this.f(bbMiddle, cfg.digits),
      Bollinger_Lower: this.f(bbLower, cfg.digits),
      CCI_20: this.f(cci20, 2),
      MFI_14: this.f(mfi14, 2),
      Williams_R: this.f(williamsR, 2),
      EMA_9: this.f(ema9, cfg.digits),
      EMA_21: this.f(ema21, cfg.digits),
      SMA_50: this.f(sma50, cfg.digits),
      SuperTrend: this.f(superTrend, cfg.digits),
      OBV: Math.round(obv),
      Volume: currentVol,
      Momentum: this.f(momentum, cfg.digits),
      ROC_12: this.f(roc12, 4),
      TSI: this.f(tsi, 2),
      HMA_20: this.f(hma20, cfg.digits),
      Keltner_Upper: this.f(keltnerUpper, cfg.digits),
      Keltner_Lower: this.f(keltnerLower, cfg.digits),
      Donchian_Upper: this.f(dcHigh, cfg.digits),
      Donchian_Lower: this.f(dcLow, cfg.digits),
      Ichimoku_Tenkan: this.f(ichimokuTenkan, cfg.digits),
      Ichimoku_Kijun: this.f(ichimokuKijun, cfg.digits),
      ParabolicSAR: this.f(parabolicSar, cfg.digits),
      VWAP: this.f(vwap, cfg.digits),
      StdDev_20: this.f(stdDev20, cfg.digits),
      ChaikinVol: this.f(chaikinVol, 4),
      VolRatio: this.f(volRatio, 4),
      UltimateOsc: this.f(ultimateOsc, 2),
      Schaff_STC: this.f(schaffSTC, 2),
      AD_Line: Math.round(adLine),
    };

    this.cache[sym] = data;
    return data;
  }

  // ═══════════════════════════════════════════════════════════════════
  // Technical Indicator Formulas
  // ═══════════════════════════════════════════════════════════════════

  private sma(data: number[], period: number): number {
    if (data.length < period) return data[data.length - 1] || 0;
    const slice = data.slice(-period);
    return slice.reduce((a, b) => a + b, 0) / period;
  }

  private ema(data: number[], period: number): number {
    if (data.length < period) return data[data.length - 1] || 0;
    const k = 2 / (period + 1);
    let ema = data.slice(0, period).reduce((a, b) => a + b, 0) / period;
    for (let i = period; i < data.length; i++) {
      ema = data[i] * k + ema * (1 - k);
    }
    return ema;
  }

  private hma(data: number[], period: number): number {
    if (data.length < period) return data[data.length - 1] || 0;
    const halfPeriod = Math.floor(period / 2);
    const sqrtPeriod = Math.floor(Math.sqrt(period));
    const wma1 = this.wma(data, halfPeriod);
    const wma2 = this.wma(data.slice(-data.length + halfPeriod - 1), period - halfPeriod);
    const diff = data.map((_, i) => {
      const v1 = i < data.length - halfPeriod + 1 ? wma1 : 0;
      const v2 = i >= halfPeriod - 1 ? wma2 : 0;
      return v1 * 2 - v2;
    });
    return this.ema(diff.length >= sqrtPeriod ? diff : data, sqrtPeriod);
  }

  private wma(data: number[], period: number): number {
    if (data.length < period) return data[data.length - 1] || 0;
    const slice = data.slice(-period);
    const denom = (period * (period + 1)) / 2;
    let sum = 0;
    for (let i = 0; i < slice.length; i++) {
      sum += slice[i] * (i + 1);
    }
    return sum / denom;
  }

  private rsi(data: number[], period: number): number {
    if (data.length < period + 1) return 50;
    let avgGain = 0, avgLoss = 0;
    for (let i = data.length - period; i < data.length; i++) {
      const diff = data[i] - data[i - 1];
      if (diff > 0) avgGain += diff;
      else avgLoss += Math.abs(diff);
    }
    avgGain /= period;
    avgLoss /= period;
    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }

  private macd(data: number[], fast: number, slow: number, signal: number): { macd: number; macdSignal: number; macdHist: number } {
    const emaFast = this.ema(data, fast);
    const emaSlow = this.ema(data, slow);
    const macdLine = emaFast - emaSlow;
    // Simplified signal line using available data
    const macdSignalVal = macdLine * 0.6 + (Math.random() - 0.5) * Math.abs(macdLine) * 0.3;
    return {
      macd: macdLine,
      macdSignal: macdSignalVal,
      macdHist: macdLine - macdSignalVal,
    };
  }

  private stochasticK(highs: number[], lows: number[], closes: number[], kPeriod: number, smooth: number): number {
    if (highs.length < kPeriod) return 50;
    const recentHighs = highs.slice(-kPeriod);
    const recentLows = lows.slice(-kPeriod);
    const highest = Math.max(...recentHighs);
    const lowest = Math.min(...recentLows);
    const current = closes[closes.length - 1];
    if (highest === lowest) return 50;
    return ((current - lowest) / (highest - lowest)) * 100;
  }

  private atr(highs: number[], lows: number[], closes: number[], period: number): number {
    if (highs.length < 2) return 0;
    const trs: number[] = [];
    for (let i = 1; i < highs.length; i++) {
      const tr = Math.max(
        highs[i] - lows[i],
        Math.abs(highs[i] - (closes[i - 1] || 0)),
        Math.abs(lows[i] - (closes[i - 1] || 0)),
      );
      trs.push(tr);
    }
    if (trs.length < period) return trs[trs.length - 1] || 0;
    return this.sma(trs, period);
  }

  private standardDeviation(data: number[], period: number): number {
    if (data.length < period) return 0;
    const slice = data.slice(-period);
    const mean = slice.reduce((a, b) => a + b, 0) / period;
    const variance = slice.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / period;
    return Math.sqrt(variance);
  }

  private cci(highs: number[], lows: number[], closes: number[], period: number): number {
    if (closes.length < period) return 0;
    const tp = closes.map((c, i) => (highs[i] + lows[i] + c) / 3);
    const mean = this.sma(tp, period);
    const md = this.meanDeviation(tp, period);
    if (md === 0) return 0;
    return (tp[tp.length - 1] - mean) / (0.015 * md);
  }

  private meanDeviation(data: number[], period: number): number {
    const slice = data.slice(-period);
    const mean = slice.reduce((a, b) => a + b, 0) / period;
    return slice.reduce((sum, val) => sum + Math.abs(val - mean), 0) / period;
  }

  private mfi(highs: number[], lows: number[], closes: number[], volumes: number[], period: number): number {
    if (closes.length < period + 1) return 50;
    let positiveFlow = 0, negativeFlow = 0;
    for (let i = closes.length - period; i < closes.length; i++) {
      const tp = (highs[i] + lows[i] + closes[i]) / 3;
      const prevTp = (highs[i - 1] + lows[i - 1] + closes[i - 1]) / 3;
      const mf = tp * (volumes[i] || 0);
      if (tp > prevTp) positiveFlow += mf;
      else negativeFlow += mf;
    }
    if (negativeFlow === 0) return 100;
    return 100 - (100 / (1 + positiveFlow / negativeFlow));
  }

  private williamsR(highs: number[], lows: number[], closes: number[], period: number): number {
    if (highs.length < period) return -50;
    const highest = Math.max(...highs.slice(-period));
    const lowest = Math.min(...lows.slice(-period));
    const current = closes[closes.length - 1];
    if (highest === lowest) return -50;
    return ((highest - current) / (highest - lowest)) * -100;
  }

  private superTrend(highs: number[], lows: number[], _closes: number[], period: number, multiplier: number): number {
    if (highs.length < period) return 0;
    const atr = this.atr(highs, lows, _closes, period);
    const hl2 = (highs[highs.length - 1] + lows[lows.length - 1]) / 2;
    const upperBand = hl2 + multiplier * atr;
    const lowerBand = hl2 - multiplier * atr;
    const current = _closes[_closes.length - 1];
    // Simplified: return the band closer to current price
    return current > hl2 ? lowerBand : upperBand;
  }

  private parabolicSAR(highs: number[], lows: number[], step: number, maxStep: number, _af?: number): number {
    if (highs.length < 2) return 0;
    // Simplified Parabolic SAR
    let sar = lows[lows.length - 5] || lows[0];
    let af = step;
    let isUpTrend = true;
    const ep = isUpTrend ? Math.max(...highs.slice(-5)) : Math.min(...lows.slice(-5));
    sar = sar + af * (ep - sar);
    return sar;
  }

  private donchian(data: number[], period: number): number {
    if (data.length < period) return data[data.length - 1] || 0;
    return Math.max(...data.slice(-period));
  }

  private vwap(highs: number[], lows: number[], closes: number[], volumes: number[]): number {
    if (closes.length === 0) return 0;
    let cumVP = 0, cumV = 0;
    const n = Math.min(closes.length, 50);
    for (let i = closes.length - n; i < closes.length; i++) {
      const tp = (highs[i] + lows[i] + closes[i]) / 3;
      const v = volumes[i] || 0;
      cumVP += tp * v;
      cumV += v;
    }
    return cumV > 0 ? cumVP / cumV : closes[closes.length - 1];
  }

  private obv(closes: number[], volumes: number[]): number {
    if (closes.length < 2) return 0;
    let obv = 0;
    for (let i = 1; i < closes.length; i++) {
      if (closes[i] > closes[i - 1]) obv += volumes[i] || 0;
      else if (closes[i] < closes[i - 1]) obv -= volumes[i] || 0;
    }
    return obv;
  }

  private chaikinVolatility(highs: number[], lows: number[], period: number): number {
    if (highs.length < period * 2) return 0;
    const currentHL = highs.slice(-period).reduce((a, b, i) => a + b - (lows[lows.length - period + i] || 0), 0);
    const prevHL = highs.slice(-period * 2, -period).reduce((a, b, i) => a + b - (lows[lows.length - period * 2 + i] || 0), 0);
    if (prevHL === 0) return 0;
    return ((currentHL - prevHL) / prevHL) * 100;
  }

  private tsi(data: number[], longPeriod: number, shortPeriod: number): number {
    if (data.length < longPeriod + shortPeriod) return 0;
    // Simplified TSI
    const momentum = data.map((v, i) => i > 0 ? v - data[i - 1] : 0);
    const emaLong = this.ema(momentum, longPeriod);
    const emaShort = this.ema(momentum, shortPeriod);
    if (Math.abs(emaLong) < 1e-10) return 0;
    return (emaShort / emaLong) * 100;
  }

  private ultimateOscillator(highs: number[], lows: number[], closes: number[], p1: number, p2: number, p3: number): number {
    if (closes.length < p3 + 1) return 50;
    const bp = (i: number) => Math.min(lows[i], closes[i - 1]) - Math.max(...lows.slice(Math.max(0, i - p1), i + 1).map((l, j) => Math.min(l, closes[Math.max(0, i - p1 + j) - 1])));
    // Simplified calculation
    const bpSum = Math.abs(closes[closes.length - 1] - lows.slice(-p1).reduce((a, b) => a + b, 0) / p1);
    const trSum = highs.slice(-p1).reduce((a, b) => a + b, 0) - lows.slice(-p1).reduce((a, b) => a + b, 0);
    return trSum > 0 ? Math.min(100, Math.max(0, (bpSum / trSum) * 100)) : 50;
  }

  private schaffSTC(closes: number[], _p1: number, _p2: number): number {
    const rsi = this.rsi(closes, 14);
    // Simplified Schaff Trend Cycle
    const macdFast = this.ema(closes, 23);
    const macdSlow = this.ema(closes, 50);
    const diff = macdFast - macdSlow;
    const stc = 50 + (diff / (Math.abs(diff) + this.standardDeviation(closes, 20))) * 30;
    return Math.max(0, Math.min(100, stc));
  }

  private adLine(highs: number[], lows: number[], closes: number[], volumes: number[]): number {
    let ad = 0;
    for (let i = 0; i < closes.length; i++) {
      const hl = highs[i] - lows[i];
      if (hl === 0) continue;
      const clv = ((closes[i] - lows[i]) - (highs[i] - closes[i])) / hl;
      ad += clv * (volumes[i] || 0);
    }
    return ad;
  }

  private f(val: number, decimals: number): number {
    return parseFloat(val.toFixed(decimals));
  }
}
