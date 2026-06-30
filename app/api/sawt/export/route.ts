import { NextRequest, NextResponse } from 'next/server'
import Decimal from 'decimal.js'
import { requireAuth } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'
import {
  isPayorCorporation,
  monthName,
  renderSawtDocument,
  type SawtFormat,
  type SawtLineItem,
} from '@/lib/sawt/format'
import { resolveTaxYearFromRequest, setActiveYearCookie } from '@/lib/active-year'

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

function parseMonth(value: string | null): number {
  if (!value) return new Date().getUTCMonth() + 1
  const parsed = Number.parseInt(value, 10)
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 12) {
    return new Date().getUTCMonth() + 1
  }
  return parsed
}

function parseYear(value: string | null): number {
  if (!value) return new Date().getUTCFullYear()
  const parsed = Number.parseInt(value, 10)
  if (!Number.isInteger(parsed) || parsed < 2000 || parsed > 2100) {
    return new Date().getUTCFullYear()
  }
  return parsed
}

function parseFormat(value: string | null): SawtFormat {
  return value === 'dat' ? 'dat' : 'csv'
}

function formatContentType(format: SawtFormat): string {
  return format === 'dat' ? 'application/octet-stream' : 'text/csv'
}

function formatExtension(format: SawtFormat): string {
  return format
}

export async function GET(req: NextRequest) {
  const session = await requireAuth(req)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const format = parseFormat(req.nextUrl.searchParams.get('format'))
    const requestedMonth = parseMonth(req.nextUrl.searchParams.get('month'))
    const requestedYear = parseYear(req.nextUrl.searchParams.get('year'))

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

    const taxYear = await resolveTaxYearFromRequest(req, profile.taxYears)
    if (!taxYear) {
      return NextResponse.json({ error: 'No active tax year' }, { status: 400 })
    }
    await setActiveYearCookie(taxYear.year)
    const certificates = taxYear.certificates

    const aggregated = new Map<
      string,
      {
        quarter: number
        payorTin: string
        payorName: string
        atcCode: string
        natureOfPayment: string
        taxRatePercent: string
        gross: Decimal
        cwt: Decimal
      }
    >()

    for (const cert of certificates) {
      const key = `${cert.quarter}|${cert.payorTin}|${cert.payorName}|${cert.atcCode}`
      const existing = aggregated.get(key)
      const rate = new Decimal(String(cert.atc.ewtRate))
      const ratePercent = rate.times(100).toFixed(2)
      if (existing) {
        existing.gross = existing.gross.plus(cert.quarterlyTotal)
        existing.cwt = existing.cwt.plus(cert.cwtWithheld)
      } else {
        aggregated.set(key, {
          quarter: cert.quarter,
          payorTin: cert.payorTin,
          payorName: cert.payorName,
          atcCode: cert.atcCode,
          natureOfPayment: cert.atc.description,
          taxRatePercent: ratePercent,
          gross: new Decimal(String(cert.quarterlyTotal)),
          cwt: new Decimal(String(cert.cwtWithheld)),
        })
      }
    }

    const orderedRows = Array.from(aggregated.values()).sort(
      (a, b) => a.quarter - b.quarter || a.payorName.localeCompare(b.payorName)
    )

    let runningTotal = new Decimal('0')
    const lines: SawtLineItem[] = orderedRows.map((row, index) => {
      const gross = row.gross
      const cwt = row.cwt
      runningTotal = runningTotal.plus(cwt)
      return {
        seqNo: index + 1,
        tin: row.payorTin,
        payorName: row.payorName,
        isCorporation: isPayorCorporation(row.payorName),
        atcCode: row.atcCode,
        natureOfPayment: row.natureOfPayment,
        taxRatePercent: row.taxRatePercent,
        paymentAmount: gross,
        taxWithheld: cwt,
      }
    })

    const monthLabel = MONTHS[requestedMonth - 1] ?? monthName(requestedMonth)

    const document = {
      header: {
        tradeName: profile.natureOfBusiness || profile.fullName,
        taxpayerName: profile.fullName,
        tin: profile.tin,
        address: `${profile.registeredAddress}, ${profile.zipCode}`,
        periodMonth: monthLabel,
        periodYear: requestedYear,
      },
      lines,
      totalTaxWithheld: runningTotal,
    }

    const body = renderSawtDocument(document, format)

    return new NextResponse(body, {
      headers: {
        'Content-Type': formatContentType(format),
        'Content-Disposition': `attachment; filename="SAWT-${taxYear.year}.${formatExtension(format)}"`,
      },
    })
  } catch (err) {
    console.error('SAWT export error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
