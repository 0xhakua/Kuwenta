import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'
import { checkStellarHealth } from '@/lib/stellar/client'
import { checkStorageHealth } from '@/lib/storage'

export async function GET() {
  const session = await requireAuth()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const [stellar, storage] = await Promise.all([
    checkStellarHealth(),
    checkStorageHealth(),
  ])

  let database: {
    ok: boolean
    message: string
  }
  try {
    // Cheap ping; we don't need the data, just a round-trip.
    await prisma.$queryRaw`SELECT 1`
    database = { ok: true, message: 'PostgreSQL is reachable' }
  } catch (err) {
    database = {
      ok: false,
      message: err instanceof Error ? err.message : 'Database unreachable',
    }
  }

  return NextResponse.json({
    ok: stellar.ok && storage.ok && database.ok,
    stellar: {
      ok: stellar.ok,
      network: stellar.network,
      horizonUrl: stellar.horizonUrl,
      reachable: stellar.reachable,
      configured: stellar.configured,
      message: stellar.message,
    },
    storage: {
      ok: storage.ok,
      type: storage.type,
      path: storage.path,
      writable: storage.writable,
      message: storage.message,
    },
    database,
    checkedAt: new Date().toISOString(),
  })
}
