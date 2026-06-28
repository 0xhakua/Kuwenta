import Decimal from 'decimal.js'
import { INTEREST_RATE, SURCHARGE_RATE } from './constants'

export interface PenaltyInput {
  taxDue: Decimal
  daysLate: number
  compromiseFee: Decimal
}

export interface PenaltyResult {
  daysLate: number
  surcharge: Decimal
  interest: Decimal
  compromisePenalty: Decimal
  totalPenalty: Decimal
}

/**
 * Compute penalties under RA 11976 (Ease of Paying Taxes Act).
 *
 * Surcharge = 10% (was 25% under old law)
 * Interest  = 6% p.a. (was 12% under old law)
 * Applies to all Kuwenta users because gross receipts are below ₱3,000,000.
 *
 * Key rule: surcharge and interest are ₱0 when taxDue = 0, but compromise
 * penalty still applies if filing is late.
 *
 * BR-15
 */
export function computePenalties({
  taxDue,
  daysLate,
  compromiseFee,
}: PenaltyInput): PenaltyResult {
  const hasTaxDue = taxDue.greaterThan(0)
  const isLate = daysLate > 0

  const surcharge = hasTaxDue && isLate ? taxDue.times(SURCHARGE_RATE).toDecimalPlaces(2) : new Decimal('0.00')

  const interest =
    hasTaxDue && isLate
      ? taxDue
          .times(INTEREST_RATE)
          .times(daysLate)
          .dividedBy(365)
          .toDecimalPlaces(2)
      : new Decimal('0.00')

  const compromisePenalty = isLate ? compromiseFee.toDecimalPlaces(2) : new Decimal('0.00')

  const totalPenalty = surcharge.plus(interest).plus(compromisePenalty).toDecimalPlaces(2)

  return {
    daysLate,
    surcharge,
    interest,
    compromisePenalty,
    totalPenalty,
  }
}

/**
 * Number of days between the statutory due date and the filing date.
 * Returns 0 if filed on or before the due date.
 */
export function computeDaysLate(dueDate: Date, filedDate: Date): number {
  const due = startOfDay(dueDate)
  const filed = startOfDay(filedDate)
  const diff = filed.getTime() - due.getTime()
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24))
  return Math.max(days, 0)
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}
