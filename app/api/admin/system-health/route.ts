import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'
import { checkStellarHealth } from '@/lib/stellar/client'
import { checkStorageStats } from '@/lib/storage'

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
    checkStorageStats(),
  ])

  let database: {
    ok: boolean
    message: string
    migrations: { applied: number; pending: number; status: 'ok' | 'pending' | 'unknown' } | null
  }
  try {
    // Cheap ping; we don't need the data, just a round-trip.
    await prisma.$queryRaw`SELECT 1`

    // The Prisma client does not expose applied migrations in a stable way
    // across versions, so we read the _prisma_migrations table directly.
    // If the table does not exist (e.g. on an older migration setup), we
    // report "unknown" instead of failing the whole health check.
    let migrations: { applied: number; pending: number; status: 'ok' | 'pending' | 'unknown' } = {
      applied: 0,
      pending: 0,
      status: 'unknown',
    }
    try {
      const rows = await prisma.$queryRawUnsafe<Array<{ migration_name: string; finished_at: Date | null }>>(
        'SELECT migration_name, finished_at FROM "_prisma_migrations" ORDER BY started_at DESC'
      )
      const applied = rows.filter((r) => r.finished_at !== null).length
      const total = rows.length
      migrations = {
        applied,
        pending: Math.max(total - applied, 0),
        status: 'ok',
      }
    } catch {
      // Table may not exist; leave migrations.status = 'unknown'
    }

    database = {
      ok: true,
      message: 'PostgreSQL is reachable',
      migrations,
    }
  } catch (err) {
    database = {
      ok: false,
      message: err instanceof Error ? err.message : 'Database unreachable',
      migrations: null,
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
      latencyMs: stellar.latencyMs,
      message: stellar.message,
    },
    storage: {
      ok: storage.ok,
      type: storage.type,
      path: storage.path,
      writable: storage.writable,
      freeBytes: storage.freeBytes,
      totalBytes: storage.totalBytes,
      message: storage.message,
    },
    database,
    checkedAt: new Date().toISOString(),
  })
}
