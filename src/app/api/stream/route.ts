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
import { addSubscriber, removeSubscriber } from '@/lib/service/sse'
import { startScheduler } from '@/lib/service/scheduler'

// SSE در محیط Node نیاز به اجرای طولانی دارد
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: NextRequest): Promise<Response> {
  // ENSURE SCHEDULER IS RUNNING
  // This is a safety net: if instrumentation.ts failed, the first client connection will wake up the scheduler.
  startScheduler()

  let heartbeat: ReturnType<typeof setInterval> | null = null

  const stream = new ReadableStream<string>({
    start(controller) {
      addSubscriber(controller)

      // فوراً وضعیت جاری را بفرست
      controller.enqueue(`event: cycle:state\ndata: ${JSON.stringify(getCycleState())}\n\n`)

      heartbeat = setInterval(() => {
        try {
          controller.enqueue(`event: heartbeat\ndata: ${Date.now()}\n\n`)
        } catch {
          if (heartbeat) clearInterval(heartbeat)
          removeSubscriber(controller)
        }
      }, 30_000)

      // وقتی کلاینت قطع شد، تمیزکاری کن
      request.signal.addEventListener('abort', () => {
        if (heartbeat) clearInterval(heartbeat)
        removeSubscriber(controller)
      })
    },
    cancel(controller) {
      if (heartbeat) clearInterval(heartbeat)
      removeSubscriber(controller as ReadableStreamDefaultController<string>)
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