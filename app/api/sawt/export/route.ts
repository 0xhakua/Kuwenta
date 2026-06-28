import { NextResponse } from 'next/server'
import Decimal from 'decimal.js'
import { requireAuth } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'

function escapeCsv(value: string | number): string {
  const str = String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
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
            certificates: {
              orderBy: [{ quarter: 'asc' }, { payorName: 'asc' }],
            },
          },
        },
      },
    })

    if (!profile?.taxYears[0]) {
      return NextResponse.json({ error: 'No active tax year' }, { status: 400 })
    }

    const taxYear = profile.taxYears[0]
    const certificates = taxYear.certificates

    const aggregated = new Map<
      string,
      { quarter: number; payorTin: string; payorName: string; atcCode: string; gross: Decimal; cwt: Decimal }
    >()

    for (const cert of certificates) {
      const key = `${cert.quarter}|${cert.payorTin}|${cert.payorName}|${cert.atcCode}`
      const existing = aggregated.get(key)
      if (existing) {
        existing.gross = existing.gross.plus(cert.quarterlyTotal)
        existing.cwt = existing.cwt.plus(cert.cwtWithheld)
      } else {
        aggregated.set(key, {
          quarter: cert.quarter,
          payorTin: cert.payorTin,
          payorName: cert.payorName,
          atcCode: cert.atcCode,
          gross: new Decimal(String(cert.quarterlyTotal)),
          cwt: new Decimal(String(cert.cwtWithheld)),
        })
      }
    }

    const rows = Array.from(aggregated.values())

    const header = ['Quarter', 'PayorTIN', 'PayorName', 'ATC', 'GrossIncome', 'CWTWithheld']
    const csv = [header.join(',')]
      .concat(
        rows.map((row) =>
          [
            row.quarter,
            escapeCsv(row.payorTin),
            escapeCsv(row.payorName),
            row.atcCode,
            row.gross.toFixed(2),
            row.cwt.toFixed(2),
          ].join(',')
        )
      )
      .join('\n')

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="SAWT-${taxYear.year}.csv"`,
      },
    })
  } catch (err) {
    console.error('SAWT export error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
