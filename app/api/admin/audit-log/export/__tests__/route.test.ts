import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { GET } from '../route'
import { prisma } from '@/lib/testing/db'
import { createUser } from '@/lib/testing/factories'
import { signToken } from '@/lib/auth/session'

vi.mock('@/lib/auth/session', async (importOriginal) => {
  const actual = (await importOriginal()) as { signToken: typeof signToken }
  return {
    ...actual,
    requireAuth: vi.fn(),
  }
})

import { requireAuth } from '@/lib/auth/session'

beforeEach(async () => {
  await prisma.$transaction([
    prisma.journalLine.deleteMany(),
    prisma.journalEntry.deleteMany(),
    prisma.stellarReceipt.deleteMany(),
    prisma.returnPenalty.deleteMany(),
    prisma.taxReturn.deleteMany(),
    prisma.form2307.deleteMany(),
    prisma.priorYearCredit.deleteMany(),
    prisma.overpayment.deleteMany(),
    prisma.taxYear.deleteMany(),
    prisma.taxpayerATC.deleteMany(),
    prisma.taxpayerProfile.deleteMany(),
    prisma.auditLog.deleteMany(),
    prisma.user.deleteMany(),
    prisma.aTCCode.deleteMany(),
    prisma.rDOPenaltySchedule.deleteMany(),
    prisma.publicHoliday.deleteMany(),
  ])
  vi.resetAllMocks()
})

async function mockAdminAuth() {
  const admin = await createUser({ username: `admin-${Date.now()}`, role: 'ADMIN' })
  vi.mocked(requireAuth).mockResolvedValue({
    sub: admin.id,
    username: 'admin',
    role: 'ADMIN',
    iat: 1,
    exp: 9999999999,
  })
  return admin.id
}

function getRequest(query = '') {
  const url = query ? `http://localhost/api/admin/audit-log/export?${query}` : 'http://localhost/api/admin/audit-log/export'
  return new NextRequest(url, { method: 'GET' })
}

async function seedAuditEntries() {
  const admin = await createUser({ username: 'admin-export', role: 'ADMIN' })
  const taxpayer = await createUser({ username: 'maria-export', role: 'TAXPAYER' })
  await prisma.auditLog.create({
    data: {
      userId: admin.id,
      action: 'ATC_CREATED',
      entityType: 'ATCCode',
      entityId: 'WI100',
      metadata: { description: 'Professional' },
    },
  })
  await prisma.auditLog.create({
    data: {
      userId: taxpayer.id,
      action: 'ELECTION_CONFIRMED',
      entityType: 'TaxYear',
      entityId: 'ty-1',
      metadata: { electedRate: 'RATE_8PCT' },
    },
  })
  await prisma.auditLog.create({
    data: {
      userId: admin.id,
      action: 'HOLIDAY_CREATED',
      entityType: 'PublicHoliday',
      entityId: 'ph-1',
      metadata: { date: '2026-01-01', name: 'New Year' },
    },
  })
  return { admin, taxpayer }
}

describe('GET /api/admin/audit-log/export', () => {
  it('returns 401 when not authenticated', async () => {
    vi.mocked(requireAuth).mockResolvedValue(null)
    const res = await GET(getRequest())
    expect(res.status).toBe(401)
  })

  it('returns 403 for non-admin users', async () => {
    const user = await createUser()
    vi.mocked(requireAuth).mockResolvedValue({
      sub: user.id,
      username: 'taxpayer',
      role: 'TAXPAYER',
      iat: 1,
      exp: 9999999999,
    })
    const res = await GET(getRequest())
    expect(res.status).toBe(403)
  })

  it('returns CSV with the configured header and rows', async () => {
    await mockAdminAuth()
    await seedAuditEntries()

    const res = await GET(getRequest())
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toContain('text/csv')
    expect(res.headers.get('Content-Disposition')).toMatch(/^attachment; filename=/)
    expect(res.headers.get('X-Audit-Export-Count')).toBe('3')

    const text = await res.text()
    const lines = text.trim().split('\r\n')
    expect(lines[0]).toBe('id,createdAt,username,role,action,entityType,entityId,metadata')
    expect(lines).toHaveLength(4)
    // Verify quoting works for metadata JSON
    expect(text).toMatch(/"\{.*electedRate.*\}"/)
  })

  it('escapes commas and quotes in the action and metadata columns', async () => {
    await mockAdminAuth()
    const admin = await createUser({ username: 'admin', role: 'ADMIN' })
    await prisma.auditLog.create({
      data: {
        userId: admin.id,
        action: 'CUSTOM, WITH "QUOTES"',
        entityType: 'Thing',
        entityId: 'a,b',
        metadata: { note: 'has "quotes" and , commas' },
      },
    })

    const res = await GET(getRequest())
    const text = await res.text()
    // The action field must be wrapped in quotes
    expect(text).toMatch(/"CUSTOM, WITH ""QUOTES"""/)
    // entityId is also quoted
    expect(text).toMatch(/"a,b"/)
  })

  it('filters by actor (username)', async () => {
    await mockAdminAuth()
    await seedAuditEntries()

    const res = await GET(getRequest('username=admin-export'))
    expect(res.status).toBe(200)
    expect(res.headers.get('X-Audit-Export-Count')).toBe('2')

    const text = await res.text()
    const lines = text.trim().split('\r\n')
    expect(lines).toHaveLength(3) // header + 2 rows
  })

  it('filters by action substring', async () => {
    await mockAdminAuth()
    await seedAuditEntries()

    const res = await GET(getRequest('action=HOLIDAY'))
    expect(res.status).toBe(200)
    expect(res.headers.get('X-Audit-Export-Count')).toBe('1')
    const text = await res.text()
    expect(text).toContain('HOLIDAY_CREATED')
    expect(text).not.toContain('ATC_CREATED')
  })

  it('filters by date range (from)', async () => {
    await mockAdminAuth()
    const admin = await createUser({ username: 'admin-range', role: 'ADMIN' })
    const oldEntry = await prisma.auditLog.create({
      data: {
        userId: admin.id,
        action: 'OLD_ACTION',
        entityType: 'Test',
        entityId: 'old',
      },
    })
    // Force a specific createdAt for the old entry.
    await prisma.auditLog.update({
      where: { id: oldEntry.id },
      data: { createdAt: new Date('2024-01-01T00:00:00.000Z') },
    })
    await prisma.auditLog.create({
      data: {
        userId: admin.id,
        action: 'NEW_ACTION',
        entityType: 'Test',
        entityId: 'new',
      },
    })

    const res = await GET(getRequest('from=2025-01-01T00:00:00.000Z'))
    expect(res.status).toBe(200)
    const text = await res.text()
    expect(text).toContain('NEW_ACTION')
    expect(text).not.toContain('OLD_ACTION')
  })

  it('rejects invalid filter parameters with a 400', async () => {
    await mockAdminAuth()
    const res = await GET(getRequest('from=not-a-date'))
    expect(res.status).toBe(400)
  })
})
