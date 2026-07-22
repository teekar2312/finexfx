import { NextResponse } from 'next/server'
import { getLLMProviderInfo } from '@/lib/llm-provider'
import { getLLMUsageStats } from '@/lib/llm-usage'
import { requireAuth } from '@/lib/auth-server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/health/llm-info
 * Returns the current LLM provider configuration + usage stats for the settings UI.
 */
export async function GET() {
  const user = await requireAuth()
  if (user instanceof NextResponse) return user

  const info = getLLMProviderInfo()
  const usage = getLLMUsageStats()

  return NextResponse.json({ ...info, usage })
}