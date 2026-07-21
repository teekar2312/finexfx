// LLM usage tracking — shared between llm-provider.ts and the API route.
// Uses in-memory counters (reset on server restart).

let totalCalls = 0
let successCalls = 0
let failedCalls = 0
let lastCallTime: number | null = null
let lastCallLatencyMs: number | null = null
let lastCallError: string | null = null

export interface LLMUsageStats {
  totalCalls: number
  successCalls: number
  failedCalls: number
  successRate: number
  lastCallTime: string | null
  lastCallLatencyMs: number | null
  lastCallError: string | null
}

export function recordLLMCall(result: { ok: boolean; latencyMs: number; error?: string }) {
  totalCalls++
  if (result.ok) {
    successCalls++
  } else {
    failedCalls++
    lastCallError = result.error ?? null
  }
  lastCallTime = Date.now()
  lastCallLatencyMs = result.latencyMs
}

export function getLLMUsageStats(): LLMUsageStats {
  return {
    totalCalls,
    successCalls,
    failedCalls,
    successRate: totalCalls > 0 ? Number(((successCalls / totalCalls) * 100).toFixed(1)) : 0,
    lastCallTime: lastCallTime ? new Date(lastCallTime).toISOString() : null,
    lastCallLatencyMs,
    lastCallError,
  }
}