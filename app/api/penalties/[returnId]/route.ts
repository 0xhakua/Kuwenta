import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'
import { determineReturnStatus } from '@/lib/computation/sequence'
import { computePenaltyBase, computeLivePenaltyDetail } from '@/lib/computation/penalty-base'
import type { IncomeTypeValue } from '@/lib/computation/constants'

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
      return NextResponse.json({ error: 'No active tax year' }, { status: 404 })
    }

    const taxYear = profile.taxYears[0]
    const ret = taxYear.returns.find((r) => r.id === returnId)
    if (!ret) {
      return NextResponse.json({ error: 'Return not found' }, { status: 404 })
    }

    const incomeType = taxYear.taxpayer.incomeType as IncomeTypeValue
    const rdoCode = taxYear.taxpayer.rdoCode

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

    return NextResponse.json({
      returnId: ret.id,
      formType: ret.formType,
      quarter: ret.quarter,
      status,
      statutoryDueDate: ret.statutoryDueDate.toISOString(),
      penalties,
    })
  } catch (err) {
    console.error('Get penalty error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
