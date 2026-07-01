import { describe, it, expect } from 'vitest'
import { buildAuditLogWhere, parseAuditLogFilters } from '../filters'

describe('parseAuditLogFilters', () => {
  it('returns a complete filter set with sane defaults', () => {
    const url = new URL('http://localhost/api/admin/audit-log?limit=250')
    const result = parseAuditLogFilters(url)
    expect('userId' in result ? result : null).toEqual({
      userId: null,
      username: null,
      action: null,
      entityType: null,
      entityId: null,
      from: null,
      to: null,
      limit: 250,
    })
  })

  it('rejects malformed dates with an error', () => {
    const url = new URL('http://localhost/api/admin/audit-log?from=not-a-date')
    const result = parseAuditLogFilters(url)
    expect('error' in result && (result as { error: string }).error).toMatch(/Invalid date/)
  })

  it('rejects limits that are out of range', () => {
    const url = new URL('http://localhost/api/admin/audit-log?limit=99999')
    const result = parseAuditLogFilters(url)
    expect('error' in result && (result as { error: string }).error).toMatch(/Invalid limit/)
  })
})

describe('buildAuditLogWhere', () => {
  it('composes every filter as AND', () => {
    const url = new URL(
      'http://localhost/api/admin/audit-log?username=admin&action=HOLIDAY&entityType=PublicHoliday&from=2026-01-01T00:00:00.000Z&to=2026-12-31T23:59:59.000Z'
    )
    const parsed = parseAuditLogFilters(url)
    if ('error' in parsed) throw new Error('setup error')
    const where = buildAuditLogWhere(parsed)
    expect(where.user).toEqual({ username: { equals: 'admin' } })
    expect(where.action).toEqual({ contains: 'HOLIDAY', mode: 'insensitive' })
    expect(where.entityType).toEqual({ equals: 'PublicHoliday' })
    expect(where.createdAt).toEqual({
      gte: new Date('2026-01-01T00:00:00.000Z'),
      lte: new Date('2026-12-31T23:59:59.000Z'),
    })
  })

  it('prefers userId over username when both are set', () => {
    const url = new URL(
      'http://localhost/api/admin/audit-log?userId=abc&username=admin'
    )
    const parsed = parseAuditLogFilters(url)
    if ('error' in parsed) throw new Error('setup error')
    const where = buildAuditLogWhere(parsed)
    expect(where.userId).toBe('abc')
    expect(where.user).toBeUndefined()
  })
})
