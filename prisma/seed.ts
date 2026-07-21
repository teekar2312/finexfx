import { db } from '../src/lib/db'

const SYMBOLS = ['EURUSD', 'USDJPY', 'GBPUSD', 'XAUUSD']

// ===== Indicator Pool (scalping-optimized) =====
const INDICATORS = [
  { name: 'EMA', category: 'trend', description: 'Exponential Moving Average — responsive trend filter for scalping.', defaultParams: JSON.stringify({ fast: 9, medium: 21, slow: 50 }), scalpingPreset: JSON.stringify({ fast: 8, medium: 21, slow: 50 }) },
  { name: 'SMA', category: 'trend', description: 'Simple Moving Average — baseline trend reference.', defaultParams: JSON.stringify({ period: 20 }), scalpingPreset: JSON.stringify({ period: 20 }) },
  { name: 'VWAP', category: 'trend', description: 'Volume Weighted Average Price — intraday fair value anchor.', defaultParams: JSON.stringify({ anchor: 'session' }), scalpingPreset: JSON.stringify({ anchor: 'session' }) },
  { name: 'Supertrend', category: 'trend', description: 'ATR-based trend follower with clear flip signals.', defaultParams: JSON.stringify({ atrPeriod: 10, multiplier: 3 }), scalpingPreset: JSON.stringify({ atrPeriod: 10, multiplier: 2.5 }) },
  { name: 'Parabolic SAR', category: 'trend', description: 'Stop-and-reverse trailing dots for trend exits.', defaultParams: JSON.stringify({ step: 0.02, max: 0.2 }), scalpingPreset: JSON.stringify({ step: 0.02, max: 0.2 }) },
  { name: 'Ichimoku Cloud', category: 'trend', description: 'Multi-line equilibrium system for trend & support.', defaultParams: JSON.stringify({ conversion: 9, base: 26, span: 52 }), scalpingPreset: JSON.stringify({ conversion: 7, base: 22, span: 44 }) },
  { name: 'Hull Moving Average', category: 'trend', description: 'HMA — smoothed, low-lag trend line.', defaultParams: JSON.stringify({ period: 16 }), scalpingPreset: JSON.stringify({ period: 14 }) },
  { name: 'RSI', category: 'oscillator', description: 'Relative Strength Index — momentum & overbought/oversold.', defaultParams: JSON.stringify({ period: 14 }), scalpingPreset: JSON.stringify({ period: 7 }) },
  { name: 'Stochastic Oscillator', category: 'oscillator', description: '%K/%D momentum oscillator for reversals.', defaultParams: JSON.stringify({ k: 14, d: 3, smooth: 3 }), scalpingPreset: JSON.stringify({ k: 9, d: 3, smooth: 3 }) },
  { name: 'MACD', category: 'oscillator', description: 'Moving Average Convergence Divergence — momentum & trend.', defaultParams: JSON.stringify({ fast: 12, slow: 26, signal: 9 }), scalpingPreset: JSON.stringify({ fast: 8, slow: 21, signal: 5 }) },
  { name: 'CCI', category: 'oscillator', description: 'Commodity Channel Index — cyclical momentum.', defaultParams: JSON.stringify({ period: 20 }), scalpingPreset: JSON.stringify({ period: 14 }) },
  { name: 'Momentum Indicator', category: 'oscillator', description: 'Rate of price change over N bars.', defaultParams: JSON.stringify({ period: 10 }), scalpingPreset: JSON.stringify({ period: 7 }) },
  { name: "Williams %R", category: 'oscillator', description: 'Williams Percent Range — overbought/oversold.', defaultParams: JSON.stringify({ period: 14 }), scalpingPreset: JSON.stringify({ period: 7 }) },
  { name: 'TSI', category: 'oscillator', description: 'True Strength Index — double-smoothed momentum.', defaultParams: JSON.stringify({ long: 25, short: 13, signal: 13 }), scalpingPreset: JSON.stringify({ long: 20, short: 10, signal: 8 }) },
  { name: 'ROC', category: 'oscillator', description: 'Rate of Change — % change over N bars.', defaultParams: JSON.stringify({ period: 12 }), scalpingPreset: JSON.stringify({ period: 6 }) },
  { name: 'Schaff Trend Cycle', category: 'oscillator', description: 'STC — MACD + stochastic cycle fusion.', defaultParams: JSON.stringify({ cycle: 10, fast: 23, slow: 50 }), scalpingPreset: JSON.stringify({ cycle: 10, fast: 20, slow: 50 }) },
  { name: 'Ultimate Oscillator', category: 'oscillator', description: 'Multi-period weighted momentum.', defaultParams: JSON.stringify({ p1: 7, p2: 14, p3: 28 }), scalpingPreset: JSON.stringify({ p1: 5, p2: 10, p3: 20 }) },
  { name: 'Bollinger Bands', category: 'volatility', description: 'Mean-reversion bands via std-dev.', defaultParams: JSON.stringify({ period: 20, std: 2 }), scalpingPreset: JSON.stringify({ period: 20, std: 2 }) },
  { name: 'ATR', category: 'volatility', description: 'Average True Range — SL sizing & volatility gauge.', defaultParams: JSON.stringify({ period: 14 }), scalpingPreset: JSON.stringify({ period: 10 }) },
  { name: 'Standard Deviation', category: 'volatility', description: 'Price dispersion for regime detection.', defaultParams: JSON.stringify({ period: 20 }), scalpingPreset: JSON.stringify({ period: 14 }) },
  { name: 'Chaikin Volatility', category: 'volatility', description: 'EMA-based rate of volatility change.', defaultParams: JSON.stringify({ period: 10, roc: 10 }), scalpingPreset: JSON.stringify({ period: 7, roc: 5 }) },
  { name: 'Volatility Ratio', category: 'volatility', description: 'Current TR / ATR — breakout filter.', defaultParams: JSON.stringify({ period: 14 }), scalpingPreset: JSON.stringify({ period: 10 }) },
  { name: 'Keltner Channel', category: 'channel', description: 'ATR-based channel around EMA.', defaultParams: JSON.stringify({ ema: 20, atr: 10, mult: 2 }), scalpingPreset: JSON.stringify({ ema: 20, atr: 10, mult: 1.8 }) },
  { name: 'Donchian Channel', category: 'channel', description: 'N-period high/low breakout channel.', defaultParams: JSON.stringify({ period: 20 }), scalpingPreset: JSON.stringify({ period: 12 }) },
  { name: 'Linear Regression Channel', category: 'regression', description: 'Best-fit channel with std-dev bounds.', defaultParams: JSON.stringify({ period: 20, std: 2 }), scalpingPreset: JSON.stringify({ period: 14, std: 2 }) },
  { name: 'OBV', category: 'volume', description: 'On Balance Volume — cumulative volume flow.', defaultParams: JSON.stringify({}), scalpingPreset: JSON.stringify({}) },
  { name: 'Money Flow Index', category: 'volume', description: 'MFI — volume-weighted RSI.', defaultParams: JSON.stringify({ period: 14 }), scalpingPreset: JSON.stringify({ period: 10 }) },
  { name: 'Tick Volume', category: 'volume', description: 'MT5 tick volume proxy for liquidity bursts.', defaultParams: JSON.stringify({}), scalpingPreset: JSON.stringify({}) },
  { name: 'Volume Profile', category: 'volume', description: 'Horizontal volume distribution (POC/VAH/VAL).', defaultParams: JSON.stringify({ sessions: 5 }), scalpingPreset: JSON.stringify({ sessions: 3 }) },
  { name: 'Accumulation Distribution', category: 'volume', description: 'Chaikin A/D — money flow line.', defaultParams: JSON.stringify({}), scalpingPreset: JSON.stringify({}) },
]

