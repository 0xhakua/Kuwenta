import { NextResponse } from 'next/server'
import Decimal from 'decimal.js'
import { requireAuth } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'
import { exportJournalToBuffer } from '@/lib/journal/xlsx-export'
import type { JournalEntryExportRow } from '@/lib/journal/xlsx-export'

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
              orderBy: [{ subsection: 'asc' }, { entryNumber: 'asc' }, { createdAt: 'asc' }],
              include: { lines: { orderBy: { lineOrder: 'asc' } } },
            },
          },
        },
      },
    })

    const taxYear = profile?.taxYears[0]
    if (!taxYear) {
      return NextResponse.json({ error: 'No active tax year' }, { status: 404 })
    }

    const rows: JournalEntryExportRow[] = taxYear.journalEntries.flatMap((entry) =>
      entry.lines.map((line) => ({
        entryNumber: entry.entryNumber,
        subsection: entry.subsection,
        triggerEvent: entry.triggerEvent,
        entryDate: entry.entryDate,
        accountCode: line.accountCode,
        accountName: line.accountName,
        debit: line.debit ? new Decimal(line.debit.toString()) : new Decimal('0'),
        credit: line.credit ? new Decimal(line.credit.toString()) : new Decimal('0'),
        regulationRef: entry.regulationRef,
        workflowMenu: entry.workflowMenu,
        isMemo: entry.isMemo,
      }))
    )

    const buffer = exportJournalToBuffer(rows)

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="kuwenta-journal-${taxYear.year}.xlsx"`,
      },
    })
  } catch (err) {
    console.error('Export journal error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
