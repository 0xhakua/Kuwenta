import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkStorageHealth } from '@/lib/storage'
import { checkStellarHealth } from '@/lib/stellar/client'

export const dynamic = 'force-dynamic'

interface CheckResult {
  ok: boolean
  message: string
}

async function checkDatabase(): Promise<CheckResult> {
  try {
    await prisma.$queryRaw`SELECT 1`
    return { ok: true, message: 'PostgreSQL is reachable' }
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : 'Database unreachable',
    }
  }
}

/**
 * Public health-check endpoint. No auth — meant to be polled by Railway /
 * uptime monitors and by humans when something looks wrong.
 *
 * Returns 200 with a structured body listing each subsystem. Even when
 * something is down we return 200 (with `ok: false`) so the endpoint itself
 * is always reachable for inspection; Railway's own liveness probe can still
 * use the `ok` field to decide.
 */
export async function GET() {
  const [database, storage, stellar] = await Promise.all([
    checkDatabase(),
    checkStorageHealth(),
    checkStellarHealth(),
  ])

  return NextResponse.json(
    {
      ok: database.ok && storage.ok && stellar.ok,
      database,
      storage: {
        ok: storage.ok,
        type: storage.type,
        path: storage.path,
        writable: storage.writable,
        message: storage.message,
      },
      stellar: {
        ok: stellar.ok,
        network: stellar.network,
        horizonUrl: stellar.horizonUrl,
        reachable: stellar.reachable,
        configured: stellar.configured,
        message: stellar.message,
      },
      checkedAt: new Date().toISOString(),
    },
    { status: 200 }
  )
}
