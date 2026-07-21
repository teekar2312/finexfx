import { NextResponse } from 'next/server'
import { getLLMProviderInfo } from '@/lib/llm-provider'
import { getLLMUsageStats } from '@/lib/llm-usage'

export const dynamic = 'force-dynamic'

/**
 * GET /api/health/llm-info
 * Returns the current LLM provider configuration + usage stats for the settings UI.
 */
export async function GET() {
  const info = getLLMProviderInfo()
  const usage = getLLMUsageStats()

  return NextResponse.json({ ...info, usage })
}