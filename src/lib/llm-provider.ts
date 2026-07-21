import 'server-only'
import { recordLLMCall } from './llm-usage'

// ─── Types ────────────────────────────────────────────────────────────────────

export type LLMProvider = 'ollama' | 'openai' | 'groq' | 'z-ai'

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface CallLLMOptions {
  temperature?: number
  maxTokens?: number
  /** Override the default timeout (ms). Providers default: ollama=120000, cloud=30000 */
  timeout?: number
  /** Override the model name */
  model?: string
}

export interface LLMResponse {
  content: string
}

export interface LLMProviderInfo {
  provider: LLMProvider
  model: string
  available: boolean
}

// ─── Config ───────────────────────────────────────────────────────────────────

const DEFAULT_TIMEOUTS: Record<LLMProvider, number> = {
  ollama: 120_000,
  openai: 30_000,
  groq: 30_000,
  'z-ai': 30_000,
}

function resolveProvider(): LLMProvider {
  const raw = process.env.LLM_PROVIDER?.trim().toLowerCase()
  if (raw === 'openai' || raw === 'groq' || raw === 'z-ai' || raw === 'ollama') return raw
  return 'ollama'
}

function resolveModel(provider: LLMProvider): string {
  switch (provider) {
    case 'ollama':
      return process.env.OLLAMA_MODEL?.trim() || 'llama3.1'
    case 'openai':
      return process.env.OPENAI_MODEL?.trim() || 'gpt-4o-mini'
    case 'groq':
      return process.env.GROQ_MODEL?.trim() || 'llama-3.3-70b-versatile'
    case 'z-ai':
      return 'z-ai-default'
  }
}

function providerAvailable(provider: LLMProvider): boolean {
  switch (provider) {
    case 'ollama':
      return !!process.env.OLLAMA_BASE_URL?.trim()
    case 'openai':
      return !!process.env.OPENAI_API_KEY?.trim()
    case 'groq':
      return !!process.env.GROQ_API_KEY?.trim()
    case 'z-ai':
      // z-ai SDK is always available in the sandbox
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        require('z-ai-web-dev-sdk')
        return true
      } catch {
        return false
      }
  }
}

function getBaseUrl(provider: LLMProvider): string {
  switch (provider) {
    case 'ollama':
      return (process.env.OLLAMA_BASE_URL?.trim() || 'http://localhost:11434').replace(/\/+$/, '')
    case 'openai':
      return 'https://api.openai.com/v1'
    case 'groq':
      return 'https://api.groq.com/openai/v1'
    default:
      throw new Error(`getBaseUrl not supported for provider: ${provider}`)
  }
}

function getApiKey(provider: LLMProvider): string | undefined {
  switch (provider) {
    case 'openai':
      return process.env.OPENAI_API_KEY?.trim()
    case 'groq':
      return process.env.GROQ_API_KEY?.trim()
    case 'ollama':
      // Ollama typically has no auth; but allow OLLAMA_API_KEY if needed
      return process.env.OLLAMA_API_KEY?.trim() || undefined
    default:
      return undefined
  }
}

// ─── OpenAI-compatible HTTP call (ollama / openai / groq) ────────────────────

async function callOpenAICompatible(
  provider: LLMProvider,
  messages: ChatMessage[],
  options: CallLLMOptions,
): Promise<LLMResponse> {
  const baseUrl = getBaseUrl(provider)
  const apiKey = getApiKey(provider)
  const model = options.model || resolveModel(provider)
  const timeout = options.timeout ?? DEFAULT_TIMEOUTS[provider]

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)

  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        messages,
        temperature: options.temperature ?? 0.4,
        max_tokens: options.maxTokens,
        stream: false,
      }),
      signal: controller.signal,
    })

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      // Provide actionable hints for common errors
      let hint = ''
      if (body.includes('decommissioned') || body.includes('does not exist')) {
        const defaults: Record<string, string> = {
          groq: 'llama-3.3-70b-versatile',
          openai: 'gpt-4o-mini',
          ollama: 'llama3.1',
        }
        const defaultModel = defaults[provider] || '(check provider docs)'
        hint = ` → Model "${model}" is no longer available. Try setting ${provider === 'groq' ? 'GROQ' : provider === 'openai' ? 'OPENAI' : 'OLLAMA'}_MODEL=${defaultModel} in your .env file.`
      }
      throw new Error(
        `LLM ${provider} error ${res.status}: ${body.slice(0, 300)}${hint}`,
      )
    }

    const json = await res.json()
    const content: string =
      json.choices?.[0]?.message?.content ??
      json.choices?.[0]?.delta?.content ??
      ''

    return { content }
  } finally {
    clearTimeout(timer)
  }
}

// ─── z-ai SDK call (sandbox only) ────────────────────────────────────────────

async function callZAI(
  messages: ChatMessage[],
  options: CallLLMOptions,
): Promise<LLMResponse> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const ZAI = require('z-ai-web-dev-sdk').default
  const zai = await ZAI.create()

  const timeout = options.timeout ?? DEFAULT_TIMEOUTS['z-ai']

  const res = await Promise.race([
    zai.chat.completions.create({
      messages,
      temperature: options.temperature ?? 0.4,
      ...(options.maxTokens ? { max_tokens: options.maxTokens } : {}),
    }),
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error(`z-ai SDK timed out after ${timeout}ms`)),
        timeout,
      ),
    ),
  ])

  const content: string = res.choices?.[0]?.message?.content ?? ''

  return { content }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Call an LLM with the configured provider.
 *
 * Returns `{ content: string }` or throws on failure.
 * The response is normalised regardless of which provider is active.
 */
export async function callLLM(
  messages: ChatMessage[],
  options: CallLLMOptions = {},
): Promise<LLMResponse> {
  const provider = resolveProvider()
  const start = Date.now()

  // Early availability check — give a clear error instead of a cryptic one
  if (!providerAvailable(provider)) {
    const hints: Record<LLMProvider, string> = {
      ollama: 'Set OLLAMA_BASE_URL (e.g. http://localhost:11434)',
      openai: 'Set OPENAI_API_KEY',
      groq: 'Set GROQ_API_KEY',
      'z-ai': 'z-ai-web-dev-sdk is not installed — this provider only works in the sandbox',
    }
    const err = new Error(
      `LLM provider "${provider}" is not configured. ${hints[provider]}`,
    )
    recordLLMCall({ ok: false, latencyMs: Date.now() - start, error: err.message })
    throw err
  }

  try {
    let result: LLMResponse
    if (provider === 'z-ai') {
      result = await callZAI(messages, options)
    } else {
      result = await callOpenAICompatible(provider, messages, options)
    }
    // Record success
    recordLLMCall({ ok: true, latencyMs: Date.now() - start })
    return result
  } catch (e: any) {
    // Record failure
    recordLLMCall({ ok: false, latencyMs: Date.now() - start, error: e.message })
    throw e
  }
}

/**
 * Return provider info for the settings UI:
 * which provider is active, which model, and whether it appears available.
 */
export function getLLMProviderInfo(): LLMProviderInfo {
  const provider = resolveProvider()
  return {
    provider,
    model: resolveModel(provider),
    available: providerAvailable(provider),
  }
}