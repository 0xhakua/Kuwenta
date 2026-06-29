import { Horizon, Keypair, Networks } from '@stellar/stellar-sdk'

export const horizon = new Horizon.Server(
  process.env.STELLAR_HORIZON_URL ?? 'https://horizon-testnet.stellar.org'
)

export const networkPassphrase =
  process.env.STELLAR_NETWORK === 'mainnet' ? Networks.PUBLIC : Networks.TESTNET

export function getHorizonUrl(): string {
  return process.env.STELLAR_HORIZON_URL ?? 'https://horizon-testnet.stellar.org'
}

export function getSystemKeypair(): Keypair {
  const secretKey = process.env.STELLAR_SECRET_KEY
  if (!secretKey) {
    throw new Error('STELLAR_SECRET_KEY is not configured')
  }
  return Keypair.fromSecret(secretKey)
}

export interface StellarHealth {
  ok: boolean
  network: 'testnet' | 'public'
  horizonUrl: string
  reachable: boolean
  configured: boolean
  message: string
}

/**
 * Probe the Stellar Horizon endpoint. We do a cheap root call to the
 * configured Horizon URL and report reachability plus the network passphrase
 * reported by the server. We never include the secret key in the response.
 */
export async function checkStellarHealth(): Promise<StellarHealth> {
  const url = getHorizonUrl()
  const network: 'testnet' | 'public' =
    process.env.STELLAR_NETWORK === 'mainnet' ? 'public' : 'testnet'
  const configured = Boolean(process.env.STELLAR_SECRET_KEY)
  try {
    const res = await fetch(url, { method: 'GET' })
    if (!res.ok) {
      return {
        ok: false,
        network,
        horizonUrl: url,
        reachable: false,
        configured,
        message: `Horizon returned HTTP ${res.status}`,
      }
    }
    const body = (await res.json()) as { network_passphrase?: string }
    const reported = body.network_passphrase === Networks.PUBLIC ? 'public' : 'testnet'
    return {
      ok: true,
      network,
      horizonUrl: url,
      reachable: true,
      configured,
      message: `Horizon responsive (network ${reported})`,
    }
  } catch (err) {
    return {
      ok: false,
      network,
      horizonUrl: url,
      reachable: false,
      configured,
      message: err instanceof Error ? err.message : 'Horizon unreachable',
    }
  }
}
