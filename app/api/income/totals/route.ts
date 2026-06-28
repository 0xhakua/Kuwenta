import { NextResponse } from 'next/server'
import Decimal from 'decimal.js'
import { requireAuth } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'
import { VAT_THRESHOLD } from '@/lib/computation/constants'

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
            certificates: true,
          },
        },
      },
    })

    if (!profile?.taxYears[0]) {
      return NextResponse.json({
        totalGross: '0.00',
        totalCwt: '0.00',
        vatThreshold: VAT_THRESHOLD.toString(),
        vatThresholdPercent: 0,
      })
    }

    const certificates = profile.taxYears[0].certificates
    const totalGross = certificates.reduce(
      (sum, cert) => sum.plus(cert.quarterlyTotal),
      new Decimal('0')
    )
    const totalCwt = certificates.reduce(
      (sum, cert) => sum.plus(cert.cwtWithheld),
      new Decimal('0')
    )

    const vatThresholdPercent = Math.min(
      totalGross.dividedBy(VAT_THRESHOLD).times(100).toNumber(),
      100
    )

    return NextResponse.json({
      totalGross: totalGross.toFixed(2),
      totalCwt: totalCwt.toFixed(2),
      vatThreshold: VAT_THRESHOLD.toString(),
      vatThresholdPercent,
    })
  } catch (err) {
    console.error('Income totals error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
