import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'
import { hasFilterError } from '@/lib/journal/query'
import { buildAuditLogWhere, parseAuditLogFilters } from '@/lib/audit-log/filters'

const MAX_LIMIT = 1000

export async function GET(req: NextRequest) {
  const session = await requireAuth()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const url = new URL(req.url)
    const parsed = parseAuditLogFilters(url)
    if (hasFilterError(parsed)) {
      return NextResponse.json({ error: parsed.error }, { status: 400 })
    }

    // Cap the JSON response to 1000 rows; CSV export takes higher limits.
    const filters = { ...parsed, limit: Math.min(parsed.limit, MAX_LIMIT) }
    const where = buildAuditLogWhere(filters)

    const [logs, users, actions, entityTypes] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: filters.limit,
        include: { user: { select: { username: true } } },
      }),
      prisma.user.findMany({
        select: { id: true, username: true, role: true },
        orderBy: { username: 'asc' },
      }),
      prisma.auditLog.findMany({
        distinct: ['action'],
        select: { action: true },
        orderBy: { action: 'asc' },
      }),
      prisma.auditLog.findMany({
        where: { entityType: { not: null } },
        distinct: ['entityType'],
        select: { entityType: true },
        orderBy: { entityType: 'asc' },
      }),
    ])

    return NextResponse.json({
      logs: logs.map((log) => ({
        ...log,
        username: log.user.username,
      })),
      filters: {
        userId: filters.userId,
        username: filters.username,
        action: filters.action,
        entityType: filters.entityType,
        entityId: filters.entityId,
        from: filters.from ? filters.from.toISOString() : null,
        to: filters.to ? filters.to.toISOString() : null,
        limit: filters.limit,
      },
      options: {
        users,
        actions: actions.map((a) => a.action),
        entityTypes: entityTypes
          .map((e) => e.entityType)
          .filter((v): v is string => Boolean(v)),
      },
    })
  } catch (err) {
    console.error('Admin audit log error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
