import { NextResponse } from 'next/server'
import Decimal from 'decimal.js'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'
import { generateOverpaymentJournal } from '@/lib/journal/generator'

const dispositionSchema = z.object({
  disposition: z.enum(['CARRY_OVER', 'REFUND', 'TAX_CREDIT_CERTIFICATE']),
})

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ taxYear: string }> }
) {
  const session = await requireAuth()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { taxYear: yearParam } = await params
    const year = Number(yearParam)
    if (!Number.isFinite(year)) {
      return NextResponse.json({ error: 'Invalid tax year' }, { status: 400 })
    }

    const profile = await prisma.taxpayerProfile.findUnique({
      where: { userId: session.sub },
      include: {
        taxYears: {
          where: { year },
          take: 1,
          include: {
            overpayment: true,
            returns: {
              where: { formType: 'FORM_1701A' },
            },
          },
        },
      },
    })

    const taxYear = profile?.taxYears[0]
    if (!taxYear) {
      return NextResponse.json({ error: 'Tax year not found' }, { status: 404 })
    }

    const annualReturn = taxYear.returns[0]
    const computedOverpayment = annualReturn?.overpaymentAmt
      ? new Decimal(annualReturn.overpaymentAmt.toString())
      : new Decimal('0')

    return NextResponse.json({
      overpayment: taxYear.overpayment,
      computedOverpayment: computedOverpayment.toFixed(2),
      annualReturnId: annualReturn?.id ?? null,
    })
  } catch (err) {
    console.error('Get overpayment error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ taxYear: string }> }
) {
  const session = await requireAuth()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { taxYear: yearParam } = await params
    const year = Number(yearParam)
    if (!Number.isFinite(year)) {
      return NextResponse.json({ error: 'Invalid tax year' }, { status: 400 })
    }

    const body = await req.json()
    const result = dispositionSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json({ error: result.error.format() }, { status: 400 })
    }

    const { disposition } = result.data

    const profile = await prisma.taxpayerProfile.findUnique({
      where: { userId: session.sub },
      include: {
        taxYears: {
          where: { year },
          take: 1,
          include: {
            returns: {
              where: { formType: 'FORM_1701A' },
            },
          },
        },
      },
    })

    const taxYear = profile?.taxYears[0]
    if (!taxYear) {
      return NextResponse.json({ error: 'Tax year not found' }, { status: 404 })
    }

    const annualReturn = taxYear.returns[0]
    if (!annualReturn) {
      return NextResponse.json(
        { error: 'Annual return 1701A not found' },
        { status: 404 }
      )
    }

    const overpaymentAmt = annualReturn.overpaymentAmt
      ? new Decimal(annualReturn.overpaymentAmt.toString())
      : new Decimal('0')

    if (overpaymentAmt.lessThanOrEqualTo(0)) {
      return NextResponse.json(
        { error: 'No overpayment available for disposition' },
        { status: 400 }
      )
    }

    const overpayment = await prisma.overpayment.upsert({
      where: { taxYearId: taxYear.id },
      update: {
        disposition,
        electedAt: new Date(),
      },
      create: {
        taxYearId: taxYear.id,
        amount: overpaymentAmt,
        disposition,
        electedAt: new Date(),
      },
    })

    await generateOverpaymentJournal(taxYear.id, overpayment.id)

    await prisma.auditLog.create({
      data: {
        userId: session.sub,
        action: 'OVERPAYMENT_DISPOSITION_SET',
        entityType: 'TaxYear',
        entityId: taxYear.id,
        metadata: {
          year,
          disposition,
          amount: overpaymentAmt.toFixed(2),
        },
      },
    })

    return NextResponse.json({ overpayment })
  } catch (err) {
    console.error('Set overpayment disposition error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
