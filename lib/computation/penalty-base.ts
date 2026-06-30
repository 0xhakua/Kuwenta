import Decimal from 'decimal.js'
import { prisma } from '../prisma'
import { formatPeso } from '../format'
import {
  aggregateByQuarter,
  sumUpToQuarter,
  sumCwtUpToQuarter,
  sumFullYear,
  sumFullYearCwt,
  sumQuarterlyPayments,
} from './aggregate'
import { computePercentageTax } from './percentage-tax'
import { computeQuarterlyIncomeTax } from './quarterly-income'
import { computeAnnualIncomeTax } from './annual-income'
import { computePenalties, computeDaysLate } from './penalties'
import type { IncomeTypeValue } from './constants'

export type Money = { raw: string; formatted: string }

export function money(value: Decimal): Money {
  return { raw: value.toFixed(2), formatted: formatPeso(value) }
}

export type PenaltyDetail = {
  daysLate: number
  surcharge: Money
  interest: Money
  compromise: Money
  total: Money
}

export type TaxYearForPenalty = {
  electedRate: 'RATE_8PCT' | 'GRADUATED' | null
  priorYearCredit?: { amount: Decimal } | null
  certificates: Array<{
    quarter: number
    quarterlyTotal: Decimal.Value
    cwtWithheld: Decimal.Value
  }>
  returns: Array<{
    formType: string
    quarter: number | null
    netTaxDue: Decimal.Value | null
  }>
}

export type ReturnForPenalty = {
  id: string
  formType: 'FORM_2551Q' | 'FORM_1701Q' | 'FORM_1701A' | 'FORM_1701'
  quarter: number | null
  computedTaxDue: Decimal.Value | null
  netTaxDue: Decimal.Value | null
  statutoryDueDate: Date
}

/**
 * Default compromise fee (₱1,000) used when no `RDOPenaltySchedule` row exists
 * for the taxpayer's RDO. Mirrors the BIR's minimum compromise for individual
 * taxpayers; admins can override per-RDO via the admin RDO-penalties screen.
 */
export const DEFAULT_COMPROMISE_FEE = new Decimal('1000')

/**
 * Compute the tax-due base used for penalty calculations.
 *
 * This recomputes values fresh from certificate data so that penalties can be
 * calculated even before a return has been generated.
 *
 * - 2551Q: percentage tax on quarterly gross.
 * - 1701Q: cumulative income tax net of prior quarters and CWT.
 * - 1701A: full-year income tax net of credits.
 *
 * For non-8% elections, 1701Q/1701A base is ₱0 because graduated-rate
 * computations are not yet implemented.
 */
export function computePenaltyBase(
  ret: ReturnForPenalty,
  taxYear: TaxYearForPenalty,
  incomeType: IncomeTypeValue
): Decimal {
  const quarterly = aggregateByQuarter(taxYear.certificates)

  if (ret.formType === 'FORM_2551Q') {
    const quarter = ret.quarter ?? 0
    const gross = quarterly[quarter]?.gross ?? new Decimal('0')
    return computePercentageTax(gross, taxYear.electedRate)
  }

  if (taxYear.electedRate !== 'RATE_8PCT') {
    // Graduated-rate computations are not implemented; no tax due base.
    return new Decimal('0')
  }

  if (ret.formType === 'FORM_1701Q') {
    const targetQuarter = ret.quarter ?? 0
    // Accumulate the full tax due from prior quarters (before CWT), not the
    // cash paid. CWT credits do not reduce the cumulative tax base for the
    // next quarter's computation.
    let priorQuartersTaxPaid = new Decimal('0')

    for (let q = 1; q <= targetQuarter; q++) {
      const cumulativeGross = sumUpToQuarter(quarterly, q)
      const taxDue = computeQuarterlyIncomeTax(
        cumulativeGross,
        priorQuartersTaxPaid,
        incomeType
      )
      const cumulativeCwt = sumCwtUpToQuarter(quarterly, q)
      const netTaxDue = Decimal.max(taxDue.minus(cumulativeCwt), 0).toDecimalPlaces(2)

      if (q === targetQuarter) {
        return netTaxDue
      }

      priorQuartersTaxPaid = priorQuartersTaxPaid.plus(taxDue)
    }

    return new Decimal('0')
  }

  // FORM_1701A
  const fullYearGross = sumFullYear(quarterly)
  const cwtWithheld = sumFullYearCwt(quarterly)
  const priorYearCredit = taxYear.priorYearCredit?.amount ?? new Decimal('0')
  const quarterlyPayments = sumQuarterlyPayments(taxYear.returns)

  const { netPosition } = computeAnnualIncomeTax(
    fullYearGross,
    priorYearCredit,
    quarterlyPayments,
    cwtWithheld,
    incomeType
  )
  return Decimal.max(netPosition, 0)
}

/**
 * Compute live penalties as of a specific filing date.
 *
 * The compromise fee is resolved from the `RDOPenaltySchedule` row matching
 * `rdoCode`. If no schedule row exists (e.g. an unconfigured RDO), the fee
 * falls back to `DEFAULT_COMPROMISE_FEE`.
 */
export async function computePenaltyDetail(
  taxDue: Decimal,
  statutoryDueDate: Date,
  rdoCode: string,
  filedDate: Date
): Promise<PenaltyDetail> {
  const daysLate = computeDaysLate(statutoryDueDate, filedDate)
  const schedule = await prisma.rDOPenaltySchedule.findUnique({ where: { rdoCode } })
  const compromiseFee = schedule?.compromiseFee ?? DEFAULT_COMPROMISE_FEE
  const penalty = computePenalties({ taxDue, daysLate, compromiseFee })

  return {
    daysLate: penalty.daysLate,
    surcharge: money(penalty.surcharge),
    interest: money(penalty.interest),
    compromise: money(penalty.compromisePenalty),
    total: money(penalty.totalPenalty),
  }
}

/**
 * Compute live penalties as of today.
 */
export async function computeLivePenaltyDetail(
  taxDue: Decimal,
  statutoryDueDate: Date,
  rdoCode: string
): Promise<PenaltyDetail> {
  return computePenaltyDetail(taxDue, statutoryDueDate, rdoCode, new Date())
}
