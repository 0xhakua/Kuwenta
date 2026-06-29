import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { requireAuth } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'

const MAX_LIMIT = 1000
const DEFAULT_LIMIT = 500
const ALLOWED_LIMITS = [100, 250, 500, 1000]

function parseDate(value: string | null): Date | null | { error: string } {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return { error: `Invalid date: ${value}` }
  }
  return date
}

function parseLimit(value: string | null): number | { error: string } {
  if (!value) return DEFAULT_LIMIT
  const n = Number(value)
  if (!Number.isInteger(n) || n <= 0 || n > MAX_LIMIT) {
    return { error: `Invalid limit: ${value}` }
  }
  return ALLOWED_LIMITS.includes(n) ? n : Math.min(n, MAX_LIMIT)
}

export async function GET(req: Request) {
  const session = await requireAuth()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const url = new URL(req.url)
    const userId = url.searchParams.get('userId')?.trim() || null
    const username = url.searchParams.get('username')?.trim() || null
    const action = url.searchParams.get('action')?.trim() || null
    const entityType = url.searchParams.get('entityType')?.trim() || null
    const entityId = url.searchParams.get('entityId')?.trim() || null
    const from = parseDate(url.searchParams.get('from'))
    const to = parseDate(url.searchParams.get('to'))
    const limit = parseLimit(url.searchParams.get('limit'))

    if ('error' in from) {
      return NextResponse.json({ error: from.error }, { status: 400 })
    }
    if ('error' in to) {
      return NextResponse.json({ error: to.error }, { status: 400 })
    }
    if ('error' in limit) {
      return NextResponse.json({ error: limit.error }, { status: 400 })
    }

    const where: Prisma.AuditLogWhereInput = {}

    if (userId) {
      where.userId = userId
    } else if (username) {
      where.user = { username: { equals: username } }
    }

    if (action) {
      where.action = { contains: action, mode: 'insensitive' }
    }

    if (entityType) {
      where.entityType = { equals: entityType }
    }

    if (entityId) {
      where.entityId = { equals: entityId }
    }

    if (from || to) {
      where.createdAt = {}
      if (from) where.createdAt.gte = from
      if (to) where.createdAt.lte = to
    }

    const [logs, users, actions, entityTypes] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
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
        userId,
        username,
        action,
        entityType,
        entityId,
        from: from ? from.toISOString() : null,
        to: to ? to.toISOString() : null,
        limit,
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
