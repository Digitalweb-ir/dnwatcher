import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifySessionToken, SESSION_COOKIE } from '@/lib/auth/session'

export async function GET() {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(SESSION_COOKIE)?.value
    const session = await verifySessionToken(token)

    if (!session) {
      return NextResponse.json({ authenticated: false }, { status: 200 })
    }

    return NextResponse.json({
      authenticated: true,
      user: {
        id: session.userId,
        role: session.role,
      }
    }, { status: 200 })
  } catch (error) {
    return NextResponse.json({ authenticated: false }, { status: 200 })
  }
}
