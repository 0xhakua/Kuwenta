import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'
import { hasFilterError } from '@/lib/journal/query'
import {
  buildAuditLogWhere,
  parseAuditLogFilters,
  type AuditLogFilters,
} from '@/lib/audit-log/filters'

const MAX_EXPORT = 10000

function escapeCsvField(value: unknown): string {
  if (value === null || value === undefined) return ''
  const s = typeof value === 'string' ? value : value instanceof Date ? value.toISOString() : String(value)
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

function filtersToLabel(filters: AuditLogFilters): string {
  const parts: string[] = []
  if (filters.userId) parts.push(`user-${filters.userId.slice(0, 8)}`)
  if (filters.username) parts.push(`actor-${filters.username}`)
  if (filters.action) parts.push(`action-${filters.action}`)
  if (filters.entityType) parts.push(`entity-${filters.entityType}`)
  if (filters.entityId) parts.push(`entityid-${filters.entityId}`)
  if (filters.from) parts.push(`from-${filters.from.toISOString().slice(0, 10)}`)
  if (filters.to) parts.push(`to-${filters.to.toISOString().slice(0, 10)}`)
  if (!parts.length) return 'all'
  return parts.join('_').replace(/[^A-Za-z0-9_.-]/g, '')
}

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
    const filters: AuditLogFilters = { ...parsed, limit: Math.min(parsed.limit, MAX_EXPORT) }
    const where = buildAuditLogWhere(filters)

    const logs = await prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: filters.limit,
      include: { user: { select: { username: true, role: true } } },
    })

    const header = ['id', 'createdAt', 'username', 'role', 'action', 'entityType', 'entityId', 'metadata']
    const lines: string[] = [header.join(',')]
    for (const log of logs) {
      lines.push(
        [
          escapeCsvField(log.id),
          escapeCsvField(log.createdAt),
          escapeCsvField(log.user.username),
          escapeCsvField(log.user.role),
          escapeCsvField(log.action),
          escapeCsvField(log.entityType),
          escapeCsvField(log.entityId),
          escapeCsvField(log.metadata === null ? '' : JSON.stringify(log.metadata)),
        ].join(',')
      )
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const filename = `kuwenta-audit-log_${filtersToLabel(filters)}_${timestamp}.csv`
    const body = lines.join('\r\n') + '\r\n'

    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'X-Audit-Export-Count': String(logs.length),
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error('Admin audit log export error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
