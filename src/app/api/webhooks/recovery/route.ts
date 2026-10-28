import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const data = await req.json()
    const { configId, address, port, serverId } = data

    console.log(`[Webhook] Recovery trigger received for config ${configId}: ${address}:${port} (Server: ${serverId})`)

    // FUTURE: This is where we will implement the SSH recovery logic
    // e.g., find the SSH server associated with the IP, connect, and restart service.

    return NextResponse.json({
      success: true,
      message: `Recovery trigger received for ${address}:${port}`,
      received: data
    }, { status: 200 })
  } catch (error) {
    console.error('[Webhook] Error processing recovery request:', error)
    return NextResponse.json({
      success: false,
      error: 'Invalid request payload'
    }, { status: 400 })
  }
}
