/**
 * نگهبان نشست — تنها نقطه‌ای که «آیا این درخواست مجاز است؟» تعیین می‌شود.
 *
 * گیت اصلی در `src/proxy.ts` است و روی همه‌ی مسیرها اعمال می‌شود.
 * این توابع برای بررسی صریح داخل route handlerها و کامپوننت‌های سرور هستند.
 */
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import type { NextRequest } from 'next/server'

import { SESSION_COOKIE, verifySession } from './session'

/** بررسی نشست برای یک route handler */
export async function isAuthedRequest(request: NextRequest): Promise<boolean> {
  const session = await verifySession(request.cookies.get(SESSION_COOKIE)?.value)
  return session !== null
}

/** بررسی نشست برای یک کامپوننت سرور */
export async function isAuthed(): Promise<boolean> {
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
  return verifySession(request.cookies.get(SESSION_COOKIE)?.value).then((session) =>
    session ? null : new Response(JSON.stringify({ error: 'ورود لازم است.' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    }),
  )
}