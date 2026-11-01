import { NextRequest, NextResponse } from 'next/server'

import { getBotToken } from '@/lib/telegram/client'
import { processUpdate } from '@/lib/telegram/bot'

/**
 * Telegram Webhook Handler
 * POST /api/telegram/webhook — receives updates from Telegram
 * GET  /api/telegram/webhook?action=set|delete|info — manage webhook
 */

interface TelegramUpdate {
  update_id: number
  message?: {
    message_id: number
    from: { id: number; is_bot: boolean; first_name: string; username?: string }
    chat: { id: number; first_name: string; username?: string; type: string }
    date: number
    text?: string
    entities?: Array<{ offset: number; length: number; type: string }>
  }
  callback_query?: {
    id: string
    from: { id: number; first_name: string }
    message: { chat: { id: number } }
    data: string
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json() as TelegramUpdate

    const text = body.message?.text
    const chatId = body.message?.chat.id
    console.log(`[Telegram Webhook] update ${body.update_id} chat=${chatId ?? '-'} text=${text ?? '-'}`)

    // Process through bot core (handles commands, callbacks, etc.)
    await processUpdate(body)

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[Telegram Webhook] Error:', error)
    return NextResponse.json({ ok: false, error: 'Internal error' }, { status: 500 })
  }
}

/**
 * GET /api/telegram/webhook
 * Manage webhook: ?action=set|delete|info
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')

    const token = getBotToken()
    if (!token) {
      return NextResponse.json({ error: 'Bot token not configured' }, { status: 400 })
    }

    // Resolve the public base URL. Behind a tunnel (ngrok/cloudflare) the
    // forwarded headers carry the real HTTPS host, so prefer them over APP_URL
    // (which is typically http://localhost and rejected by Telegram).
    const forwardedHost = request.headers.get('x-forwarded-host')
    const host = forwardedHost ?? request.headers.get('host')
    const proto = request.headers.get('x-forwarded-proto') ?? 'http'
    const baseUrl = host ? `${proto}://${host}` : (process.env.APP_URL ?? 'http://localhost:3000')
    const webhookUrl = `${baseUrl}/api/telegram/webhook`

    if (action === 'set') {
      // Explicit ?url= overrides auto-detection
      const url = searchParams.get('url') ?? webhookUrl
      const response = await fetch(
        `https://api.telegram.org/bot${token}/setWebhook?url=${encodeURIComponent(url)}`
      )
      const result = await response.json()
      return NextResponse.json({ success: true, webhookUrl: url, result })
    }

    if (action === 'delete') {
      const response = await fetch(`https://api.telegram.org/bot${token}/deleteWebhook`)
      const result = await response.json()
      return NextResponse.json({ success: true, result })
    }

    if (action === 'info') {
      const response = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`)
      const result = await response.json()
      return NextResponse.json({ success: true, result })
    }

    // ?action=test[&chat=ID] — sends one message to verify the whole chain
    if (action === 'test') {
      const { sendTelegramMessage, getAdminIds } = await import('@/lib/telegram/client')
      const chatParam = searchParams.get('chat')
      const targets = chatParam ? [Number(chatParam)] : getAdminIds()
      if (targets.length === 0 || targets.some((id) => Number.isNaN(id))) {
        return NextResponse.json(
          { error: 'No target chat. Pass ?chat=<id> or set admin IDs in settings.' },
          { status: 400 },
        )
      }
      const results = []
      for (const chatId of targets) {
        const result = await sendTelegramMessage({
          chat_id: chatId,
          text: '✅ تست لاگ Network Watcher — اگر این پیام را می‌بینید، ارسال تلگرام درست کار می‌کند.',
        })
        results.push({ chatId, result })
      }
      return NextResponse.json({ success: true, results })
    }

    return NextResponse.json({
      error: 'Invalid action. Use: set, delete, info',
      hint: 'For local dev: ?action=set&url=https://your-ngrok-url.ngrok-free.app/api/telegram/webhook'
    }, { status: 400 })
  } catch (error) {
    console.error('[Telegram Webhook] GET error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}