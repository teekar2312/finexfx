import { NextResponse } from 'next/server'
import { evaluatePendingSignals, evaluateSignalOutcome } from '@/lib/ai-evaluation'

export const dynamic = 'force-dynamic'

/**
 * POST /api/ai/evaluate
 *
 * Evaluates pending AI signals — compares predicted direction with actual
 * price movement after the hold period. Creates AiSignalOutcome records.
 *
 * Body (optional): { signalId?: string }
 *   - If signalId provided: evaluates that specific signal
 *   - If no signalId: evaluates ALL pending signals (batch mode, max 50)
 *
 * Protected by proxy.ts matcher exclusion (internal service only).
 */
export async function POST(req: Request) {

  try {
    const body = await req.json().catch(() => ({}))
    const signalId = body?.signalId

    if (signalId) {
      // Evaluate single signal
      const result = await evaluateSignalOutcome(signalId)
      return NextResponse.json({
        signalId,
        result,
      })
    }

    // Batch evaluate all pending signals
    const result = await evaluatePendingSignals()
    return NextResponse.json({
      batch: true,
      ...result,
    })
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Failed to evaluate signals' },
      { status: 500 },
    )
  }
}
