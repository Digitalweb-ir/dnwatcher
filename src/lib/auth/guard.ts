/**
 * نگهبان نشست — تنها نقطه‌ای که «آیا این درخواست مجاز است؟» تعیین می‌شود.
 *
 * دو حالت:
 *   • اگر `SESSION_SECRET` تنظیم شده باشد، بررسی واقعی امضای کوکی انجام می‌شود.
 *   • اگر تنظیم نشده باشد (محیط توسعه)، احراز هویت غیرفعال است تا راه‌اندازی
 *     اولیه ساده بماند؛ صفحه‌ی تنظیمات این وضعیت را هشدار می‌دهد.
 *
 * عمداً از `proxy.ts` (میان‌افزار) استفاده نمی‌کنیم؛ در Next 16 این فایل
 * بازنویسی شده و ما بررسی را داخل خودِ کامپوننت‌ها و route handlerها انجام می‌دهیم.
 */
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import type { NextRequest } from 'next/server'

import { SESSION_COOKIE, verifySession } from './session'

/** آیا احراز هویت فعال است؟ (یعنی SESSION_SECRET تنظیم شده) — فقط متغیر محیطی، بدون next/headers */
export function authEnabled(): boolean {
  return Boolean(process.env.SESSION_SECRET)
}

/** بررسی نشست برای یک route handler */
export async function isAuthedRequest(request: NextRequest): Promise<boolean> {
  if (!authEnabled()) return true
  const session = await verifySession(request.cookies.get(SESSION_COOKIE)?.value)
  return session !== null
}

/** بررسی نشست برای یک کامپوننت سرور */
export async function isAuthed(): Promise<boolean> {
  if (!authEnabled()) return true
  const store = await cookies()
  const session = await verifySession(store.get(SESSION_COOKIE)?.value)
  return session !== null
}

/** در صفحات سرور: اگر وارد نشده باشد، به /login هدایت می‌کند */
export async function requireSession(): Promise<void> {
  if (!(await isAuthed())) redirect('/login')
}

/** در route handler: اگر وارد نشده باشد، Response 401 برمی‌گرداند */
export function requireAuthedRequest(request: NextRequest): Promise<null | Response> {
  if (!authEnabled()) return Promise.resolve(null)
  return Promise.resolve(
    verifySession(request.cookies.get(SESSION_COOKIE)?.value).then((session) =>
      session ? null : new Response(JSON.stringify({ error: 'ورود لازم است.' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }),
    ),
  )
}

export function requireAuthedRequestSync(request: NextRequest): null | Response {
  if (!authEnabled()) return null
  const cookie = request.cookies.get(SESSION_COOKIE)?.value
  // verifySession is async; for sync we can't use it. Use async variant above.
  // This helper is kept for future sync JWT verification if needed.
  return null
}