import { isIP } from 'node:net'
import { resolve4 } from 'node:dns/promises'

/**
 * Resolve a host name to a list of IPv4 addresses.
 * If the input is already an IP literal, it is returned as-is.
 */
export async function resolveHostToIps(host: string): Promise<string[]> {
  const trimmed = host.trim().replace(/^\[|\]$/g, '')
  if (!trimmed) return []

  // Already an IP literal (v4 or v6) — nothing to resolve
  if (isIP(trimmed)) return [trimmed]

  try {
    return await resolve4(trimmed)
  } catch (error) {
    console.error(`[dns] Failed to resolve ${trimmed}:`, error)
    return []
  }
}
