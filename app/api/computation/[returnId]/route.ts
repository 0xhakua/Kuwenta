import { NextResponse } from 'next/server'
import Decimal from 'decimal.js'
import { requireAuth } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'
import { formatPeso } from '@/lib/format'
import {
  aggregateByQuarter,
  sumUpToQuarter,
  sumCwtUpToQuarter,
  sumFullYear,
  sumFullYearCwt,
  sumPriorQuartersTaxPaid,
  sumQuarterlyPayments,
} from '@/lib/computation/aggregate'
import { computeQuarterlyIncomeTaxBreakdown } from '@/lib/computation/quarterly-income'
import { computeAnnualIncomeTaxBreakdown } from '@/lib/computation/annual-income'
import { computePercentageTax } from '@/lib/computation/percentage-tax'
import { computePenaltyBase, computeLivePenaltyDetail } from '@/lib/computation/penalty-base'
import type { IncomeTypeValue, TaxRateValue } from '@/lib/computation/constants'

type Money = { raw: string; formatted: string }

function money(value: Decimal): Money {
  return { raw: value.toFixed(2), formatted: formatPeso(value) }
}

type SourceIncomeRow = {
  quarter: number
  payorName: string
  payorTin: string
  atcCode: string
  atcDescription: string
  quarterlyTotal: Money
  cwtWithheld: Money
}

type CreditStep = {
  order: number
  type: 'PRIOR_YEAR_CREDIT' | 'QUARTERLY_PAYMENTS' | 'CWT'
  description: string
  amount: Money
}

type PenaltyDetail = {
  daysLate: number
  surcharge: Money
  interest: Money
  compromise: Money
  total: Money
}

