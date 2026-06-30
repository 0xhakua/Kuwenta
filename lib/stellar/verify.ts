import { horizon, getSystemKeypair } from './client'

export interface StellarStatus {
  healthy: boolean
  network: 'testnet' | 'mainnet'
  horizonUrl: string
  latencyMs: number | null
  accountExists: boolean | null
  accountSequence: string | null
  publicKey: string | null
  error: string | null
  checkedAt: string
}

export interface OnChainAnchor {
  returnId: string
  dataKey: string
  dataValue: string | null
  payloadHash: string | null
  anchoredAt: string | null
  sourceAccount: string
  transactionHash: string
}

export interface VerifyResult {
  valid: boolean
  reason: string | null
  txId: string
  returnId: string
  storedHash: string | null
  onChainHash: string | null
  onChainTimestamp: string | null
  onChainKey: string | null
  network: 'testnet' | 'mainnet'
  sourceAccount: string | null
  ledgerCreatedAt: string | null
  explorerUrl: string
  checkedAt: string
}

function getNetwork(): 'testnet' | 'mainnet' {
  return process.env.STELLAR_NETWORK === 'mainnet' ? 'mainnet' : 'testnet'
}

function getExplorerUrl(txId: string): string {
  const network = getNetwork()
  return `https://stellar.expert/explorer/${network}/tx/${txId}`
}

function dataKeyFor(returnId: string): string {
  return `kuwenta:ph:${returnId}`.substring(0, 64)
}

function parseManageDataValue(raw: string | null | undefined): {
  payloadHash: string | null
  anchoredAt: string | null
} {
  if (!raw) return { payloadHash: null, anchoredAt: null }
  const idx = raw.indexOf(':')
  if (idx === -1) {
    return { payloadHash: raw, anchoredAt: null }
  }
  const payloadHash = raw.substring(0, idx)
  const anchoredAt = raw.substring(idx + 1)
  return { payloadHash, anchoredAt }
}

function bufferToUtf8(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  if (Buffer.isBuffer(value)) return value.toString('utf-8')
  if (value instanceof Uint8Array) return Buffer.from(value).toString('utf-8')
  if (typeof value === 'object' && value !== null && 'toString' in value) {
    return String((value as { toString: () => string }).toString())
  }
  return ''
}

/**
 * Reports the Stellar network connection health. Used by `/api/stellar/status`
 * and the admin system-health panel.
 *
 * A successful run requires the system keypair to be configured (for the
 * loadAccount call) and Horizon to be reachable. If either fails the result
 * has `healthy: false` and a descriptive `error`.
 */
export async function getStellarStatus(): Promise<StellarStatus> {
  const network = getNetwork()
  const horizonUrl =
    process.env.STELLAR_HORIZON_URL ?? 'https://horizon-testnet.stellar.org'
  const checkedAt = new Date().toISOString()
  const base: StellarStatus = {
    healthy: false,
    network,
    horizonUrl,
    latencyMs: null,
    accountExists: null,
    accountSequence: null,
    publicKey: null,
    error: null,
    checkedAt,
  }

  let publicKey: string
  try {
    const keypair = getSystemKeypair()
    publicKey = keypair.publicKey()
  } catch (err) {
    return {
      ...base,
      error: err instanceof Error ? err.message : 'System keypair unavailable',
    }
  }

  const startedAt = Date.now()
  try {
    const account = await horizon.loadAccount(publicKey)
    return {
      ...base,
      healthy: true,
      publicKey,
      accountExists: true,
      accountSequence: account.sequenceNumber(),
      latencyMs: Date.now() - startedAt,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Horizon unreachable'
    return {
      ...base,
      publicKey,
      latencyMs: Date.now() - startedAt,
      accountExists: false,
      error: message,
    }
  }
}

/**
 * Fetches the on-chain anchor record for a given TX hash. Looks up the
 * transaction, then locates the manageData operation whose name matches the
 * `kuwenta:ph:{returnId}` convention used by `anchorFilingReceipt`.
 */
export async function fetchOnChainAnchor(
  txId: string,
  returnId: string
): Promise<OnChainAnchor | null> {
  try {
    const tx = await horizon.transactions().transaction(txId).call()
    const operations = await horizon
      .operations()
      .forTransaction(txId)
      .limit(200)
      .call()
    const targetKey = dataKeyFor(returnId)
    const match = operations.records.find(
      (op: { type?: string; name?: string }) =>
        (op.type === 'manageData' || op.type === 'manage_data') &&
        op.name === targetKey
    )
    if (!match) return null
    const dataValue = bufferToUtf8(
      (match as unknown as { value?: unknown }).value
    )
    const sourceAccount =
      (match as unknown as { source_account?: string }).source_account ??
      tx.source_account
    return {
      returnId,
      dataKey: targetKey,
      dataValue: dataValue || null,
      ...parseManageDataValue(dataValue),
      sourceAccount,
      transactionHash: tx.hash,
    }
  } catch {
    return null
  }
}

/**
 * Verifies that a Kuwenta filing receipt stored in our DB is still anchored on
 * Stellar and that the on-chain hash matches the locally recorded hash.
 */
export async function verifyReceiptOnChain(
  txId: string,
  returnId: string,
  storedHash: string
): Promise<VerifyResult> {
  const network = getNetwork()
  const explorerUrl = getExplorerUrl(txId)
  const checkedAt = new Date().toISOString()
  const base: VerifyResult = {
    valid: false,
    reason: null,
    txId,
    returnId,
    storedHash,
    onChainHash: null,
    onChainTimestamp: null,
    onChainKey: null,
    network,
    sourceAccount: null,
    ledgerCreatedAt: null,
    explorerUrl,
    checkedAt,
  }

  try {
    const tx = await horizon.transactions().transaction(txId).call()
    const anchor = await fetchOnChainAnchor(txId, returnId)
    if (!anchor) {
      return {
        ...base,
        reason: 'No matching kuwenta:ph manageData operation on-chain',
        sourceAccount: tx.source_account,
        ledgerCreatedAt: tx.created_at ?? null,
      }
    }
    const matches = anchor.payloadHash === storedHash
    return {
      ...base,
      valid: matches,
      reason: matches
        ? null
        : `On-chain hash ${anchor.payloadHash ?? '(missing)'} does not match stored hash`,
      onChainHash: anchor.payloadHash,
      onChainTimestamp: anchor.anchoredAt,
      onChainKey: anchor.dataKey,
      sourceAccount: anchor.sourceAccount,
      ledgerCreatedAt: tx.created_at ?? null,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Verification failed'
    return {
      ...base,
      reason: message,
    }
  }
}
