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
            certificates: {
              include: { atc: true },
              orderBy: [{ quarter: 'asc' }, { payorName: 'asc' }],
            },
          },
        },
      },
    })

    if (!profile?.taxYears[0]) {
      return NextResponse.json({ sawt: [] })
    }

    const certificates = profile.taxYears[0].certificates

    // BIR eSubmission alphalist aggregation: same payor + same ATC + same quarter → one line
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

    const sawt = Array.from(aggregated.values()).map((row) => ({
      quarter: row.quarter,
      payorTin: row.payorTin,
      payorName: row.payorName,
      atcCode: row.atcCode,
      gross: row.gross.toFixed(2),
      cwt: row.cwt.toFixed(2),
    }))

    return NextResponse.json({ sawt })
  } catch (err) {
    console.error('SAWT data error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
