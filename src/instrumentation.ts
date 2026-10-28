/**
 * نقطه‌ی ورود اجرا برای Next.js — زمان‌بند پس‌زمینه.
 *
 * در Next.js 16 این فایل در شروع سرور اجرا می‌شود (نه در 빌د).
 * یک تایمر دوره‌ای می‌اندازد که `runCheckCycle` را صدا می‌زند.
 */
import { startScheduler } from '@/lib/service/scheduler'

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  // Start the scheduler centrally
  startScheduler()
}