const RISK_DEFAULTS: Record<string, string> = {
  riskPerTradePct: '0.75',        // 0.5 - 1
  stopLossPipsMin: '5',
  stopLossPipsMax: '15',
  riskRewardRatio: '1.5',          // 1:1.5
  maxOpenPositions: '3',
  dailyRiskLimitPct: '2.5',        // 2 - 3
  dailyTargetPct: '2',             // 1 - 3
  avoidHighImpactNews: 'true',
  autoSelectPair: 'true',
  autoSelectTimeframe: 'true',
  autoSelectIndicators: 'true',
  tradingSessions: 'london,overlap',
  autoTradingEnabled: 'false',
  autoTradeConfidenceThreshold: '70',  // min AI confidence % for auto-execute
  autoTradeSignalMaxAgeMin: '10',      // max age (minutes) for auto-trade signals
  trailingStopMode: 'auto',        // manual | auto
  trailingStopPips: '5',
  mlSelfLearning: 'true',
  brokerSpreadMajorFromPip: '0.0',
  brokerCommissionPerLot: '2.5',
  brokerMaxLeverage: '1:100',
}

const SYSTEM_CONFIG_DEFAULTS: Record<string, string> = {
  brokerName: 'FINEX Indonesia',
  brokerServer: 'Finex-Live',
  mt5Path: 'C:\\Program Files\\Finex MetaTrader 5\\terminal64.exe',
  pythonVersion: '3.14',
  finnhubApiKey: 'demo',
  marketauxApiKey: 'demo',
  emailEnabled: 'true',
  emailRecipient: 'trader@example.com',
  emailSmtpHost: 'smtp.example.com',
  emailSmtpPort: '587',
  newsRefreshMinutes: '15',
}

async function main() {
  console.log('🌱 Seeding database (real trading defaults)...')

  // NOTE: No demo accounts are seeded. In real trading mode, users add their
  // live MT5 accounts via the Settings panel. The dashboard starts empty.

  // Indicators — these are the scalping indicator pool (configuration, not data).
  const existingIndicators = await db.indicator.count()
  if (existingIndicators === 0) {
    await db.indicator.createMany({
      data: INDICATORS.map((i, idx) => ({
        name: i.name,
        category: i.category,
        description: i.description,
        defaultParams: i.defaultParams,
        scalpingPreset: i.scalpingPreset,
        enabled: idx < 12, // first 12 (core scalping set) enabled by default
        autoManaged: idx < 12,
        weight: 1 - idx * 0.02,
      })),
    })
    console.log(`  ✓ ${INDICATORS.length} indicators`)
  }

  // Risk settings — default risk management configuration.
  const existingRisk = await db.riskSetting.count()
  if (existingRisk === 0) {
    await db.riskSetting.createMany({
      data: Object.entries(RISK_DEFAULTS).map(([key, value]) => ({ key, value })),
    })
    console.log('  ✓ risk settings')
  }

  // System config — broker/API/email configuration defaults.
  const existingConfig = await db.systemConfig.count()
  if (existingConfig === 0) {
    await db.systemConfig.createMany({
      data: Object.entries(SYSTEM_CONFIG_DEFAULTS).map(([key, value]) => ({ key, value })),
    })
    console.log('  ✓ system config')
  }

  // NOTE: No sample news, AI signals, or logs are seeded.
  // In real trading mode:
  //   - News is fetched from real news APIs (Finnhub/MARKETAUX) or LLM synthesis
  //   - AI signals are generated on-demand by the LLM analysis endpoint
  //   - Logs are created by actual system events (trade opens, risk alerts, etc.)

  console.log('✅ Seed complete')
  console.log('   → Add your live MT5 account via Settings → Account Management')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
