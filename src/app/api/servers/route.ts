/**
 * API سرورها — CRUD کامل.
 *
 * POST   : ساخت سرور جدید (رمزنگاری لینک ساب + fetch اولیه + reconcile)
 * GET    : لیست سرورها با آمار
 * PUT    : بروزرسانی (name, country, check_interval_sec, enabled)
 * DELETE : حذف
 */
import { NextRequest, NextResponse } from 'next/server'

import { createServer, deleteServer, getServer, listServers, updateServer } from '@/lib/db/queries'
import { getDb } from '@/lib/db'
import { encryptSecret } from '@/lib/crypto/secret'
import { reconcileServer } from '@/lib/sub/reconcile'
import type { Server } from '@/lib/types'
import { isAuthedRequest } from '@/lib/auth/guard'

export async function GET(request: NextRequest): Promise<NextResponse> {
  const authed = await isAuthedRequest(request)
  if (!authed) {
    return NextResponse.json({ error: 'احراز هویت لازم است' }, { status: 401 })
  }
  const servers = listServers()
  return NextResponse.json({ servers })
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const authed = await isAuthedRequest(request)
  if (!authed) {
    return NextResponse.json({ error: 'احراز هویت لازم است' }, { status: 401 })
  }

  const body = await request.json()
  const { name, country, sub_url, check_interval_sec, enabled } = body as Partial<{
    name: string
    country: string | null
    sub_url: string
    check_interval_sec: number
    enabled: number
  }>

  if (!name?.trim()) {
    return NextResponse.json({ error: 'نام سرور الزامی است' }, { status: 400 })
  }
  if (!sub_url?.trim()) {
    return NextResponse.json({ error: 'لینک ساب الزامی است' }, { status: 400 })
  }

  const db = getDb()
  const encrypted = encryptSecret(sub_url.trim())

  const id = createServer(
    {
      name: name.trim(),
      country: country?.trim() ?? null,
      sub_url: encrypted,
      check_interval_sec: check_interval_sec ?? 300,
      enabled: enabled ?? 1,
    },
    db,
  )

  // fetch و reconcile اولیه (ناظر خطاها در reconcileServer)
  const result = await reconcileServer(id)

  const server = getServer(id)
  return NextResponse.json({ server, reconcile: result }, { status: 201 })
}

export async function PUT(request: NextRequest): Promise<NextResponse> {
  const authed = await isAuthedRequest(request)
  if (!authed) {
    return NextResponse.json({ error: 'احراز هویت لازم است' }, { status: 401 })
  }

  const body = await request.json()
  const { id, ...patch } = body as Partial<Server> & { id: number }

  if (!id) {
    return NextResponse.json({ error: 'شناسه سرور الزامی است' }, { status: 400 })
  }

  type UpdatableKey = 'name' | 'country' | 'check_interval_sec' | 'enabled' | 'sub_url'
  const allowed: UpdatableKey[] = ['name', 'country', 'check_interval_sec', 'enabled', 'sub_url']
  const update: Partial<Server> = {}
  for (const key of allowed) {
    const value = patch[key]
    if (value !== undefined) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(update as any)[key] = value
    }
  }

  if (update.sub_url) {
    update.sub_url = encryptSecret(update.sub_url)
  }

  updateServer(id, update)
  const server = getServer(id)
  return NextResponse.json({ server })
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  const authed = await isAuthedRequest(request)
  if (!authed) {
    return NextResponse.json({ error: 'احراز هویت لازم است' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const id = Number(searchParams.get('id'))
  if (!id) {
    return NextResponse.json({ error: 'شناسه سرور الزامی است' }, { status: 400 })
  }

  deleteServer(id)
  return NextResponse.json({ ok: true })
}