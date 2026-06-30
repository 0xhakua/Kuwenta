import Decimal from 'decimal.js'
import type { PrismaClient } from '@prisma/client'
import { VAT_THRESHOLD } from './constants'

export { VAT_THRESHOLD }
import { aggregateByQuarter, sumFullYear } from './aggregate'

type TransactionClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>

export const VAT_WARNING_THRESHOLD = VAT_THRESHOLD.times('0.80') // ₱2,400,000

export interface VatThresholdCheck {
  ytdGross: Decimal
  thresholdReached: boolean
  warningActive: boolean
  alreadyBreached: boolean
}

/**
 * Recompute the running YTD gross for a tax year and record a VAT-threshold
 * breach if the total reaches or exceeds ₱3,000,000.
 *
 * SPEC: BR-12 — Income ingestion checks running total after every 2307
 * mutation; triggers revocation at ₱3,000,000. A warning indicator is shown
 * at 80% (₱2,400,000).
 */
export async function checkAndRecordVatBreach(
  taxYearId: string,
  tx: TransactionClient
): Promise<VatThresholdCheck> {
  const taxYear = await tx.taxYear.findUnique({
    where: { id: taxYearId },
    include: { certificates: true },
  })

  if (!taxYear) {
    throw new Error(`Tax year not found: ${taxYearId}`)
  }

  const quarterly = aggregateByQuarter(taxYear.certificates)
  const ytdGross = sumFullYear(quarterly)

  const thresholdReached = ytdGross.greaterThanOrEqualTo(VAT_THRESHOLD)
  const warningActive = ytdGross.greaterThanOrEqualTo(VAT_WARNING_THRESHOLD)

  if (thresholdReached && !taxYear.vatBreached) {
    await tx.taxYear.update({
      where: { id: taxYearId },
      data: {
        vatBreached: true,
        vatBreachDate: new Date(),
      },
    })
  }

  return {
    ytdGross,
    thresholdReached,
    warningActive,
    alreadyBreached: taxYear.vatBreached,
  }
}

export function formatVatStatus(check: VatThresholdCheck) {
  return {
    ytdGross: check.ytdGross.toFixed(2),
    threshold: VAT_THRESHOLD.toFixed(2),
    warningThreshold: VAT_WARNING_THRESHOLD.toFixed(2),
    thresholdReached: check.thresholdReached,
    warningActive: check.warningActive,
    vatBreached: check.thresholdReached || check.alreadyBreached,
  }
}
