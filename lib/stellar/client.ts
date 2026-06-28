import { Horizon, Keypair, Networks } from '@stellar/stellar-sdk'

export const horizon = new Horizon.Server(
  process.env.STELLAR_HORIZON_URL ?? 'https://horizon-testnet.stellar.org'
)

export const networkPassphrase =
  process.env.STELLAR_NETWORK === 'mainnet' ? Networks.PUBLIC : Networks.TESTNET

export function getSystemKeypair(): Keypair {
  const secretKey = process.env.STELLAR_SECRET_KEY
  if (!secretKey) {
    throw new Error('STELLAR_SECRET_KEY is not configured')
  }
  return Keypair.fromSecret(secretKey)
}
