import { NextResponse } from 'next/server'
import { bidAsk, priceAt, sparkline, dayHighLow, changePct24h } from '@/lib/market'
import { SUPPORTED_SYMBOLS, SYMBOL_BASE, type SymbolQuote } from '@/lib/types'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const symbols: SymbolQuote[] = await Promise.all(
      SUPPORTED_SYMBOLS.map(async (sym) => {
        const [{ bid, ask, spread }, price, spark, { high, low }, changePct] = await Promise.all([
          bidAsk(sym),
          priceAt(sym),
          sparkline(sym, 40),
          dayHighLow(sym),
          changePct24h(sym),
        ])
        return {
          symbol: sym,
          price,
          bid,
          ask,
          spread,
          changePct,
          high,
          low,
          pip: SYMBOL_BASE[sym].pip,
          spark,
          updatedAt: new Date().toISOString(),
        }
      }),
    )

    return NextResponse.json({ symbols })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
