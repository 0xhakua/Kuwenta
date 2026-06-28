import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await requireAuth()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const codes = await prisma.aTCCode.findMany({
      where: { isActive: true },
      orderBy: { code: 'asc' },
    })

    return NextResponse.json({ codes })
  } catch (err) {
    console.error('List ATC codes error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
