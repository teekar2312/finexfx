import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { logInfo } from '@/lib/logger'
import { requireAdmin } from '@/lib/auth-server'
import { callLLM } from '@/lib/llm-provider'

export const dynamic = 'force-dynamic'

// POST /api/economic-calendar/refresh
// Uses LLM to synthesize fresh upcoming economic events.
export async function POST() {
  const user = await requireAdmin()
  if (user instanceof NextResponse) return user

  let synthesized = 0
  try {
    const { content } = await callLLM(
      [
        {
          role: 'system',
          content: 'You are a forex economic calendar data provider. Output only valid JSON.',
        },
        {
          role: 'user',
          content: `Generate 6 realistic upcoming high-impact forex economic calendar events for the next 10 days.
Include events for US, EU, GB, JP covering categories: interest_rate, nfp, cpi, ppi, gdp, unemployment, retail, pmi, speech.
Each event: { "title": string, "country": "US"|"EU"|"GB"|"JP", "currency": "USD"|"EUR"|"GBP"|"JPY", "category": string, "impact": "low"|"medium"|"high", "eventTime": ISO string (UTC, within next 10 days), "forecast": string|null, "previous": string|null, "symbols": comma-separated from EURUSD,USDJPY,GBPUSD,XAUUSD }
Return ONLY a JSON array. Vary the times during market hours (6:00-20:00 UTC).`,
        },
      ],
      { temperature: 0.5 },
    )
    const match = content.match(/\[[\s\S]*\]/)
    if (match) {
      const items = JSON.parse(match[0])
      for (const item of items) {
        if (!item.title || !item.eventTime || !item.currency) continue
        await db.economicEvent.create({
          data: {
            title: String(item.title).slice(0, 200),
            country: String(item.country || 'US'),
            currency: String(item.currency),
            category: String(item.category || 'other'),
            impact: String(item.impact || 'medium'),
            eventTime: new Date(item.eventTime),
            forecast: item.forecast ? String(item.forecast) : null,
            previous: item.previous ? String(item.previous) : null,
            symbols: String(item.symbols || ''),
            status: 'upcoming',
            source: 'llm-synth',
          },
        })
        synthesized++
      }
    }
  } catch (e: any) {
    console.error('economic-calendar/refresh LLM failed', e.message)
  }

  // Fallback: if LLM produced nothing, insert 3 deterministic items
  if (synthesized === 0) {
    const now = new Date()
    const mk = (days: number, h: number, title: string, country: string, currency: string, category: string, impact: string, symbols: string, forecast?: string, previous?: string) => {
      const d = new Date(now)
      d.setUTCDate(d.getUTCDate() + days)
      d.setUTCHours(h, 0, 0, 0)
      return db.economicEvent.create({
        data: { title, country, currency, category, impact, eventTime: d, symbols, forecast: forecast ?? null, previous: previous ?? null, status: 'upcoming', source: 'llm-synth' },
      })
    }
    await mk(1, 12, 'US Core CPI (MoM)', 'US', 'USD', 'cpi', 'high', 'EURUSD,USDJPY,XAUUSD', '0.3%', '0.3%')
    await mk(2, 18, 'FOMC Interest Rate Decision', 'US', 'USD', 'interest_rate', 'high', 'EURUSD,USDJPY,GBPUSD,XAUUSD', '4.50-4.75%', '4.75-5.00%')
    await mk(3, 6, 'UK CPI (YoY)', 'GB', 'GBP', 'cpi', 'high', 'GBPUSD', '2.1%', '2.2%')
    synthesized = 3
  }

  await logInfo('system', `Economic calendar refreshed: ${synthesized} new events`)

  const events = await db.economicEvent.findMany({
    where: { eventTime: { gte: new Date() } },
    orderBy: { eventTime: 'asc' },
    take: 30,
  })
  return NextResponse.json({ events, added: synthesized })
}