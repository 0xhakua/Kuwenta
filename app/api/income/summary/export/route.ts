import { NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import Decimal from 'decimal.js'
import { requireAuth } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'
import { resolveTaxYearFromRequest, setActiveYearCookie } from '@/lib/active-year'
import { IncomeSummaryPdf, type IncomeSummaryRow } from '@/lib/pdf/templates/income-summary'

export async function GET(request: Request) {
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
          include: {
            certificates: {
              include: { atc: true },
              orderBy: [{ quarter: 'asc' }, { payorName: 'asc' }],
            },
          },
        },
      },
    })

    if (!profile || profile.taxYears.length === 0) {
      return NextResponse.json({ error: 'No active tax year' }, { status: 400 })
    }

    const taxYear = await resolveTaxYearFromRequest(request, profile.taxYears)
    if (!taxYear) {
      return NextResponse.json({ error: 'No active tax year' }, { status: 400 })
    }
    await setActiveYearCookie(taxYear.year)

    const aggregated = new Map<
      string,
      {
        quarter: number
        payorName: string
        payorTin: string
        atcCode: string
        gross: Decimal
        cwt: Decimal
      }
    >()

    for (const cert of taxYear.certificates) {
      const key = `${cert.quarter}|${cert.payorTin}|${cert.payorName}|${cert.atcCode}`
      const existing = aggregated.get(key)
      if (existing) {
        existing.gross = existing.gross.plus(cert.quarterlyTotal)
        existing.cwt = existing.cwt.plus(cert.cwtWithheld)
      } else {
        aggregated.set(key, {
          quarter: cert.quarter,
          payorName: cert.payorName,
          payorTin: cert.payorTin,
          atcCode: cert.atcCode,
          gross: new Decimal(String(cert.quarterlyTotal)),
          cwt: new Decimal(String(cert.cwtWithheld)),
        })
      }
    }

    const rows: IncomeSummaryRow[] = Array.from(aggregated.values()).map((row) => ({
      quarter: row.quarter,
      payorName: row.payorName,
      payorTin: row.payorTin,
      atcCode: row.atcCode,
      gross: row.gross.toFixed(2),
      cwt: row.cwt.toFixed(2),
    }))

    const totalGross = taxYear.certificates.reduce(
      (sum, c) => sum.plus(c.quarterlyTotal),
      new Decimal('0')
    )
    const totalCwt = taxYear.certificates.reduce(
      (sum, c) => sum.plus(c.cwtWithheld),
      new Decimal('0')
    )

    const buffer = await renderToBuffer(
      IncomeSummaryPdf({
        taxpayer: {
          fullName: profile.fullName,
          tin: profile.tin,
          rdoCode: profile.rdoCode,
        },
        taxYear: taxYear.year,
        rows,
        totalGross: totalGross.toFixed(2),
        totalCwt: totalCwt.toFixed(2),
      })
    )

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="income-summary-${taxYear.year}.pdf"`,
      },
    })
  } catch (err) {
    console.error('Income summary PDF error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
