/**
 * Server-Sent Events برای به‌روزرسانی زنده داشبورد/تایم‌لاین.
 *
 * GET /api/stream
 *
 * رویدادها:
 *   - cycle:state  → وقتی دور بررسی تمام می‌شود
 *   - config:check → نتیجه یک بررسی کانفیگ
 *   - heartbeat    → هر ۳۰ ثانیه برای نگه‌داشتن اتصال
 *
 * کلاینت باید با EventSource متصل شود و رویدادها را پردازش کند.
 */
import { NextRequest } from 'next/server'
import { getCycleState } from '@/lib/service/check'

// SSE در محیط Node نیاز به اجرای طولانی دارد
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** صف رویدادها — در تولید واقعی می‌تواند Redis/Worker باشد؛ اینجا حافظه. */
const subscribers = new Set<ReadableStreamDefaultController<string>>()

export function emit(event: string, data: unknown): void {
  const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
  for (const controller of subscribers) {
    try {
      controller.enqueue(message)
    } catch {
      // کنترلر بسته شده
    }
  }
}

/** helper برای سرویس بررسی — در recordChecks صدا زده می‌شود */
export function emitConfigCheck(configId: number, result: { ok: boolean; latency_ms: number | null }): void {
  emit('config:check', { configId, ...result })
}

export function emitConfigStart(configId: number): void {
  emit('config:start', { configId })
}

export async function GET(request: NextRequest): Promise<Response> {
  let heartbeat: ReturnType<typeof setInterval> | null = null

  const stream = new ReadableStream<string>({
    start(controller) {
      subscribers.add(controller)

      // فوراً وضعیت جاری را بفرست
      controller.enqueue(`event: cycle:state\ndata: ${JSON.stringify(getCycleState())}\n\n`)

      heartbeat = setInterval(() => {
        try {
          controller.enqueue(`event: heartbeat\ndata: ${Date.now()}\n\n`)
        } catch {
          if (heartbeat) clearInterval(heartbeat)
          subscribers.delete(controller)
        }
      }, 30_000)

      // وقتی کلاینت قطع شد، تمیزکاری کن
      request.signal.addEventListener('abort', () => {
        if (heartbeat) clearInterval(heartbeat)
        subscribers.delete(controller)
      })
    },
    cancel(controller) {
      if (heartbeat) clearInterval(heartbeat)
      subscribers.delete(controller as ReadableStreamDefaultController<string>)
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  })
}