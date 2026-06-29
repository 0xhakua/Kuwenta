import { NextResponse } from 'next/server'
import Decimal from 'decimal.js'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'
import { recascadeTaxYear } from '@/lib/computation/recascade'
import {
  generateOverpaymentJournal,
  generatePriorYearCreditJournal,
} from '@/lib/journal/generator'

const createSchema = z.object({
  amount: z.union([z.string(), z.number()]).transform((v) => String(v)),
  originYear: z.number().int(),
  originForm: z.string().min(1),
  priorDisposition: z.string().min(1),
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
          include: { priorYearCredit: true },
        },
      },
    })

    if (!profile?.taxYears[0]) {
      return NextResponse.json({ priorYearCredit: null })
    }

    return NextResponse.json({
      priorYearCredit: profile.taxYears[0].priorYearCredit,
    })
  } catch (err) {
    console.error('Get prior-year credit error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const session = await requireAuth()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const result = createSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json({ error: result.error.format() }, { status: 400 })
    }

    const data = result.data
    const amount = new Decimal(data.amount)
    if (amount.lessThanOrEqualTo(0)) {
      return NextResponse.json({ error: 'Amount must be greater than zero' }, { status: 400 })
    }

    if (data.priorDisposition !== 'CARRY_OVER') {
      return NextResponse.json(
        { error: 'Only Carry Over credits are eligible (BR-09)' },
        { status: 400 }
      )
    }

    const profile = await prisma.taxpayerProfile.findUnique({
      where: { userId: session.sub },
      include: {
        taxYears: {
          orderBy: { year: 'desc' },
          take: 1,
          include: { priorYearCredit: true },
        },
      },
    })

    if (!profile?.taxYears[0]) {
      return NextResponse.json({ error: 'No active tax year' }, { status: 400 })
    }

    const taxYear = profile.taxYears[0]

    if (data.originYear >= taxYear.year) {
      return NextResponse.json(
        { error: 'Origin year must be before the current tax year' },
        { status: 400 }
      )
    }

    if (taxYear.priorYearCredit) {
      return NextResponse.json(
        { error: 'A prior-year credit already exists for this tax year' },
        { status: 409 }
      )
    }

    const credit = await prisma.$transaction(async (tx) => {
      // If the credit is a carry-over from a prior-year Overpayment, link
      // them and stamp the prior-year settlement (drives journal 9.16).
      const priorOverpayment =
        data.priorDisposition === 'CARRY_OVER'
          ? await tx.overpayment.findFirst({
              where: {
                disposition: 'CARRY_OVER',
                taxYear: { taxpayerId: taxYear.taxpayerId, year: data.originYear },
              },
            })
          : null

      const created = await tx.priorYearCredit.create({
        data: {
          taxYearId: taxYear.id,
          amount,
          originYear: data.originYear,
          originForm: data.originForm,
          priorDisposition: data.priorDisposition,
          isValidated: true,
          userConfirmedAt: new Date(),
          sourceOverpaymentId: priorOverpayment?.id ?? null,
        },
      })

      if (priorOverpayment) {
        await tx.overpayment.update({
          where: { id: priorOverpayment.id },
          data: { carryOverAppliedAt: new Date() },
        })
      }

      await recascadeTaxYear({ taxYearId: taxYear.id, tx })
      await generatePriorYearCreditJournal(taxYear.id, created.id, tx)

      if (priorOverpayment) {
        await tx.journalEntry.deleteMany({
          where: {
            taxYearId: priorOverpayment.taxYearId,
            subsection: '9F',
          },
        })
        await generateOverpaymentJournal(
          priorOverpayment.taxYearId,
          priorOverpayment.id,
          tx
        )
      }

      return created
    })

    return NextResponse.json({ priorYearCredit: credit }, { status: 201 })
  } catch (err) {
    console.error('Create prior-year credit error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
