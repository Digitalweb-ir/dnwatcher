/**
 * باس مشترک رویدادهای زنده.
 *
 * در Next.js هر مسیر API و instrumentation ممکن است ماژول را جداگانه بارگذاری کند،
 * پس Set معمولی بین «زمان‌بند پس‌زمینه» و «اتصال SSE مرورگر» مشترک نیست.
 * globalThis تضمین می‌کند همه به یک صف مشترک بفرستند و بگیرند.
 */

interface SseBus {
  subscribers: Set<ReadableStreamDefaultController<string>>
}

const g = globalThis as typeof globalThis & { __dnwSseBus?: SseBus }

function bus(): SseBus {
  if (!g.__dnwSseBus) {
    g.__dnwSseBus = { subscribers: new Set() }
  }
  return g.__dnwSseBus
}

export function addSubscriber(controller: ReadableStreamDefaultController<string>) {
  bus().subscribers.add(controller)
}

export function removeSubscriber(controller: ReadableStreamDefaultController<string>) {
  bus().subscribers.delete(controller)
}

function emit(event: string, data: unknown): void {
  const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
  for (const controller of bus().subscribers) {
    try {
      controller.enqueue(message)
    } catch {
      bus().subscribers.delete(controller)
    }
  }
}

export function emitConfigCheck(
  serverId: number,
  configId: number,
  result: { ok: boolean; latency_ms: number | null },
): void {
  emit('config:check', { serverId, configId, ...result })
}

export function emitConfigStart(serverId: number, configId: number): void {
  emit('config:start', { serverId, configId })
}

export function emitCycleState(data: unknown): void {
  emit('cycle:state', data)
}

/** آمار نهایی یک سرور، دقیقاً همان عددی که بعد از رفرش از دیتابیس دیده می‌شود */
export function emitServerStats(
  serverId: number,
  stats: { up: number; down: number; avgLatency: number | null },
): void {
  emit('server:stats', { serverId, ...stats })
}

/**
 * ارسال آپدیت جامع برای یک سرور شامل همه‌ی اطلاعات ضروری.
 * این رویداد برای اطمینان از همگام بودن UI در صفحات مختلف استفاده می‌شود.
 */
export function emitServerUpdate(
  serverId: number,
  update: {
    up: number
    down: number
    avgLatency: number | null
    totalConfigs: number
  }
): void {
  emit('server:update', { serverId, ...update })
}

export function getSubscriberCount(): number {
  return bus().subscribers.size
}
