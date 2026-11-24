import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { Client } from 'ssh2'

export async function POST(req: Request) {
  try {
    const data = await req.json()
    const { configId, address, port, serverId } = data

    console.log(`[Webhook] Recovery trigger received for config ${configId}: ${address}:${port} (Server: ${serverId})`)

    const db = getDb()

    // Get the server details to find its IP
    const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(serverId) as
      | { id: number; name: string; ip?: string | null }
      | undefined

    if (!server) {
      return NextResponse.json({ success: false, error: 'Server not found' }, { status: 404 })
    }

    // Find matching SSH server by IP address
    // The server table doesn't have IP directly, but we can match by the config's address
    const sshServer = db.prepare('SELECT * FROM ssh_servers WHERE ip = ?').get(address) as
      | { id: number; name: string; ip: string; user: string; password: string; recovery_command: string | null }
      | undefined

    if (!sshServer) {
      return NextResponse.json({
        success: false,
        error: `No SSH server configured for IP ${address}`
      }, { status: 404 })
    }

    // Determine the recovery command: per-server command takes precedence over global setting
    const settings = db.prepare('SELECT value FROM settings WHERE key = ?').get('ssh_recovery_command') as
      | { value: string }
      | undefined
    const globalCommand = settings?.value ?? ''
    const recoveryCommand = sshServer.recovery_command ?? globalCommand

    if (!recoveryCommand) {
      return NextResponse.json({
        success: false,
        error: 'No recovery command configured (neither per-server nor global)'
      }, { status: 400 })
    }

    // Execute SSH command
    const result = await executeSshCommand(sshServer, recoveryCommand)

    return NextResponse.json({
      success: true,
      message: `Recovery command executed on ${sshServer.name} (${sshServer.ip})`,
      command: recoveryCommand,
      output: result
    }, { status: 200 })
  } catch (error) {
    console.error('[Webhook] Error processing recovery request:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    }, { status: 500 })
  }
}

function executeSshCommand(
  sshServer: { ip: string; user: string; password: string },
  command: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    const conn = new Client()

    conn.on('ready', () => {
      console.log(`[SSH] Connected to ${sshServer.ip}`)
      conn.exec(command, (err, stream) => {
        if (err) {
          conn.end()
          return reject(err)
        }

        let stdout = ''
        let stderr = ''

        stream.on('close', (code: number) => {
          conn.end()
          const output = stdout + (stderr ? `\n[stderr]${stderr}` : '')
          console.log(`[SSH] Command finished with code ${code}`)
          resolve(output.trim() || `Command executed (exit code: ${code})`)
        })

        stream.on('data', (data: Buffer) => {
          stdout += data.toString()
        })

        stream.stderr.on('data', (data: Buffer) => {
          stderr += data.toString()
        })
      })
    })

    conn.on('error', (err) => {
      console.error(`[SSH] Connection error: ${err.message}`)
      reject(err)
    })

    conn.connect({
      host: sshServer.ip,
      username: sshServer.user,
      password: sshServer.password,
      readyTimeout: 10000,
    })
  })
}
