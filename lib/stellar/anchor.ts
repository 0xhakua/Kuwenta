import crypto from 'crypto'
import {
  horizon,
  networkPassphrase,
  getSystemKeypair,
} from './client'
import { TransactionBuilder, Operation, BASE_FEE } from '@stellar/stellar-sdk'
import { writeFile, readFile } from '../storage'

export interface AnchorResult {
  stellarTxId: string
  payloadHash: string
  explorerUrl: string
  status: 'PENDING' | 'CONFIRMED' | 'FAILED'
}

function getExplorerUrl(txId: string): string {
  const network = process.env.STELLAR_NETWORK === 'mainnet' ? 'public' : 'testnet'
  return `https://stellar.expert/explorer/${network}/tx/${txId}`
}

function computePayloadHash(pdfBuffer: Buffer): string {
  return crypto.createHash('sha256').update(pdfBuffer).digest('hex')
}

/**
 * Anchor a filing receipt on Stellar using a manageData operation.
 *
 * The key is prefixed with `kuwenta:ph:` and truncated to 64 bytes, as required
 * by the Stellar manageData name limit. The value combines the SHA-256 hash of
 * the filing PDF with the ISO filing timestamp and is also truncated to 64
 * bytes.
 *
 * A Stellar failure must NOT prevent the return from being marked as filed.
 * This function catches all Stellar errors and returns a FAILED status so the
 * caller can persist a StellarReceipt record and surface a retry option.
 */
export async function anchorFilingReceipt(
  returnId: string,
  pdfBuffer: Buffer
): Promise<AnchorResult> {
  const payloadHash = computePayloadHash(pdfBuffer)

  try {
    const keypair = getSystemKeypair()
    const account = await horizon.loadAccount(keypair.publicKey())

    const filedDate = new Date().toISOString()
    const dataKey = `kuwenta:ph:${returnId}`.substring(0, 64)
    const dataValue = `${payloadHash}:${filedDate}`.substring(0, 64)

    const tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase,
    })
      .addOperation(
        Operation.manageData({
          name: dataKey,
          value: dataValue,
        })
      )
      .setTimeout(60)
      .build()

    tx.sign(keypair)
    const result = await horizon.submitTransaction(tx)

    return {
      stellarTxId: result.hash,
      payloadHash,
      explorerUrl: getExplorerUrl(result.hash),
      status: 'CONFIRMED',
    }
  } catch (err) {
    console.error('Stellar anchor failed for return', returnId, err)
    return {
      stellarTxId: `failed-${returnId}`,
      payloadHash,
      explorerUrl: '',
      status: 'FAILED',
    }
  }
}

export async function storeFilingPackage(
  taxYearId: string,
  returnId: string,
  pdfBuffer: Buffer
): Promise<string> {
  const localPath = `returns/${taxYearId}/${returnId}/generated.pdf`
  return writeFile(localPath, pdfBuffer)
}

/**
 * Retry anchoring for a return whose previous Stellar receipt failed.
 *
 * Reads the previously stored PDF and re-submits the manageData operation.
 */
export async function retryAnchorFilingReceipt(
  returnId: string,
  pdfPath: string
): Promise<AnchorResult> {
  const pdfBuffer = await readFile(pdfPath)
  return anchorFilingReceipt(returnId, pdfBuffer)
}
