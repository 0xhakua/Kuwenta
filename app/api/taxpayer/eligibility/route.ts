import { NextRequest, NextResponse } from 'next/server'
import Decimal from 'decimal.js'
import { requireAuth } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'
import { checkEligibility } from '@/lib/computation/eligibility'
import { VAT_THRESHOLD } from '@/lib/computation/constants'

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
          include: { certificates: true },
        },
      },
    })

    if (!profile) {
      return NextResponse.json({ error: 'Taxpayer profile not found' }, { status: 404 })
    }

    const currentYear = profile.taxYears[0]
    const grossReceipts = currentYear
      ? currentYear.certificates.reduce(
          (sum, cert) => sum.plus(cert.quarterlyTotal),
          new Decimal('0')
        )
      : new Decimal('0')

    const eligibility = checkEligibility({
      isIndividual: true,
      hasSelfEmploymentIncome:
        profile.incomeType === 'PURE_SELF_EMPLOYMENT' || profile.incomeType === 'MIXED_INCOME',
      isNonVatRegistered: true,
      grossReceipts,
      hasPriorQ1GraduatedReturn: false,
    })

    return NextResponse.json({
      ...eligibility,
      grossReceipts: grossReceipts.toString(),
      vatThreshold: VAT_THRESHOLD.toString(),
    })
  } catch (err) {
    console.error('Eligibility check error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const session = await requireAuth()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const grossReceipts = body.grossReceipts ? new Decimal(String(body.grossReceipts)) : new Decimal('0')

    const eligibility = checkEligibility({
      isIndividual: true,
      hasSelfEmploymentIncome: body.incomeType === 'PURE_SELF_EMPLOYMENT' || body.incomeType === 'MIXED_INCOME',
      isNonVatRegistered: true,
      grossReceipts,
      hasPriorQ1GraduatedReturn: false,
    })

    return NextResponse.json({
      ...eligibility,
      grossReceipts: grossReceipts.toString(),
      vatThreshold: VAT_THRESHOLD.toString(),
    })
  } catch (err) {
    console.error('Eligibility preview error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
