// Unit tests for market.ts — P&L calculation, pip distance, lot sizing.
// These are the most critical business logic: incorrect P&L = wrong money.
//
// NOTE: priceAt, bidAsk, sparkline, dayHighLow, changePct24h are now async
// and fetch live prices from the MT5 bridge. They require integration tests
// with a mock bridge — not unit tests. Only calcPnl and calcLotSize (pure
// math, sync) are unit-tested here.

import { test, describe, expect } from 'bun:test'
import { calcPnl, calcLotSize } from '../src/lib/market-math'

describe('calcPnl', () => {
  test('BUY profit when price goes up', () => {
    // EURUSD buy 0.10 lot, open 1.0850, close 1.0860 → +10 pips
    // valuePerPip = 0.10 × 100000 × 0.0001 = $1/pip → 10 pips = $10
    const { pnl, pips } = calcPnl('EURUSD', 'buy', 0.10, 1.0850, 1.0860)
    expect(pips).toBe(10)
    expect(pnl).toBeGreaterThan(0)
    expect(pnl).toBe(10)
  })

  test('BUY loss when price goes down', () => {
    const { pnl, pips } = calcPnl('EURUSD', 'buy', 0.10, 1.0850, 1.0840)
    expect(pips).toBe(-10)
    expect(pnl).toBe(-10)
  })

  test('SELL profit when price goes down', () => {
    const { pnl, pips } = calcPnl('EURUSD', 'sell', 0.10, 1.0850, 1.0840)
    expect(pips).toBe(10)
    expect(pnl).toBe(10)
  })

  test('SELL loss when price goes up', () => {
    const { pnl, pips } = calcPnl('EURUSD', 'sell', 0.10, 1.0850, 1.0860)
    expect(pips).toBe(-10)
    expect(pnl).toBe(-10)
  })

  test('zero P&L when open == close', () => {
    const { pnl, pips } = calcPnl('EURUSD', 'buy', 0.50, 1.0850, 1.0850)
    expect(pips).toBe(0)
    expect(pnl).toBe(0)
  })

  test('XAUUSD P&L uses 100 oz contract size', () => {
    // XAUUSD buy 1.0 lot, open 2335, close 2345 → +100 pips (pip=0.1)
    const { pnl, pips } = calcPnl('XAUUSD', 'buy', 1.0, 2335.0, 2345.0)
    expect(pips).toBe(100)
    // valuePerPip = 1.0 lot × 100 oz × 0.1 pip = $10 per pip → 100 pips = $1000
    expect(pnl).toBe(1000)
  })

  test('larger lot = proportionally larger P&L', () => {
    const small = calcPnl('EURUSD', 'buy', 0.10, 1.0850, 1.0860)
    const large = calcPnl('EURUSD', 'buy', 1.00, 1.0850, 1.0860)
    expect(large.pnl).toBe(small.pnl * 10)
  })

  test('USDJPY P&L divides by close price (quote currency)', () => {
    // USDJPY buy 0.10 lot, open 156.00, close 156.10 → +10 pips (pip=0.01)
    // valuePerPip = (0.10 × 100000 × 0.01) / 156.10 ≈ $0.641/pip
    const { pnl, pips } = calcPnl('USDJPY', 'buy', 0.10, 156.00, 156.10)
    expect(pips).toBe(10)
    expect(pnl).toBeGreaterThan(0)
    // 10 pips × ~$0.641/pip ≈ $6.41
    expect(pnl).toBeCloseTo(6.41, 1)
  })
})

describe('calcLotSize', () => {
  test('calculates lot from risk %, balance, SL pips', () => {
    // Balance $10000, risk 1% = $100, SL 10 pips
    // EURUSD: valuePerPipPerLot = 100000 × 0.0001 = $10
    // lot = 100 / (10 × 10) = 1.0
    const lot = calcLotSize('EURUSD', 10000, 1.0, 10)
    expect(lot).toBeGreaterThan(0)
    expect(lot).toBeLessThanOrEqual(1.0)
  })

  test('returns minimum 0.01 lot', () => {
    // Very small risk + very wide SL → should floor at 0.01
    const lot = calcLotSize('EURUSD', 100, 0.1, 500)
    expect(lot).toBeGreaterThanOrEqual(0.01)
  })

  test('larger balance allows larger lot', () => {
    const small = calcLotSize('EURUSD', 1000, 1.0, 10)
    const large = calcLotSize('EURUSD', 100000, 1.0, 10)
    expect(large).toBeGreaterThan(small)
  })
})
