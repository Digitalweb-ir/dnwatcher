/**
 * Auth middleware — protects sensitive sections only.
 *
 * Hierarchy:
 *   1. Only /ssh-servers and /api/ssh-servers routes are protected.
 *   2. Rest of the site (dashboard, timeline, etc.) is open to everyone.
 *   3. If user is not authenticated for SSH section, redirect to /login.
 */
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { SESSION_COOKIE, verifySession } from '@/lib/auth/session'

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Only check auth for SSH management routes
  if (pathname.startsWith('/ssh-servers') || pathname.startsWith('/api/ssh-servers')) {
    const session = await verifySession(request.cookies.get(SESSION_COOKIE)?.value)

    if (!session) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Login required.' }, { status: 401 })
      }
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('next', pathname)
      return NextResponse.redirect(loginUrl)
    }
  }

  // Other routes are public
  return NextResponse.next()
}

export const config = {
  matcher: ['/ssh-servers/:path*', '/api/ssh-servers/:path*'],
}
