/**
 * Timeline API — aggregated data for config status bars.
 *
 * GET /api/timeline?window=24h|7d|30d|1y&configIds=1,2,3&serverId=4
 */
import { NextRequest, NextResponse } from 'next/server'

import { listConfigs, timelineCells, configStats } from '@/lib/db/queries'
import type { TimelineCell } from '@/lib/types'

const WINDOWS: Record<string, { bucketMs: number; durationMs: number }> = {
  // Target: ~24 columns per config to minimize horizontal scrolling
  '1h': { bucketMs: 5 * 60 * 1000, durationMs: 1 * 3600 * 1000 }, // 12 columns
  '4h': { bucketMs: 10 * 60 * 1000, durationMs: 4 * 3600 * 1000 }, // 24 columns
  '24h': { bucketMs: 1 * 3600 * 1000, durationMs: 24 * 3600 * 1000 }, // 24 columns
  '7d': { bucketMs: 7 * 3600 * 1000, durationMs: 7 * 24 * 3600 * 1000 }, // ~24 columns
  '30d': { bucketMs: 30 * 3600 * 1000, durationMs: 30 * 24 * 3600 * 1000 }, // ~24 columns
  '1y': { bucketMs: 365 * 3600 * 1000, durationMs: 365 * 24 * 3600 * 1000 }, // ~24 columns
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url)
  const windowKey = searchParams.get('window') ?? '24h'
  const configIdsParam = searchParams.get('configIds')
  const serverIdParam = searchParams.get('serverId')
  const serverId = serverIdParam ? Number(serverIdParam) : undefined

  const window = WINDOWS[windowKey] ?? WINDOWS['24h']
  const now = Date.now()
  const since = now - window.durationMs
  const until = now

  // All configs (including disabled) so row labels are always available
  const allConfigs = listConfigs({ includeDisabled: true, serverId })
  const configById = new Map(allConfigs.map((config) => [config.id, config]))

  let configIds: number[]
  if (configIdsParam) {
    configIds = configIdsParam
      .split(',')
      .map(Number)
      .filter((n) => Number.isFinite(n))
  } else {
    // Only enabled configs are displayed
    configIds = allConfigs.filter((config) => config.enabled === 1).map((config) => config.id)
  }

  const cellsMap = timelineCells({
    since,
    until,
    bucketMs: window.bucketMs,
    configIds,
  })

  const rows: {
    config_id: number
    label: string | null
    server_name: string
    server_id: number
    protocol: string
    cells: TimelineCell[]
    uptime: number | null
    avg_latency: number | null
  }[] = []

  for (const configId of configIds) {
    const cells = cellsMap.get(configId) ?? []
    let total = 0
    let up = 0
    let latSum = 0
    let latCount = 0

    for (const cell of cells) {
      total += cell.total
      up += cell.up
      if (cell.avg_latency !== null) {
        latSum += cell.avg_latency * cell.up
        latCount += cell.up
      }
    }

    const config = configById.get(configId)
    rows.push({
      config_id: configId,
      label: config?.label ?? null,
      server_name: config?.server_name ?? '',
      server_id: config?.server_id ?? 0,
      protocol: config?.protocol ?? '',
      cells,
      uptime: total > 0 ? (up / total) * 100 : null,
      avg_latency: latCount > 0 ? latSum / latCount : null,
    })
  }

  // Sort by server for grouped display in frontend
  rows.sort((a, b) => {
    const serverCompare = a.server_name.localeCompare(b.server_name)
    if (serverCompare !== 0) return serverCompare
    return (a.label ?? '').localeCompare(b.label ?? '')
  })

  // If only one config requested, also return its aggregate stats
  let stats = null
  if (configIds.length === 1) {
    stats = configStats(configIds[0], since)
  }

  return NextResponse.json({
    window: windowKey,
    bucketMs: window.bucketMs,
    since,
    until,
    rows,
    stats,
  })
}