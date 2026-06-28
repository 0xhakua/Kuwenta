import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await requireAuth()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const logs = await prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 500,
      include: {
        user: {
          select: {
            username: true,
          },
        },
      },
    })

    return NextResponse.json({
      logs: logs.map((log) => ({
        ...log,
        username: log.user.username,
      })),
    })
  } catch (err) {
    console.error('Admin audit log error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