type ComputationResponse =
  | {
      returnId: string
      formType: 'FORM_2551Q'
      quarter: number
      electedRate: 'RATE_8PCT' | 'GRADUATED' | null
      grossReceipts: Money
      taxDue: Money
      explanation: string
      penalties: PenaltyDetail
      sourceIncome: SourceIncomeRow[]
    }
  | {
      returnId: string
      formType: 'FORM_1701Q'
      quarter: number
      incomeType: IncomeTypeValue
      electedRate: TaxRateValue
      cumulativeGross: Money
      exemption: Money
      taxableIncome: Money
      taxDueAt8Percent: Money
      priorQuartersTaxPaid: Money
      cwtApplied: Money
      netTaxDue: Money
      overpayment: Money
      creditApplicationSequence: CreditStep[]
      penalties: PenaltyDetail
      sourceIncome: SourceIncomeRow[]
    }
  | {
      returnId: string
      formType: 'FORM_1701A' | 'FORM_1701'
      incomeType: IncomeTypeValue
      electedRate: TaxRateValue
      fullYearGross: Money
      exemption: Money
      taxableIncome: Money
      taxDue: Money
      priorYearCredit: Money
      quarterlyPayments: Money
      cwtWithheld: Money
      totalCredits: Money
      netTaxDue: Money
      overpayment: Money
      creditApplicationSequence: CreditStep[]
      penalties: PenaltyDetail
      sourceIncome: SourceIncomeRow[]
    }

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ returnId: string }> }
) {
  const session = await requireAuth()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { returnId } = await params

    const profile = await prisma.taxpayerProfile.findUnique({
      where: { userId: session.sub },
      include: {
        taxYears: {
          orderBy: { year: 'desc' },
          take: 1,
          include: {
            taxpayer: true,
            certificates: { include: { atc: true } },
            priorYearCredit: true,
            returns: {
              orderBy: { sequenceOrder: 'asc' },
              include: { penalties: true },
            },
          },
        },
      },
    })

    if (!profile?.taxYears[0]) {
      return NextResponse.json({ error: 'No active tax year' }, { status: 404 })
    }

    const taxYear = profile.taxYears[0]
    const ret = taxYear.returns.find((r) => r.id === returnId)
    if (!ret) {
      return NextResponse.json({ error: 'Return not found' }, { status: 404 })
    }
    const incomeType = taxYear.taxpayer.incomeType as IncomeTypeValue
    // taxYear.electedRate is TaxRate | null (Prisma enum). Default to
    // RATE_8PCT when no election has been recorded so the route returns
    // a 2551Q explanation and 1701Q/1701A breakdown that match what
    // the user sees on the dashboard before they elect a rate. See
    // #115 / #122.
    const electedRate: TaxRateValue = taxYear.electedRate ?? 'RATE_8PCT'
    const rdoCode = taxYear.taxpayer.rdoCode

    const quarterly = aggregateByQuarter(taxYear.certificates)

    const penaltyBase = computePenaltyBase(ret, taxYear, incomeType)
    const penalties = await computeLivePenaltyDetail(penaltyBase, ret.statutoryDueDate, rdoCode)
    const sourceIncome = buildSourceIncome(taxYear.certificates, ret.formType, ret.quarter)

    let response: ComputationResponse

    if (ret.formType === 'FORM_2551Q') {
      const quarter = ret.quarter ?? 0
      const gross = quarterly[quarter]?.gross ?? new Decimal('0')
      const taxDue = computePercentageTax(gross, electedRate)

      response = {
        returnId: ret.id,
        formType: 'FORM_2551Q',
        quarter,
        electedRate,
        grossReceipts: money(gross),
        taxDue: money(taxDue),
        explanation:
          electedRate === 'RATE_8PCT'
            ? '8% flat rate eliminates percentage tax (BR-04).'
            : 'Graduated rate: percentage tax is 3% of quarterly gross receipts.',
        penalties,
        sourceIncome,
      }
    } else if (ret.formType === 'FORM_1701Q') {
      const quarter = ret.quarter ?? 0
      const cumulativeGross = sumUpToQuarter(quarterly, quarter)
      const priorQuartersTaxPaid = sumPriorQuartersTaxPaid(taxYear.returns, quarter)
      const breakdown = computeQuarterlyIncomeTaxBreakdown(
        cumulativeGross,
        priorQuartersTaxPaid,
        incomeType,
        electedRate
      )
      const cumulativeCwt = sumCwtUpToQuarter(quarterly, quarter)
      const remainingTaxDueBeforeCwt = breakdown.netTaxDue
      const cwtApplied = Decimal.min(cumulativeCwt, remainingTaxDueBeforeCwt)
      const netTaxDue = Decimal.max(remainingTaxDueBeforeCwt.minus(cumulativeCwt), 0)
      const overpayment = Decimal.max(cumulativeCwt.minus(remainingTaxDueBeforeCwt), 0)

      const creditSequence: CreditStep[] = []
      let order = 1
      if (breakdown.priorQuartersTaxPaid.greaterThan(0)) {
        creditSequence.push({
          order: order++,
          type: 'QUARTERLY_PAYMENTS',
          description: 'Prior quarters tax paid applied',
          amount: money(breakdown.priorQuartersTaxPaid),
        })
      }
      if (cwtApplied.greaterThan(0)) {
        creditSequence.push({
          order: order++,
          type: 'CWT',
          description: 'Creditable withholding tax applied',
          amount: money(cwtApplied),
        })
      }

      response = {
        returnId: ret.id,
        formType: 'FORM_1701Q',
        quarter,
        incomeType,
        electedRate,
        cumulativeGross: money(breakdown.cumulativeGross),
        exemption: money(breakdown.exemption),
        taxableIncome: money(breakdown.taxableIncome),
        taxDueAt8Percent: money(breakdown.taxDue),
        priorQuartersTaxPaid: money(breakdown.priorQuartersTaxPaid),
        cwtApplied: money(cwtApplied),
        netTaxDue: money(netTaxDue),
        overpayment: money(overpayment),
        creditApplicationSequence: creditSequence,
        penalties,
        sourceIncome,
      }
    } else {
      // FORM_1701A or FORM_1701 (mixed-income annual). The elected rate
      // is threaded into computeAnnualIncomeTaxBreakdown so the live
      // breakdown matches what the recascade writes to the row.
      const fullYearGross = sumFullYear(quarterly)
      const cwtWithheld = sumFullYearCwt(quarterly)
      const priorYearCredit = taxYear.priorYearCredit?.amount ?? new Decimal('0')
      const quarterlyPayments = sumQuarterlyPayments(taxYear.returns)

      const breakdown = computeAnnualIncomeTaxBreakdown(
        fullYearGross,
        priorYearCredit,
        quarterlyPayments,
        cwtWithheld,
        incomeType,
        electedRate
      )

      const netTaxDue = Decimal.max(breakdown.netPosition, 0)
      const overpayment = breakdown.overpayment

      const creditSequence: CreditStep[] = []
      let order = 1
      if (priorYearCredit.greaterThan(0)) {
        creditSequence.push({
          order: order++,
          type: 'PRIOR_YEAR_CREDIT',
          description: 'Prior year credit applied',
          amount: money(priorYearCredit),
        })
      }
      if (quarterlyPayments.greaterThan(0)) {
        creditSequence.push({
          order: order++,
          type: 'QUARTERLY_PAYMENTS',
          description: 'Q1–Q3 quarterly payments applied',
          amount: money(quarterlyPayments),
        })
      }
      if (cwtWithheld.greaterThan(0)) {
        creditSequence.push({
          order: order++,
          type: 'CWT',
          description: 'Creditable withholding tax applied',
          amount: money(cwtWithheld),
        })
      }

      response = {
        returnId: ret.id,
        formType: ret.formType,
        incomeType,
        electedRate,
        fullYearGross: money(breakdown.fullYearGross),
        exemption: money(breakdown.exemption),
        taxableIncome: money(breakdown.taxableIncome),
        taxDue: money(breakdown.taxDue),
        priorYearCredit: money(breakdown.priorYearCredit),
        quarterlyPayments: money(breakdown.quarterlyPayments),
        cwtWithheld: money(breakdown.cwtWithheld),
        totalCredits: money(breakdown.totalCredits),
        netTaxDue: money(netTaxDue),
        overpayment: money(overpayment),
        creditApplicationSequence: creditSequence,
        penalties,
        sourceIncome,
      }
    }

    return NextResponse.json(response)
  } catch (err) {
    console.error('Get computation breakdown error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

function buildSourceIncome(
  certificates: Array<{
    quarter: number
    payorName: string
    payorTin: string
    atcCode: string
    atc: { description: string }
    quarterlyTotal: Decimal.Value
    cwtWithheld: Decimal.Value
  }>,
  formType: string,
  quarter: number | null
): SourceIncomeRow[] {
  return certificates
    .filter((cert) => {
      if (formType === 'FORM_2551Q') return cert.quarter === quarter
      if (formType === 'FORM_1701Q') return cert.quarter <= (quarter ?? 0)
      return true
    })
    .map((cert) => ({
      quarter: cert.quarter,
      payorName: cert.payorName,
      payorTin: cert.payorTin,
      atcCode: cert.atcCode,
      atcDescription: cert.atc.description,
      quarterlyTotal: money(new Decimal(cert.quarterlyTotal)),
      cwtWithheld: money(new Decimal(cert.cwtWithheld)),
    }))
}

