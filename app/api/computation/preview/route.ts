import { NextResponse } from 'next/server'
import Decimal from 'decimal.js'
import { requireAuth } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'
import { formatPeso } from '@/lib/format'
import { aggregateByQuarter, sumFullYear, sumFullYearCwt } from '@/lib/computation/aggregate'
import { computeAnnualIncomeTaxBreakdown } from '@/lib/computation/annual-income'
import type { IncomeTypeValue, TaxRateValue } from '@/lib/computation/constants'

type Money = { raw: string; formatted: string }

function money(value: Decimal): Money {
  return { raw: value.toFixed(2), formatted: formatPeso(value) }
}

type CreditStep = {
  order: number
  type: 'PRIOR_YEAR_CREDIT' | 'QUARTERLY_PAYMENTS' | 'CWT'
  description: string
  amount: Money
}

export async function GET() {
  const session = await requireAuth()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const profile = await prisma.taxpayerProfile.findUnique({
      where: { userId: session.sub },
      include: {
        taxYears: {
          orderBy: { year: 'desc' },
          take: 1,
          include: {
            taxpayer: true,
            certificates: true,
            priorYearCredit: true,
            returns: {
              where: { formType: 'FORM_1701Q' },
            },
          },
        },
      },
    })

    if (!profile?.taxYears[0]) {
      return NextResponse.json({ error: 'No active tax year' }, { status: 404 })
    }

    const taxYear = profile.taxYears[0]
    const incomeType = taxYear.taxpayer.incomeType as IncomeTypeValue
    // Read the elected rate from the TaxYear so the preview matches the user's
    // election. If no election has been recorded yet (NOT_ELECTED), default
    // to the 8% flat rate — the BIR default, and what the dashboard and
    // recascade paths will use once the election is confirmed.
    const electedRate: TaxRateValue = taxYear.electedRate ?? 'RATE_8PCT'
    // S7.6 (#117): 40% Optional Standard Deduction. Defaults to false
    // so the 250k 0% bracket is the standard graduated path. The
    // election is mutually exclusive with the 8% flat rate; the
    // election API enforces that, so the preview just reads the flag.
    const osdElection = taxYear.osdElection

    const quarterly = aggregateByQuarter(taxYear.certificates)
    const fullYearGross = sumFullYear(quarterly)
    const cwtWithheld = sumFullYearCwt(quarterly)
    const priorYearCredit = taxYear.priorYearCredit?.amount ?? new Decimal('0')

    // Quarterly payments may be null on the TaxReturn row when the
    // recascade hasn't populated them (e.g. a fresh graduated election
    // before any 1701Q is generated). Treat null as zero.
    const quarterlyPayments = taxYear.returns.reduce(
      (sum, ret) => sum.plus(ret.netTaxDue ?? 0),
      new Decimal('0')
    )

    const breakdown = computeAnnualIncomeTaxBreakdown(
      fullYearGross,
      priorYearCredit,
      quarterlyPayments,
      cwtWithheld,
      incomeType,
      electedRate,
      osdElection
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

    return NextResponse.json({
      preview: true,
      taxYear: taxYear.year,
      incomeType,
      electedRate,
      osdElection,
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
    })
  } catch (err) {
    console.error('Get computation preview error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
