import { NextRequest, NextResponse } from 'next/server'

import { SESSION_COOKIE, verifySession } from '@/lib/auth/session'

/** آیا کاربر وارد شده است؟ */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const cookie = request.cookies.get(SESSION_COOKIE)?.value
    const session = await verifySession(cookie)
    if (!session) {
      return NextResponse.json({ authenticated: false }, { status: 401 })
    }
    return NextResponse.json({ authenticated: true, user: { role: 'admin' } })
  } catch {
    return NextResponse.json({ authenticated: false }, { status: 401 })
  }
}