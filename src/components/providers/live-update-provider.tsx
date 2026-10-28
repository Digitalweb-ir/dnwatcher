'use client'

import React, { createContext, useContext, useEffect, useState, useMemo } from 'react'

interface ServerPulse {
  up: number
  down: number
  avgLatency: number | null
  totalConfigs?: number
}

interface LiveUpdateState {
  serverUpdates: Record<string, Record<string, { ok: boolean; latency_ms: number | null }>>
  serverPulses: Record<string, ServerPulse>
  activeConfigs: Set<number>
  cycleState: any | null
}

interface LiveUpdateContextType {
  updates: LiveUpdateState
  isLive: boolean
  getServerStats: (server: { up_count: number; down_count: number; avg_latency: number | null }, serverId: number) => {
    up: number
    down: number
    avgLatency: number | null
    hasLiveUpdates: boolean
  }
  getConfigStats: (config: { last_status: string | null; last_latency_ms: number | null }, configId: number) => {
    status: string | null
    latency: number | null
    isTesting: boolean
  }
}

const LiveUpdateContext = createContext<LiveUpdateContextType | undefined>(undefined)

export function LiveUpdateProvider({ children }: { children: React.ReactNode }) {
  const [updates, setUpdates] = useState<LiveUpdateState>({
    serverUpdates: {},
    serverPulses: {},
    activeConfigs: new Set(),
    cycleState: null,
  })
  const [isLive, setIsLive] = useState(false)

  const getServerStats = (server: { up_count: number; down_count: number; avg_latency: number | null }, serverId: number) => {
    const pulse = updates.serverPulses[String(serverId)]
    if (!pulse) {
      return { up: server.up_count, down: server.down_count, avgLatency: server.avg_latency, hasLiveUpdates: false }
    }
    return { up: pulse.up, down: pulse.down, avgLatency: pulse.avgLatency, hasLiveUpdates: true }
  }

  const getConfigStats = (config: { last_status: string | null; last_latency_ms: number | null }, configId: number) => {
    const cId = String(configId)
    let liveStatus: string | null = config.last_status
    let liveLatency: number | null = config.last_latency_ms
    let hasLiveUpdate = false

    for (const serverId in updates.serverUpdates) {
      const configUpdate = updates.serverUpdates[serverId][cId]
      if (configUpdate) {
        liveStatus = configUpdate.ok ? 'up' : 'down'
        liveLatency = configUpdate.latency_ms
        hasLiveUpdate = true
        break
      }
    }

    return {
      status: liveStatus,
      latency: liveLatency,
      isTesting: updates.activeConfigs.has(configId),
      hasLiveUpdate,
    }
  }

  useEffect(() => {
    const eventSource = new EventSource('/api/stream')

    eventSource.onopen = () => {
      setIsLive(true)
    }

    eventSource.addEventListener('config:start', (event) => {
      const data = JSON.parse(event.data)
      setUpdates((prev) => {
        const nextActive = new Set(prev.activeConfigs)
        nextActive.add(Number(data.configId))
        return { ...prev, activeConfigs: nextActive }
      })
    })

    eventSource.addEventListener('config:check', (event) => {
      const data = JSON.parse(event.data)
      setUpdates((prev) => {
        const sId = String(data.serverId)
        const cId = String(data.configId)

        const nextActive = new Set(prev.activeConfigs)
        nextActive.delete(Number(data.configId))

        return {
          ...prev,
          activeConfigs: nextActive,
          serverUpdates: {
            ...prev.serverUpdates,
            [sId]: {
              ...(prev.serverUpdates[sId] ?? {}),
              [cId]: { ok: data.ok, latency_ms: data.latency_ms },
            },
          },
        }
      })
    })

    eventSource.addEventListener('server:stats', (event) => {
      const data = JSON.parse(event.data)
      setUpdates((prev) => ({
        ...prev,
        serverPulses: {
          ...prev.serverPulses,
          [String(data.serverId)]: {
            up: data.up,
            down: data.down,
            avgLatency: data.avgLatency,
          },
        },
      }))
    })

    eventSource.addEventListener('server:update', (event) => {
      const data = JSON.parse(event.data)
      setUpdates((prev) => ({
        ...prev,
        serverPulses: {
          ...prev.serverPulses,
          [String(data.serverId)]: {
            up: data.up,
            down: data.down,
            avgLatency: data.avgLatency,
            totalConfigs: data.totalConfigs,
          },
        },
      }))
    })

    eventSource.addEventListener('cycle:state', (event) => {
      const data = JSON.parse(event.data)
      setUpdates((prev) => ({
        ...prev,
        cycleState: data,
        // KEEP existing updates to maintain the last known latency on screen
        activeConfigs: data.running ? new Set() : prev.activeConfigs,
      }))
    })

    eventSource.onerror = (err) => {
      console.error('[SSE] Error:', err)
      setIsLive(false)
    }

    return () => eventSource.close()
  }, [])

  return (
    <LiveUpdateContext.Provider value={{ updates, isLive, getServerStats, getConfigStats }}>
      {children}
    </LiveUpdateContext.Provider>
  )
}

export function useLiveUpdates() {
  const context = useContext(LiveUpdateContext)
  if (context === undefined) {
    throw new Error('useLiveUpdates must be used within a LiveUpdateProvider')
  }
  return context
}