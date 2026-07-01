import { Prisma } from '@prisma/client'
import { hasFilterError } from '../journal/query'

const MAX_LIMIT = 10000
const DEFAULT_LIMIT = 500
const ALLOWED_LIMITS = [100, 250, 500, 1000, 5000, 10000]

export interface AuditLogFilters {
  userId: string | null
  username: string | null
  action: string | null
  entityType: string | null
  entityId: string | null
  from: Date | null
  to: Date | null
  limit: number
}

export type ParsedFilter<T> = T | { error: string }

function parseDate(value: string | null): ParsedFilter<Date | null> {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return { error: `Invalid date: ${value}` }
  }
  return date
}

function parseLimit(value: string | null): ParsedFilter<number> {
  if (!value) return DEFAULT_LIMIT
  const n = Number(value)
  if (!Number.isInteger(n) || n <= 0 || n > MAX_LIMIT) {
    return { error: `Invalid limit: ${value}` }
  }
  return ALLOWED_LIMITS.includes(n) ? n : Math.min(n, MAX_LIMIT)
}

/**
 * Read the audit-log query parameters off a URL and return either a typed
 * filter object or a {error} value. Shared by the JSON GET handler and the
 * CSV export endpoint so the two views always agree on the filter set.
 */
export function parseAuditLogFilters(
  url: URL
): ParsedFilter<AuditLogFilters> {
  const userId = url.searchParams.get('userId')?.trim() || null
  const username = url.searchParams.get('username')?.trim() || null
  const action = url.searchParams.get('action')?.trim() || null
  const entityType = url.searchParams.get('entityType')?.trim() || null
  const entityId = url.searchParams.get('entityId')?.trim() || null
  const from = parseDate(url.searchParams.get('from'))
  const to = parseDate(url.searchParams.get('to'))
  const limit = parseLimit(url.searchParams.get('limit'))

  if (hasFilterError(from)) return { error: from.error }
  if (hasFilterError(to)) return { error: to.error }
  if (hasFilterError(limit)) return { error: limit.error }

  return {
    userId,
    username,
    action,
    entityType,
    entityId,
    from: from as Date | null,
    to: to as Date | null,
    limit: limit as number,
  }
}

/**
 * Build the Prisma `where` clause that corresponds to a parsed set of
 * audit-log filters. Centralised so the JSON GET handler, the CSV export
 * endpoint, and any future consumer apply the exact same composition rules.
 */
export function buildAuditLogWhere(
  filters: AuditLogFilters
): Prisma.AuditLogWhereInput {
  const where: Prisma.AuditLogWhereInput = {}

  if (filters.userId) {
    where.userId = filters.userId
  } else if (filters.username) {
    where.user = { username: { equals: filters.username } }
  }

  if (filters.action) {
    where.action = { contains: filters.action, mode: 'insensitive' }
  }

  if (filters.entityType) {
    where.entityType = { equals: filters.entityType }
  }

  if (filters.entityId) {
    where.entityId = { equals: filters.entityId }
  }

  if (filters.from || filters.to) {
    where.createdAt = {}
    if (filters.from) where.createdAt.gte = filters.from
    if (filters.to) where.createdAt.lte = filters.to
  }

  return where
}
