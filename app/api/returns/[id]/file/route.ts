import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'
import { determineReturnStatus } from '@/lib/computation/sequence'
import { recascadeTaxYear } from '@/lib/computation/recascade'
import { renderFilingPdf } from '@/lib/pdf/dispatcher'
import { anchorFilingReceipt, storeFilingPackage } from '@/lib/stellar/anchor'

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { id } = await params

    const profile = await prisma.taxpayerProfile.findUnique({
      where: { userId: session.sub },
      include: {
        taxYears: {
          orderBy: { year: 'desc' },
          take: 1,
          include: {
            returns: {
              orderBy: { sequenceOrder: 'asc' },
            },
            overpayment: true,
          },
        },
      },
    })

    if (!profile?.taxYears[0]) {
      return NextResponse.json({ error: 'No active tax year' }, { status: 400 })
    }

    const taxYear = profile.taxYears[0]
    const ret = taxYear.returns.find((r) => r.id === id)
    if (!ret) {
      return NextResponse.json({ error: 'Return not found' }, { status: 404 })
    }

    const status = determineReturnStatus(
      ret.sequenceOrder,
      taxYear.returns,
      profile.corIncludes2551Q
    )

    if (status === 'BLOCKED') {
      return NextResponse.json(
        { error: 'Predecessor returns must be filed first' },
        { status: 409 }
      )
    }

    if (ret.status === 'FILED') {
      return NextResponse.json({ error: 'Return already filed' }, { status: 409 })
    }

    // 1701A with overpayment requires disposition selection before filing
    if (ret.formType === 'FORM_1701A' && ret.overpaymentAmt) {
      if (!taxYear.overpayment?.disposition) {
        return NextResponse.json(
          { error: 'Overpayment disposition is required before filing 1701A' },
          { status: 409 }
        )
      }
    }

    // Recascade with current date so penalties reflect filing today
    await recascadeTaxYear({ taxYearId: taxYear.id })

    const refreshed = await prisma.taxReturn.findUnique({ where: { id: ret.id } })
    if (!refreshed) {
      return NextResponse.json({ error: 'Return not found' }, { status: 404 })
    }

    const pdfBuffer = await renderFilingPdf(refreshed.id, session.sub)
    if (!pdfBuffer) {
      return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 })
    }

    const pdfPath = await storeFilingPackage(taxYear.id, refreshed.id, pdfBuffer)
    const filedDate = new Date()

    const anchor = await anchorFilingReceipt(refreshed.id, pdfBuffer)

    const updatedReturn = await prisma.$transaction(async (tx) => {
      const updated = await tx.taxReturn.update({
        where: { id: refreshed.id },
        data: {
          status: 'FILED',
          filedDate,
          pdfPath,
        },
      })

      await tx.stellarReceipt.create({
        data: {
          returnId: refreshed.id,
          stellarTxId: anchor.stellarTxId,
          payloadHash: anchor.payloadHash,
          network: process.env.STELLAR_NETWORK === 'mainnet' ? 'mainnet' : 'testnet',
          explorerUrl: anchor.explorerUrl,
          status: anchor.status,
        },
      })

      await tx.auditLog.create({
        data: {
          userId: session.sub,
          action: 'RETURN_FILED',
          entityType: 'TaxReturn',
          entityId: refreshed.id,
          metadata: {
            formType: refreshed.formType,
            quarter: refreshed.quarter,
            taxYear: taxYear.year,
            stellarTxId: anchor.stellarTxId,
            stellarStatus: anchor.status,
          },
        },
      })

      return updated
    })

    return NextResponse.json({
      success: true,
      return: updatedReturn,
      stellar: {
        txId: anchor.stellarTxId,
        status: anchor.status,
        explorerUrl: anchor.explorerUrl,
      },
    })
  } catch (err) {
    console.error('File return error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
