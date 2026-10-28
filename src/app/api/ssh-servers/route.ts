import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { cookies } from 'next/headers'
import { verifySession, SESSION_COOKIE } from '@/lib/auth/session'

async function authenticate() {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  return await verifySession(token)
}

export async function GET() {
  try {
    const session = await authenticate()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const db = getDb()
    const rows = db.prepare('SELECT * FROM ssh_servers ORDER BY created_at DESC').all() as any[]

    return NextResponse.json(rows)
  } catch (error) {
    console.error('[SSH API] GET error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const session = await authenticate()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { name, ip, user, password } = body

    if (!name || !ip || !user || !password) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const db = getDb()
    const result = db.prepare(
      'INSERT INTO ssh_servers (name, ip, user, password, created_at) VALUES (?, ?, ?, ?, ?)'
    ).run(name, ip, user, password, Date.now())

    return NextResponse.json({
      success: true,
      id: result.lastInsertRowid
    }, { status: 201 })
  } catch (error) {
    console.error('[SSH API] POST error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await authenticate()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 })
    }

    const db = getDb()
    db.prepare('DELETE FROM ssh_servers WHERE id = ?').run(id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[SSH API] DELETE error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
