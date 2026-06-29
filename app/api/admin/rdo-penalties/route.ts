import { NextResponse } from 'next/server'
import Decimal from 'decimal.js'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'

const upsertSchema = z.object({
  rdoCode: z.string().min(1).max(10),
  compromiseFee: z.string().regex(/^\d+(\.\d{1,2})?$/),
})

const updateSchema = z.object({
  id: z.string().min(1),
  compromiseFee: z.string().regex(/^\d+(\.\d{1,2})?$/),
})

function requireAdmin(session: Awaited<ReturnType<typeof requireAuth>>) {
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  return null
}

export async function GET() {
  const session = await requireAuth()
  const denied = requireAdmin(session)
  if (denied) return denied

  try {
    const schedules = await prisma.rDOPenaltySchedule.findMany({
      orderBy: { rdoCode: 'asc' },
    })
    return NextResponse.json({ schedules })
  } catch (err) {
    console.error('Admin list RDO penalties error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const session = await requireAuth()
  const denied = requireAdmin(session)
  if (denied) return denied

  try {
    const body = await req.json()
    const result = upsertSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json({ error: result.error.format() }, { status: 400 })
    }

    const { rdoCode, compromiseFee } = result.data
    const fee = new Decimal(compromiseFee)

    const existing = await prisma.rDOPenaltySchedule.findUnique({
      where: { rdoCode: rdoCode.toUpperCase() },
    })

    const schedule = await prisma.rDOPenaltySchedule.upsert({
      where: { rdoCode: rdoCode.toUpperCase() },
      create: {
        rdoCode: rdoCode.toUpperCase(),
        compromiseFee: fee,
      },
      update: {
        compromiseFee: fee,
      },
    })

    await prisma.auditLog.create({
      data: {
        userId: session!.sub,
        action: existing ? 'RDO_PENALTY_UPDATED' : 'RDO_PENALTY_CREATED',
        entityType: 'RDOPenaltySchedule',
        entityId: schedule.id,
        metadata: { rdoCode: schedule.rdoCode, compromiseFee: schedule.compromiseFee.toString() },
      },
    })

    return NextResponse.json({ schedule }, { status: existing ? 200 : 201 })
  } catch (err) {
    console.error('Admin upsert RDO penalty error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  const session = await requireAuth()
  const denied = requireAdmin(session)
  if (denied) return denied

  try {
    const body = await req.json()
    const result = updateSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json({ error: result.error.format() }, { status: 400 })
    }

    const { id, compromiseFee } = result.data
    const schedule = await prisma.rDOPenaltySchedule.update({
      where: { id },
      data: { compromiseFee: new Decimal(compromiseFee) },
    })

    await prisma.auditLog.create({
      data: {
        userId: session!.sub,
        action: 'RDO_PENALTY_UPDATED',
        entityType: 'RDOPenaltySchedule',
        entityId: schedule.id,
        metadata: { rdoCode: schedule.rdoCode, compromiseFee: schedule.compromiseFee.toString() },
      },
    })

    return NextResponse.json({ schedule })
  } catch (err) {
    console.error('Admin update RDO penalty error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
