/**
 * Server-Sent Events for live dashboard/timeline updates.
 *
 * GET /api/stream
 *
 * Events:
 *   - cycle:state  → when a check cycle completes
 *   - config:check → result of a single config check
 *   - heartbeat    → every 30 seconds to keep connection alive
 *
 * Client connects with EventSource and processes events.
 */
import { NextRequest } from 'next/server'
import { getCycleState } from '@/lib/service/check'
import { addSubscriber, removeSubscriber } from '@/lib/service/sse'
import { startScheduler } from '@/lib/service/scheduler'

// SSE in Node requires long-running execution
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

      // Immediately send current state
      controller.enqueue(`event: cycle:state\ndata: ${JSON.stringify(getCycleState())}\n\n`)

      heartbeat = setInterval(() => {
        try {
          controller.enqueue(`event: heartbeat\ndata: ${Date.now()}\n\n`)
        } catch {
          if (heartbeat) clearInterval(heartbeat)
          removeSubscriber(controller)
        }
      }, 30_000)

      // Cleanup when client disconnects
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