/**
 * مدیریت زمان‌بند بررسی‌های دوره‌ای (Background Scheduler).
 * این سرویس مسئول اجرای دوره‌ای runCheckCycle است.
 */
import { runCheckCycle } from '@/lib/service/check'
import { getDb } from '@/lib/db'
import { getSetting } from '@/lib/db/settings'

let schedulerTimer: ReturnType<typeof setInterval> | null = null
let isPaused = false

export function startScheduler() {
  // If already running, just return
  if (schedulerTimer) {
    console.log('[scheduler] Already running.')
    return true
  }

  try {
    const db = getDb()
    const tickSec = getSetting(db, 'scheduler_tick_sec')
    console.log(`[scheduler] Initializing... tick every ${tickSec}s`)

    schedulerTimer = setInterval(async () => {
      if (isPaused) {
        console.log('[scheduler] Cycle skipped: Paused')
        return
      }

      console.log('[scheduler] Triggering check cycle...')
      try {
        await runCheckCycle()
      } catch (error) {
        console.error('[scheduler] check cycle failed:', error)
      }
    }, tickSec * 1000)

    console.log('[scheduler] Successfully started.')
    return true
  } catch (e) {
    console.error('[scheduler] Failed to start scheduler:', e)
    return false
  }
}

export function stopScheduler() {
  if (schedulerTimer) {
    clearInterval(schedulerTimer)
    schedulerTimer = null
    console.log('[scheduler] stopped')
  }
}

export function pauseScheduler() {
  isPaused = true
  console.log('[scheduler] paused')
}

export function resumeScheduler() {
  isPaused = false
  console.log('[scheduler] resumed')
}

export function getSchedulerStatus() {
  return {
    running: !!schedulerTimer,
    paused: isPaused,
  }
}
