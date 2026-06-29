import { NextResponse } from 'next/server'
import Decimal from 'decimal.js'
import { requireAuth } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'

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
            journalEntries: {
              include: { lines: true },
            },
          },
        },
      },
    })

    const taxYear = profile?.taxYears[0]
    if (!taxYear) {
      return NextResponse.json({ taxYear: null, accounts: [] })
    }

    const map = new Map<
      string,
      { name: string; debit: Decimal; credit: Decimal }
    >()

    for (const entry of taxYear.journalEntries) {
      for (const line of entry.lines) {
        const existing = map.get(line.accountCode)
        const debit = line.debit ? new Decimal(line.debit.toString()) : new Decimal('0')
        const credit = line.credit ? new Decimal(line.credit.toString()) : new Decimal('0')
        if (existing) {
          existing.debit = existing.debit.plus(debit)
          existing.credit = existing.credit.plus(credit)
        } else {
          map.set(line.accountCode, { name: line.accountName, debit, credit })
        }
      }
    }

    const accounts = Array.from(map.entries())
      .map(([code, { name, debit, credit }]) => ({
        code,
        name,
        debitTotal: debit.toFixed(2),
        creditTotal: credit.toFixed(2),
      }))
      .sort((a, b) => a.code.localeCompare(b.code))

    return NextResponse.json({ taxYear: taxYear.year, accounts })
  } catch (err) {
    console.error('List journal accounts error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
