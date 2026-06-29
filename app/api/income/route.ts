import { NextRequest, NextResponse } from 'next/server'
import Decimal from 'decimal.js'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'
import { recascadeTaxYear } from '@/lib/computation/recascade'
import { generateIncomeRecognitionJournal } from '@/lib/journal/generator'

const certificateSchema = z.object({
  quarter: z.number().int().min(1).max(4),
  payorTin: z.string().min(1),
  payorName: z.string().min(1),
  atcCode: z.string().min(1),
  month1Amount: z.union([z.string(), z.number()]),
  month2Amount: z.union([z.string(), z.number()]),
  month3Amount: z.union([z.string(), z.number()]),
  cwtWithheld: z.union([z.string(), z.number()]),
})

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
            certificates: {
              include: { atc: true },
              orderBy: [{ quarter: 'asc' }, { payorName: 'asc' }],
            },
          },
        },
      },
    })

    if (!profile?.taxYears[0]) {
      return NextResponse.json({ certificates: [] })
    }

    return NextResponse.json({
      certificates: profile.taxYears[0].certificates.map((cert) => ({
        ...cert,
        cwtValidated: validateCwt(cert),
      })),
    })
  } catch (err) {
    console.error('List income error:', err)
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
    const result = certificateSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json({ error: result.error.format() }, { status: 400 })
    }

    const data = result.data
    const profile = await prisma.taxpayerProfile.findUnique({
      where: { userId: session.sub },
      include: {
        taxYears: {
          orderBy: { year: 'desc' },
          take: 1,
        },
      },
    })

    if (!profile?.taxYears[0]) {
      return NextResponse.json({ error: 'No active tax year' }, { status: 400 })
    }

    const taxYear = profile.taxYears[0]

    const atc = await prisma.aTCCode.findUnique({
      where: { code: data.atcCode },
    })
    if (!atc || !atc.isActive) {
      return NextResponse.json({ error: 'Invalid or inactive ATC code' }, { status: 400 })
    }

    const month1 = new Decimal(String(data.month1Amount))
    const month2 = new Decimal(String(data.month2Amount))
    const month3 = new Decimal(String(data.month3Amount))
    const quarterlyTotal = month1.plus(month2).plus(month3)
    const cwtWithheld = new Decimal(String(data.cwtWithheld))

    const expectedCwt = quarterlyTotal.times(atc.ewtRate)
    const discrepancy = cwtWithheld.minus(expectedCwt).abs()
    const cwtValidated = discrepancy.lessThanOrEqualTo(1)

    const certificate = await prisma.$transaction(async (tx) => {
      const created = await tx.form2307.create({
        data: {
          taxYearId: taxYear.id,
          quarter: data.quarter,
          payorTin: data.payorTin,
          payorName: data.payorName,
          atcCode: data.atcCode,
          month1Amount: month1,
          month2Amount: month2,
          month3Amount: month3,
          quarterlyTotal,
          cwtWithheld,
          cwtValidated,
          cwtDiscrepancy: cwtValidated ? null : discrepancy,
        },
        include: { atc: true },
      })

      await recascadeTaxYear({ taxYearId: taxYear.id, tx })
      await generateIncomeRecognitionJournal(taxYear.id, created.id, '2307_ADDED', undefined, tx)

      return created
    })

    return NextResponse.json({ certificate: { ...certificate, cwtValidated } }, { status: 201 })
  } catch (err) {
    console.error('Create income error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

function validateCwt(cert: {
  quarterlyTotal: Decimal.Value
  cwtWithheld: Decimal.Value
  atc: { ewtRate: Decimal.Value }
}): boolean {
  const expected = new Decimal(String(cert.quarterlyTotal)).times(cert.atc.ewtRate)
  const actual = new Decimal(String(cert.cwtWithheld))
  return actual.minus(expected).abs().lessThanOrEqualTo(1)
}
