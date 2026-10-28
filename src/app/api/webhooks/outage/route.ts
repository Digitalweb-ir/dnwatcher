import { NextRequest, NextResponse } from 'next/server'

import { getDb } from '@/lib/db'
import { isAuthedRequest } from '@/lib/auth/guard'
import type { Incident } from '@/lib/types'

/**
 * Webhook receiver for outage notifications.
 * POST /api/webhooks/outage
 *
 * Payload:
 * {
 *   event: 'config_down',
 *   configId: number,
 *   serverId: number,
 *   address: string | null,
 *   port: number | null,
 *   failStreak: number,
 *   threshold: number,
 *   error: string | null,
 *   timestamp: number
 * }
 *
 * This endpoint can be called by external services or by our own checker.
 * If called from our own checker, it records the event for auditing.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Verify authentication (optional for webhooks, but we support it)
    const authed = await isAuthedRequest(request)

    const body = await request.json()

    const {
      event,
      configId,
      serverId,
      address,
      port,
      failStreak,
      threshold,
      error,
      timestamp,
    } = body as {
      event: string
      configId: number
      serverId: number
      address: string | null
      port: number | null
      failStreak: number
      threshold: number
      error: string | null
      timestamp: number
    }

    // Validate required fields
    if (!event || !configId) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: event, configId' },
        { status: 400 },
      )
    }

    const db = getDb()

    // If called from our own checker (unauthenticated but from localhost),
    // we still record the incident for audit purposes
    // The incident is already recorded in recordChecks, so this is just an audit log

    // Log the webhook receipt for debugging/auditing
    console.log(`[Outage Webhook] Received: ${event} for config ${configId} (${address}:${port})`)

    // If the request is authenticated, we could do additional processing
    // For now, we just acknowledge receipt

    return NextResponse.json({
      success: true,
      message: `Outage webhook received: ${event}`,
      received: {
        event,
        configId,
        serverId,
        address,
        port,
        failStreak,
        threshold,
        timestamp,
      },
    }, { status: 200 })
  } catch (error) {
    console.error('[Outage Webhook] Error processing request:', error)
    return NextResponse.json(
      { success: false, error: 'Invalid request payload' },
      { status: 400 },
    )
  }
}

/**
 * GET /api/webhooks/outage
 * Returns recent outage events for audit/debugging
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const authed = await isAuthedRequest(request)
  if (!authed) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  try {
    const db = getDb()
    const { searchParams } = new URL(request.url)
    const since = Number(searchParams.get('since') ?? Date.now() - 24 * 3600 * 1000)
    const limit = Number(searchParams.get('limit') ?? 100)

    // Fetch recent incidents from the database
    const incidents = db
      .prepare(
        `SELECT i.*, c.address, c.port, c.label, s.name as server_name
         FROM incidents i
         JOIN configs c ON c.id = i.config_id
         JOIN servers s ON s.id = c.server_id
         WHERE i.started_at >= ?
         ORDER BY i.started_at DESC
         LIMIT ?`,
      )
      .all(since, limit) as (Incident & { address: string | null; port: number | null; label: string | null; server_name: string })[]

    return NextResponse.json({ incidents })
  } catch (error) {
    console.error('[Outage Webhook] Error fetching incidents:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch incidents' },
      { status: 500 },
    )
  }
}