/**
 * گیت احراز هویت — فقط برای بخش‌های حساس.
 *
 * سلسله‌مراتب:
 *   1. فقط مسیرهای /ssh-servers و /api/ssh-servers محافظت می‌شوند.
 *   2. بقیه سایت (داشبورد، تایم‌لاین و ...) برای همه آزاد است.
 *   3. اگر کاربر برای بخش SSH وارد نشده باشد، به /login هدایت می‌شود.
 */
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { SESSION_COOKIE, verifySession } from '@/lib/auth/session'

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // فقط اگر مسیر مربوط به مدیریت SSH بود، احراز هویت را چک کن
  if (pathname.startsWith('/ssh-servers') || pathname.startsWith('/api/ssh-servers')) {
    const session = await verifySession(request.cookies.get(SESSION_COOKIE)?.value)

    if (!session) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'ورود لازم است.' }, { status: 401 })
      }
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('next', pathname)
      return NextResponse.redirect(loginUrl)
    }
  }

  // بقیه مسیرها آزاد هستند
  return NextResponse.next()
}

export const config = {
  matcher: ['/ssh-servers/:path*', '/api/ssh-servers/:path*'],
}
