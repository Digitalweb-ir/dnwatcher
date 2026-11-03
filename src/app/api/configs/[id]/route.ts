/**
 * Config details API + check history + timeline.
 */
import { NextRequest, NextResponse } from 'next/server'

import {
  getConfig,
  listChecks,
  listLatestChecks,
  configStats,
  timelineCells,
} from '@/lib/db/queries'
import type { ConfigWithStatus, TimelineCell } from '@/lib/types'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params
  const configId = Number(id)

  const config = getConfig(configId)
  if (!config) {
    return NextResponse.json({ error: 'Config not found' }, { status: 404 })
  }

  const latest = listLatestChecks()
  const last = latest.find((c) => c.config_id === configId)

  const since24h = Date.now() - 24 * 3600 * 1000
  const stats = configStats(configId, since24h)

  // 24-hour timeline with 5-minute buckets
  const cellsMap = timelineCells({
    since: since24h,
    until: Date.now(),
    bucketMs: 5 * 60 * 1000,
    configIds: [configId],
  })
  const cells = cellsMap.get(configId) ?? []

  return NextResponse.json({
    config,
    lastCheck: last ?? null,
    stats,
    timeline: { cells, bucketMs: 5 * 60 * 1000 },
  })
}