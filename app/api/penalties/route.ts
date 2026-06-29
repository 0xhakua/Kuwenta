import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'
import { determineReturnStatus } from '@/lib/computation/sequence'
import { computePenaltyBase, computeLivePenaltyDetail } from '@/lib/computation/penalty-base'
import type { IncomeTypeValue } from '@/lib/computation/constants'

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
              orderBy: { sequenceOrder: 'asc' },
            },
          },
        },
      },
    })

    if (!profile?.taxYears[0]) {
      return NextResponse.json({ taxYear: null, items: [] })
    }

    const taxYear = profile.taxYears[0]
    const incomeType = taxYear.taxpayer.incomeType as IncomeTypeValue
    const rdoCode = taxYear.taxpayer.rdoCode

    const items = await Promise.all(
      taxYear.returns.map(async (ret) => {
        const penaltyBase = computePenaltyBase(ret, taxYear, incomeType)
        const penalties = await computeLivePenaltyDetail(
          penaltyBase,
          ret.statutoryDueDate,
          rdoCode
        )

        const status = determineReturnStatus(
          ret.sequenceOrder,
          taxYear.returns,
          profile.corIncludes2551Q
        )

        return {
          returnId: ret.id,
          formType: ret.formType,
          quarter: ret.quarter,
          status,
          statutoryDueDate: ret.statutoryDueDate.toISOString(),
          penalties,
        }
      })
    )

    return NextResponse.json({ taxYear: taxYear.year, items })
  } catch (err) {
    console.error('List penalties error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
