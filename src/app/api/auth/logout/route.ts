import { NextResponse } from 'next/server'
import { COOKIE_CONFIG } from '@/lib/auth/session'

export async function POST() {
  try {
    const response = NextResponse.json({ success: true })

    // پاک کردن کوکی با ست کردن maxAge صفر
    response.cookies.set({
      ...COOKIE_CONFIG,
      value: '',
      maxAge: 0,
    })

    return response
  } catch (error) {
    return NextResponse.json({ error: 'خطا در خروج' }, { status: 500 })
  }
}
