import { NextRequest, NextResponse } from 'next/server'

import { getDb } from '@/lib/db'
import { getSettings } from '@/lib/db/settings'
import { isAuthedRequest } from '@/lib/auth/guard'
import type { Incident } from '@/lib/types'
import { resolveHostToIps } from '@/lib/net/dns'
import { findSshServerByIp, execSshCommand } from '@/lib/net/ssh'
import { sendOutageLog, isTelegramEnabled } from '@/lib/telegram/bot'
import { sendLog } from '@/lib/telegram/client'

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
 * On config_down event: resolves address to IP, finds SSH server, executes recovery command.
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
    const settings = getSettings(db)

    // Log the webhook receipt for debugging/auditing
    console.log(`[Outage Webhook] Received: ${event} for config ${configId} (${address}:${port})`)

    // Trace the whole pipeline in Telegram when logging is enabled
    const log = isTelegramEnabled()
      ? (text: string) => sendLog(text)
      : async () => {}

    // Switch on event type
    if (event === 'config_down') {
      await log(
        `📥 <b>وب‌هوک config_down دریافت شد</b>\n` +
          `کانفیگ ${configId} — ${address ?? '?'}:${port ?? '?'}\n` +
          `شکست پیاپی: ${failStreak}/${threshold} — خطا: ${error ?? 'نامشخص'}`,
      )
      // Send Telegram notification for config down
      if (isTelegramEnabled()) {
        await sendOutageLog({
          event: 'config_down',
          configId,
          serverId,
          address,
          port,
          timestamp,
        })
      }

      // Handle config_down event: attempt SSH recovery
      if (!address) {
        return NextResponse.json(
          { success: false, error: 'No address provided for config_down event' },
          { status: 400 },
        )
      }

      // Resolve address (domain) to IP(s)
      const ips = await resolveHostToIps(address)
      if (ips.length === 0) {
        console.error(`[Outage Webhook] Failed to resolve address: ${address}`)
        await log(`❌ <b>حل DNS ناموفق</b> — ${address} به IP تبدیل نشد، ریکاوری متوقف شد`)
        return NextResponse.json(
          { success: false, error: `Failed to resolve address: ${address}` },
          { status: 500 },
        )
      }

      await log(`🔍 <b>DNS حل شد</b> — ${address} → ${ips.join(', ')}`)

      // Try each resolved IP to find matching SSH server
      let sshResult: { stdout: string; stderr: string; code: number } | null = null
      let matchedSshServer: { id: number; name: string; ip: string } | null = null

      for (const ip of ips) {
        const sshServer = findSshServerByIp(ip)
        if (sshServer) {
          matchedSshServer = { id: sshServer.id, name: sshServer.name, ip: sshServer.ip }
          console.log(`[Outage Webhook] Found SSH server: ${sshServer.name} (${sshServer.ip}) for IP ${ip}`)

          // Get the recovery command from settings
          const recoveryCommand = settings.ssh_recovery_command ?? 'backpack -restart-all'
          if (!recoveryCommand) {
            console.log('[Outage Webhook] SSH recovery command is empty, skipping execution')
            break
          }

          try {
            console.log(`[Outage Webhook] Executing SSH command on ${sshServer.name}: ${recoveryCommand}`)
            await log(`🔐 <b>اتصال SSH</b> — ${sshServer.name} (${sshServer.ip})\nدستور: <code>${recoveryCommand}</code>`)
            sshResult = await execSshCommand(sshServer, recoveryCommand)
            console.log(`[Outage Webhook] SSH command exited with code ${sshResult.code}`)
            break // Success - stop trying other IPs
          } catch (sshError) {
            console.error(`[Outage Webhook] SSH command failed on ${sshServer.name} (${ip}):`, sshError)
            await log(`❌ <b>اتصال SSH ناموفق</b> — ${sshServer.name} (${ip})\n${sshError instanceof Error ? sshError.message : String(sshError)}`)
            // Try next IP
            continue
          }
        }
      }

      if (!matchedSshServer) {
        await log(`⚠️ <b>سرور SSH پیدا نشد</b> — هیچ IPای از ${address} در جدول SSH نیست`)
        // Send Telegram notification for failure
        if (isTelegramEnabled()) {
          await sendOutageLog({
            event: 'ssh_recovery',
            configId,
            serverId,
            address,
            port,
            resolvedIps: ips,
            command: settings.ssh_recovery_command ?? 'backpack -restart-all',
            result: null,
            timestamp,
          })
        }

        return NextResponse.json(
          { success: false, error: `No SSH server found for any resolved IP of ${address} (resolved: ${ips.join(', ')})` },
          { status: 404 },
        )
      }

      // Send Telegram notification for SSH recovery attempt
      if (isTelegramEnabled()) {
        await sendOutageLog({
          event: 'ssh_recovery',
          configId,
          serverId,
          address,
          port,
          resolvedIps: ips,
          sshServer: matchedSshServer,
          command: settings.ssh_recovery_command ?? 'backpack -restart-all',
          result: sshResult,
          timestamp,
        })
      }

      return NextResponse.json({
        success: true,
        message: `SSH recovery executed on ${matchedSshServer.name} (${matchedSshServer.ip})`,
        executed: {
          event,
          configId,
          serverId,
          address,
          port,
          resolvedIps: ips,
          sshServer: matchedSshServer,
          command: settings.ssh_recovery_command ?? 'backpack -restart-all',
          result: sshResult ? {
            code: sshResult.code,
            stdout: sshResult.stdout,
            stderr: sshResult.stderr,
          } : null,
        },
      }, { status: 200 })
    }

    // For other events (future: config_up, etc.), just acknowledge
    if (event === 'config_up') {
      await log(
        `📥 <b>وب‌هوک config_up دریافت شد</b>\n` +
          `کانفیگ ${configId} — ${address ?? '?'}:${port ?? '?'}`,
      )
      // Send Telegram notification for config up (recovery)
      if (isTelegramEnabled()) {
        await sendOutageLog({
          event: 'config_up',
          configId,
          serverId,
          address,
          port,
          timestamp,
        })
      }
    }

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
      .all(since, limit) as unknown as (Incident & { address: string | null; port: number | null; label: string | null; server_name: string })[]

    return NextResponse.json({ incidents })
  } catch (error) {
    console.error('[Outage Webhook] Error fetching incidents:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch incidents' },
      { status: 500 },
    )
  }
}