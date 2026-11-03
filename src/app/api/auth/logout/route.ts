import { NextResponse } from 'next/server'
import { COOKIE_CONFIG } from '@/lib/auth/session'

export async function POST() {
  try {
    const response = NextResponse.json({ success: true })

    // Clear cookie by setting maxAge to zero
    response.cookies.set({
      ...COOKIE_CONFIG,
      value: '',
      maxAge: 0,
    })

    return response
  } catch (error) {
    return NextResponse.json({ error: 'Logout failed' }, { status: 500 })
  }
}
