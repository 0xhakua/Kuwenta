import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'

const createSchema = z.object({
  date: z.string().date(),
  name: z.string().min(1).max(255),
})

const deleteSchema = z.object({
  id: z.string().min(1),
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
    const holidays = await prisma.publicHoliday.findMany({
      orderBy: { date: 'asc' },
    })
    return NextResponse.json({ holidays })
  } catch (err) {
    console.error('Admin list holidays error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const session = await requireAuth()
  const denied = requireAdmin(session)
  if (denied) return denied

  try {
    const body = await req.json()
    const result = createSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json({ error: result.error.format() }, { status: 400 })
    }

    const { date, name } = result.data
    const parsedDate = new Date(date)
    const year = parsedDate.getFullYear()

    const holiday = await prisma.publicHoliday.create({
      data: {
        date: parsedDate,
        name,
        year,
      },
    })

    await prisma.auditLog.create({
      data: {
        userId: session!.sub,
        action: 'HOLIDAY_CREATED',
        entityType: 'PublicHoliday',
        entityId: holiday.id,
        metadata: { date: holiday.date.toISOString(), name: holiday.name, year: holiday.year },
      },
    })

    return NextResponse.json({ holiday }, { status: 201 })
  } catch (err) {
    console.error('Admin create holiday error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  const session = await requireAuth()
  const denied = requireAdmin(session)
  if (denied) return denied

  try {
    const body = await req.json()
    const result = deleteSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json({ error: result.error.format() }, { status: 400 })
    }

    const { id } = result.data
    const holiday = await prisma.publicHoliday.delete({ where: { id } })

    await prisma.auditLog.create({
      data: {
        userId: session!.sub,
        action: 'HOLIDAY_DELETED',
        entityType: 'PublicHoliday',
        entityId: holiday.id,
        metadata: { date: holiday.date.toISOString(), name: holiday.name, year: holiday.year },
      },
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Admin delete holiday error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
