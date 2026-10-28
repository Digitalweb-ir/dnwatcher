import type { Client, ConnectConfig } from 'ssh2'
import { getDb } from '@/lib/db'

/** SSH server record from database */
export interface SshServer {
  id: number
  name: string
  ip: string
  user: string
  password: string
  created_at: number
}

/** Find an SSH server by IP address */
export function findSshServerByIp(ip: string): SshServer | null {
  const db = getDb()
  const row = db.prepare('SELECT * FROM ssh_servers WHERE ip = ?').get(ip) as SshServer | undefined
  return row ?? null
}

/**
 * Execute a command over SSH and return stdout/stderr.
 * Rejects on connection/auth failure or non-zero exit code.
 */
export function execSshCommand(
  server: SshServer,
  command: string,
  options: { timeoutMs?: number } = {},
): Promise<{ stdout: string; stderr: string; code: number }> {
  const { timeoutMs = 30000 } = options

  return new Promise((resolve, reject) => {
    let client: Client
    try {
      // Dynamic import to avoid loading ssh2 at build time
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { Client: SshClient } = require('ssh2')
      client = new SshClient()
    } catch (e) {
      reject(new Error('ssh2 module not available'))
      return
    }

    let stdout = ''
    let stderr = ''

    const config: ConnectConfig = {
      host: server.ip,
      username: server.user,
      password: server.password,
      readyTimeout: Math.min(timeoutMs, 20000),
    }

    let finished = false
    const finish = (code: number) => {
      if (finished) return
      finished = true
      client.end()
      resolve({ stdout, stderr, code })
    }

    client.on('error', (err) => {
      if (!finished) {
        finished = true
        reject(err)
      }
    })

    client.on('ready', () => {
      client.exec(command, (err, stream) => {
        if (err) {
          finish(1)
          return
        }
        stream
          .on('close', (code: number) => {
            finish(code)
          })
          .on('data', (data: Buffer) => {
            stdout += data.toString()
          })
          .stderr.on('data', (data: Buffer) => {
            stderr += data.toString()
          })
      })
    })

    client.on('close', () => {
      if (!finished) {
        finished = true
        reject(new Error('SSH connection closed unexpectedly'))
      }
    })

    client.connect(config)

    // Global timeout
    setTimeout(() => {
      if (!finished) {
        finished = true
        client.end()
        reject(new Error('SSH command timeout'))
      }
    }, timeoutMs)
  })
}