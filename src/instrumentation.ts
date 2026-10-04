/**
 * نقطه‌ی ورود اجرا برای Next.js — زمان‌بند پس‌زمینه.
 *
 * در Next.js 16 این فایل در شروع سرور اجرا می‌شود (نه در 빌د).
 * یک تایمر دوره‌ای می‌اندازد که `runCheckCycle` را صدا می‌زند.
 */
import { runCheckCycle } from '@/lib/service/check'

/** متغیر سراسری برای نگه‌داشتن شناسه‌ی تایمر (برای تست/شات‌داون) */
let schedulerTimer: ReturnType<typeof setInterval> | null = null

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  const db = (await import('@/lib/db')).getDb()
  const { getSetting } = await import('@/lib/db/settings')
  const tickSec = getSetting(db, 'scheduler_tick_sec')

  if (schedulerTimer) clearInterval(schedulerTimer)

  schedulerTimer = setInterval(() => {
    runCheckCycle().catch((error) => {
      console.error('[scheduler] check cycle failed:', error)
    })
  }, tickSec * 1000)

  console.log(`[scheduler] started — tick every ${tickSec}s`)
}

/** برای تست و shutdown تمیز */
export function getSchedulerTimer(): ReturnType<typeof setInterval> | null {
  return schedulerTimer
}

export function stopScheduler(): void {
  if (schedulerTimer) {
    clearInterval(schedulerTimer)
    schedulerTimer = null
    console.log('[scheduler] stopped')
  }
}