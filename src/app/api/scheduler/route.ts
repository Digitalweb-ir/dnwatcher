import { NextRequest, NextResponse } from 'next/server'
import { startScheduler, stopScheduler, pauseScheduler, resumeScheduler, getSchedulerStatus } from '@/lib/service/scheduler'

export async function GET() {
  const status = getSchedulerStatus()
  return NextResponse.json(status)
}

export async function POST(request: NextRequest) {
  const { action } = await request.json()

  switch (action) {
    case 'start':
      startScheduler()
      break
    case 'stop':
      stopScheduler()
      break
    case 'pause':
      pauseScheduler()
      break
    case 'resume':
      resumeScheduler()
      break
    default:
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  }

  return NextResponse.json({ success: true, status: getSchedulerStatus() })
}
