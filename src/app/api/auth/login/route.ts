import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createSessionToken, COOKIE_CONFIG } from '@/lib/auth/session'
import { checkAdminPassword } from '@/lib/auth/store'
import { getDb } from '@/lib/db'

const LoginSchema = z.object({
  password: z.string().min(1, 'Password is required'),
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
      return NextResponse.json({ error: 'Invalid password' }, { status: 401 })
    }

    // Create professional session token
    const token = await createSessionToken({ userId: 'admin', role: 'admin' })

    const response = NextResponse.json({
      success: true,
      message: 'Logged in successfully'
    })

    // Set secure cookie
    response.cookies.set({
      ...COOKIE_CONFIG,
      value: token,
    })

    return response
  } catch (error) {
    console.error('[Login API Error]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
