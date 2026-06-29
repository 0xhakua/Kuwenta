import { NextResponse } from 'next/server'
import Decimal from 'decimal.js'
import { requireAuth } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'
import {
  buildJournalListWhere,
  parseAccountNameFilter,
  parseQuarterFilter,
  parseSubsectionFilter,
} from '@/lib/journal/query'

export async function GET(req: Request) {
  const session = await requireAuth()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const url = new URL(req.url)
    const subsection = parseSubsectionFilter(url.searchParams.get('subsection'))
    if (typeof subsection === 'object' && 'error' in subsection) {
      return NextResponse.json({ error: subsection.error }, { status: 400 })
    }
    const quarter = parseQuarterFilter(url.searchParams.get('quarter'))
    if (typeof quarter === 'object' && 'error' in quarter) {
      return NextResponse.json({ error: quarter.error }, { status: 400 })
    }
    const accountName = parseAccountNameFilter(url.searchParams.get('accountName'))

    const profile = await prisma.taxpayerProfile.findUnique({
      where: { userId: session.sub },
      include: {
        taxYears: {
          orderBy: { year: 'desc' },
          take: 1,
        },
      },
    })

    const taxYear = profile?.taxYears[0]
    if (!taxYear) {
      return NextResponse.json({ taxYear: null, entries: [] })
    }

    const { where } = buildJournalListWhere(taxYear.id, {
      subsection,
      quarter,
      accountName,
    })

    const journalEntries = await prisma.journalEntry.findMany({
      where,
      orderBy: [
        { subsection: 'asc' },
        { entryNumber: 'asc' },
        { createdAt: 'asc' },
      ],
      include: { lines: { orderBy: { lineOrder: 'asc' } } },
    })

    const entries = journalEntries.map((entry) => ({
      id: entry.id,
      entryNumber: entry.entryNumber,
      subsection: entry.subsection,
      triggerEvent: entry.triggerEvent,
      triggerEntityId: entry.triggerEntityId,
      quarter: entry.quarter,
      entryDate: entry.entryDate.toISOString(),
      regulationRef: entry.regulationRef,
      workflowMenu: entry.workflowMenu,
      isMemo: entry.isMemo,
      lines: entry.lines.map((line) => ({
        lineOrder: line.lineOrder,
        accountCode: line.accountCode,
        accountName: line.accountName,
        debit: line.debit ? new Decimal(line.debit.toString()).toFixed(2) : '0.00',
        credit: line.credit ? new Decimal(line.credit.toString()).toFixed(2) : '0.00',
      })),
    }))

    return NextResponse.json({
      taxYear: taxYear.year,
      entries,
      filters: { subsection, quarter, accountName },
    })
  } catch (err) {
    console.error('List journal entries error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
