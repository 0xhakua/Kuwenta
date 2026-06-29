import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'
import { verifyReceiptOnChain } from '@/lib/stellar/verify'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ txId: string }> }
) {
  const session = await requireAuth()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { txId } = await params
    if (!txId) {
      return NextResponse.json({ error: 'Missing txId' }, { status: 400 })
    }

    const receipt = await prisma.stellarReceipt.findUnique({
      where: { stellarTxId: txId },
      include: {
        taxReturn: {
          include: {
            taxYear: {
              include: { taxpayer: true },
            },
          },
        },
      },
    })

    if (!receipt) {
      return NextResponse.json({ error: 'Receipt not found' }, { status: 404 })
    }

    if (receipt.taxReturn.taxYear.taxpayer.userId !== session.sub) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const verification = await verifyReceiptOnChain(
      txId,
      receipt.returnId,
      receipt.payloadHash
    )

    return NextResponse.json({
      id: receipt.id,
      returnId: receipt.returnId,
      taxYear: receipt.taxReturn.taxYear.year,
      formType: receipt.taxReturn.formType,
      quarter: receipt.taxReturn.quarter,
      sequenceOrder: receipt.taxReturn.sequenceOrder,
      stellarTxId: receipt.stellarTxId,
      payloadHash: receipt.payloadHash,
      network: receipt.network,
      explorerUrl: receipt.explorerUrl,
      status: receipt.status,
      anchoredAt: receipt.anchoredAt.toISOString(),
      verification,
    })
  } catch (err) {
    console.error('Get stellar receipt error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
