import { NextRequest, NextResponse } from 'next/server'
import { getTick } from '@/lib/mt5-client'
import { SUPPORTED_SYMBOLS } from '@/lib/types'

export const dynamic = 'force-dynamic'

/**
 * GET /api/mt5/tick?symbol=EURUSD
 *
 * Returns current bid/ask for a symbol from the MT5 bridge.
 * Returns 503 if the bridge is offline (no synthetic fallback in real trading mode).
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const symbol = searchParams.get('symbol')
    if (!symbol || !SUPPORTED_SYMBOLS.includes(symbol as any)) {
      return NextResponse.json({ error: 'Valid symbol is required' }, { status: 400 })
    }

    const tick = await getTick(symbol)
    if (tick) {
      return NextResponse.json({
        tick,
        source: 'mt5-bridge',
      })
    }

    // Bridge offline or symbol not found
    return NextResponse.json(
      {
        error: `MT5 bridge offline or symbol ${symbol} not available`,
        hint: 'Ensure the mt5-bridge service is running and connected to the MT5 terminal',
      },
      { status: 503 },
    )
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Failed to fetch tick' },
      { status: 500 },
    )
  }
}
