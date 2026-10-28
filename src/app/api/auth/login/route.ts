import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createSessionToken, COOKIE_CONFIG } from '@/lib/auth/session'
import { checkAdminPassword } from '@/lib/auth/store'
import { getDb } from '@/lib/db'

const LoginSchema = z.object({
  password: z.string().min(1, 'رمز عبور الزامی است'),
})

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const result = LoginSchema.safeParse(body)

    if (!result.success) {
      return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 })
    }

    const db = getDb()
    if (!checkAdminPassword(db, result.data.password)) {
      return NextResponse.json({ error: 'رمز عبور اشتباه است' }, { status: 401 })
    }

    // ایجاد توکن حرفه‌ای
    const token = await createSessionToken({ userId: 'admin', role: 'admin' })

    const response = NextResponse.json({
      success: true,
      message: 'با موفقیت وارد شدید'
    })

    // ست کردن کوکی امن
    response.cookies.set({
      ...COOKIE_CONFIG,
      value: token,
    })

    return response
  } catch (error) {
    console.error('[Login API Error]:', error)
    return NextResponse.json({ error: 'خطای داخلی سرور' }, { status: 500 })
  }
}
