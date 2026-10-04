import { NextResponse } from 'next/server'
import { z } from 'zod'

import { SESSION_COOKIE, COOKIE_OPTIONS, signSession } from '@/lib/auth/session'
import { checkAdminPassword } from '@/lib/auth/store'
import { getDb } from '@/lib/db'

/**
 * ورود مدیر با یک رمز مشترک.
 * رمز هرگز به‌صورت متن ذخیره نمی‌شود؛ فقط هش scrypt آن در جدول settings است.
 */
const Body = z.object({ password: z.string().min(1) })

export async function POST(request: Request) {
  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'درخواست نامعتبر است.' }, { status: 400 })
  }

  const parsed = Body.safeParse(payload)
  if (!parsed.success) {
    return NextResponse.json({ error: 'رمز عبور را وارد کنید.' }, { status: 400 })
  }

  try {
    const db = getDb()
    if (!checkAdminPassword(db, parsed.data.password)) {
      return NextResponse.json({ error: 'رمز عبور نادرست است.' }, { status: 401 })
    }

    const token = await signSession({ sub: 'admin' })

    const response = NextResponse.json({ ok: true })
    response.cookies.set(SESSION_COOKIE, token, COOKIE_OPTIONS)
    return response
  } catch (error) {
    console.error('[auth] ورود ناموفق:', error)
    return NextResponse.json({ error: 'خطای سرور.' }, { status: 500 })
  }
}
