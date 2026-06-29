import Decimal from 'decimal.js'
import type { PrismaClient } from '@prisma/client'
import { prisma } from '../prisma'
import { computeAnnualIncomeTax, computeQuarterlyIncomeTax } from './income-tax'
import { computePercentageTax } from './percentage-tax'
import { computePenalties, computeDaysLate } from './penalties'
import type { IncomeTypeValue } from './constants'
import {
  aggregateByQuarter,
  sumUpToQuarter,
  sumCwtUpToQuarter,
  sumFullYear,
  sumFullYearCwt,
} from './aggregate'

type TransactionClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>

interface RecascadeInput {
  taxYearId: string
  tx?: TransactionClient
}

/**
 * Recompute all return values for a tax year whenever income changes.
 *
 * Affected returns:
 * - 2551Q Q1–Q4: percentage tax recomputed per quarter
 * - 1701Q Q1–Q3: cumulative income tax recomputed
 * - 1701A Annual: full-year income tax recomputed
 *
 * Penalties are also recalculated for any return not yet filed.
 */
export async function recascadeTaxYear({ taxYearId, tx }: RecascadeInput): Promise<void> {
  const db = tx ?? prisma

  const taxYear = await db.taxYear.findUnique({
    where: { id: taxYearId },
    include: {
      taxpayer: true,
      certificates: true,
      returns: {
        include: {
          penalties: true,
        },
      },
      priorYearCredit: true,
    },
  })

  if (!taxYear) throw new Error(`Tax year not found: ${taxYearId}`)

  const incomeType: IncomeTypeValue = taxYear.taxpayer.incomeType
  const electedRate = taxYear.electedRate

  // Aggregate certificates by quarter
  const quarterly = aggregateByQuarter(taxYear.certificates)

  // Recompute 2551Q returns
  for (const ret of taxYear.returns.filter((r) => r.formType === 'FORM_2551Q')) {
    const q = ret.quarter ?? 0
    const gross = quarterly[q]?.gross ?? new Decimal('0')
    const taxDue = computePercentageTax(gross, electedRate)

    await db.taxReturn.update({
      where: { id: ret.id },
      data: {
        computedTaxDue: taxDue,
        taxCreditsTotal: new Decimal('0'),
        netTaxDue: taxDue,
        overpaymentAmt: new Decimal('0'),
      },
    })

    await recomputePenalty(ret.id, taxDue, taxYear.taxpayer.rdoCode, db)
  }

  // Recompute 1701Q returns (cumulative)
  // Under the 8% flat rate (or before election preview) we use the 8% formulas.
  // Graduated-rate computations are not yet implemented.
  const quarterKeys = [1, 2, 3] as const
  let priorQuartersTaxPaid = new Decimal('0')
  let quarterlyPaymentsCash = new Decimal('0')
  const useEightPctComputation = electedRate !== 'GRADUATED'

  for (const q of quarterKeys) {
    const ret = taxYear.returns.find((r) => r.formType === 'FORM_1701Q' && r.quarter === q)
    if (!ret) continue

    if (!useEightPctComputation) {
      await db.taxReturn.update({
        where: { id: ret.id },
        data: {
          computedTaxDue: null,
          taxCreditsTotal: null,
          netTaxDue: null,
          overpaymentAmt: null,
        },
      })
      await recomputePenalty(ret.id, new Decimal('0'), taxYear.taxpayer.rdoCode, db)
      continue
    }

    const cumulativeGross = sumUpToQuarter(quarterly, q)
    const taxDue = computeQuarterlyIncomeTax(cumulativeGross, priorQuartersTaxPaid, incomeType)

    const cumulativeCwt = sumCwtUpToQuarter(quarterly, q)
    const netTaxDue = Decimal.max(taxDue.minus(cumulativeCwt), 0)
    const overpayment = Decimal.max(cumulativeCwt.minus(taxDue), 0)

    await db.taxReturn.update({
      where: { id: ret.id },
      data: {
        computedTaxDue: taxDue,
        taxCreditsTotal: cumulativeCwt,
        netTaxDue,
        overpaymentAmt: overpayment,
      },
    })

    await recomputePenalty(ret.id, netTaxDue, taxYear.taxpayer.rdoCode, db)

    // For the next quarter's cumulative computation, add the full tax due
    // (whether paid by cash or CWT). For the annual return, only cash paid
    // counts as a quarterly payment credit.
    priorQuartersTaxPaid = priorQuartersTaxPaid.plus(taxDue)
    quarterlyPaymentsCash = quarterlyPaymentsCash.plus(netTaxDue)
  }

  // Recompute 1701A annual return
  const annualReturn = taxYear.returns.find((r) => r.formType === 'FORM_1701A')
  if (annualReturn) {
    if (!useEightPctComputation) {
      await db.taxReturn.update({
        where: { id: annualReturn.id },
        data: {
          computedTaxDue: null,
          taxCreditsTotal: null,
          netTaxDue: null,
          overpaymentAmt: null,
        },
      })
      await recomputePenalty(annualReturn.id, new Decimal('0'), taxYear.taxpayer.rdoCode, db)
    } else {
      const fullYearGross = sumFullYear(quarterly)
      const cwtWithheld = sumFullYearCwt(quarterly)
      const priorYearCredit = taxYear.priorYearCredit?.amount ?? new Decimal('0')

      const { taxDue, totalCredits, netPosition } = computeAnnualIncomeTax(
        fullYearGross,
        priorYearCredit,
        quarterlyPaymentsCash,
        cwtWithheld,
        incomeType
      )

      await db.taxReturn.update({
        where: { id: annualReturn.id },
        data: {
          computedTaxDue: taxDue,
          taxCreditsTotal: totalCredits,
          netTaxDue: Decimal.max(netPosition, 0),
          overpaymentAmt: Decimal.max(netPosition.negated(), 0),
        },
      })

      await recomputePenalty(annualReturn.id, Decimal.max(netPosition, 0), taxYear.taxpayer.rdoCode, db)
    }
  }
}

async function recomputePenalty(
  returnId: string,
  taxDue: Decimal,
  rdoCode: string,
  tx: TransactionClient = prisma
) {
  const ret = await tx.taxReturn.findUnique({
    where: { id: returnId },
    include: { penalties: true },
  })
  if (!ret || ret.status === 'FILED') return

  const schedule = await tx.rDOPenaltySchedule.findUnique({
    where: { rdoCode },
  })
  const compromiseFee = schedule?.compromiseFee ?? new Decimal('0')

  const now = new Date()
  const daysLate = computeDaysLate(ret.statutoryDueDate, now)
  const penalty = computePenalties({ taxDue, daysLate, compromiseFee })

  await tx.returnPenalty.upsert({
    where: { returnId: ret.id },
    update: {
      daysLate: penalty.daysLate,
      surcharge: penalty.surcharge,
      interest: penalty.interest,
      compromisePenalty: penalty.compromisePenalty,
      totalPenalty: penalty.totalPenalty,
      computedAt: new Date(),
    },
    create: {
      returnId: ret.id,
      daysLate: penalty.daysLate,
      surcharge: penalty.surcharge,
      interest: penalty.interest,
      compromisePenalty: penalty.compromisePenalty,
      totalPenalty: penalty.totalPenalty,
    },
  })
}
