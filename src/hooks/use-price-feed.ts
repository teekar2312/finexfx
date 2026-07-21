'use client'

import { create } from 'zustand'
import { useEffect, useRef } from 'react'
import { io, Socket } from 'socket.io-client'
import { toast } from 'sonner'
import type { SymbolQuote } from '@/lib/types'

export interface TickerState {
  symbol: string
  price: number
  bid: number
  ask: number
  spread: number
  changePct: number
  spark: number[]
  updatedAt: number
  dir: 'up' | 'down' | 'flat'
}

interface FeedStore {
  connected: boolean
  tickers: Record<string, TickerState>
  systemStatus: { sessions: any[]; scalpingWindow: boolean; uptime?: number } | null
  lastEvent: { type: string; payload: any; ts: number } | null
  bridgeStatus: 'online' | 'degraded' | 'unknown'
  setConnected: (v: boolean) => void
  applyTick: (symbols: any[], ts: number) => void
  setSystemStatus: (s: any) => void
  setLastEvent: (e: { type: string; payload: any; ts: number }) => void
  setBridgeStatus: (status: 'online' | 'degraded' | 'unknown') => void
}

export const useFeed = create<FeedStore>((set, get) => ({
  connected: false,
  tickers: {},
  systemStatus: null,
  lastEvent: null,
  bridgeStatus: 'unknown',
  setConnected: (v) => set({ connected: v }),
  applyTick: (symbols, ts) =>
    set((state) => {
      const next = { ...state.tickers }
      for (const s of symbols) {
        const prev = next[s.symbol]
        const dir: TickerState['dir'] = prev ? (s.price > prev.price ? 'up' : s.price < prev.price ? 'down' : 'flat') : 'flat'
        next[s.symbol] = {
          symbol: s.symbol,
          price: s.price,
          bid: s.bid,
          ask: s.ask,
          spread: s.spread,
          changePct: s.changePct,
          spark: s.spark ?? prev?.spark ?? [],
          updatedAt: ts,
          dir,
        }
      }
      return { tickers: next }
    }),
  setSystemStatus: (s) => set({ systemStatus: s }),
  setLastEvent: (e) => set({ lastEvent: e }),
  setBridgeStatus: (status) => set({ bridgeStatus: status }),
}))

let socket: Socket | null = null
let refCount = 0

export function usePriceFeed() {
  const wasConnected = useRef(false)
  useEffect(() => {
    refCount++
    if (!socket) {
      // On cloud/sandbox: Caddy gateway forwards ?XTransformPort=3003 to port 3003
      // On local Windows: connect directly to price-feed service (no Caddy)
      const feedUrl = process.env.NEXT_PUBLIC_PRICE_FEED_URL || '/?XTransformPort=3003'
      socket = io(feedUrl, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 10000,
      })

      socket.on('connect', () => {
        useFeed.getState().setConnected(true)
        wasConnected.current = true
      })
      socket.on('disconnect', (reason: string) => {
        useFeed.getState().setConnected(false)
        toast.warning('Price feed disconnected', { description: `Reconnecting... (${reason})` })
      })
      socket.on('reconnect', (attempt: number) => {
        useFeed.getState().setConnected(true)
        toast.success('Price feed reconnected', { description: `After ${attempt} attempts` })
      })
      socket.on('reconnect_error', () => {
        // Silent — toast on disconnect is enough, don't spam on every retry
      })

      socket.on('welcome', (data: any) => {
        if (data?.symbols) useFeed.getState().applyTick(data.symbols, Date.now())
        useFeed.getState().setConnected(true)
      })

      socket.on('tick', (data: any) => {
        if (data?.symbols) useFeed.getState().applyTick(data.symbols, data.ts ?? Date.now())
      })

      socket.on('system-status', (data: any) => useFeed.getState().setSystemStatus(data))

      socket.on('bridge-status', (data: { status: 'online' | 'degraded'; message?: string }) => {
        const wasDegraded = useFeed.getState().bridgeStatus === 'degraded'
        useFeed.getState().setBridgeStatus(data.status)
        if (data.status === 'degraded') {
          toast.warning('MT5 Bridge Offline', { description: data.message || 'Live prices unavailable' })
        } else if (data.status === 'online' && wasDegraded) {
          toast.success('MT5 Bridge Online', { description: 'Live prices restored' })
        }
      })

      socket.on('trade', (data: any) => useFeed.getState().setLastEvent({ type: 'trade', payload: data, ts: Date.now() }))
      socket.on('ai-signal', (data: any) => useFeed.getState().setLastEvent({ type: 'ai-signal', payload: data, ts: Date.now() }))
      socket.on('news', (data: any) => useFeed.getState().setLastEvent({ type: 'news', payload: data, ts: Date.now() }))
    }

    return () => {
      refCount--
      if (refCount <= 0 && socket) {
        socket.disconnect()
        socket = null
        refCount = 0
        wasConnected.current = false
      }
    }
  }, [])
}

// Helper selectors
export function useTicker(symbol: string): TickerState | undefined {
  return useFeed((s) => s.tickers[symbol])
}

export function useAllTickers(): TickerState[] {
  return useFeed((s) => Object.values(s.tickers))
}
