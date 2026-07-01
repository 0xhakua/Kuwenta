import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { GET, POST, DELETE, PUT } from '../route'
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

function mockTaxpayerAuth(userId: string) {
  vi.mocked(requireAuth).mockResolvedValue({
    sub: userId,
    username: 'taxpayer',
    role: 'TAXPAYER',
    iat: 1,
    exp: 9999999999,
  })
}

function getRequest(query = '') {
  const url = query ? `http://localhost/api/admin/holidays?${query}` : 'http://localhost/api/admin/holidays'
  return new NextRequest(url, { method: 'GET' })
}

describe('GET /api/admin/holidays', () => {
  it('returns 401 when not authenticated', async () => {
    vi.mocked(requireAuth).mockResolvedValue(null)
    const res = await GET(getRequest())
    expect(res.status).toBe(401)
  })

  it('returns 403 for non-admin users', async () => {
    const user = await createUser()
    mockTaxpayerAuth(user.id)
    const res = await GET(getRequest())
    expect(res.status).toBe(403)
  })

  it('lists holidays and the available years', async () => {
    await mockAdminAuth()
    await prisma.publicHoliday.create({
      data: { date: new Date('2026-01-01'), name: 'New Year', year: 2026 },
    })
    await prisma.publicHoliday.create({
      data: { date: new Date('2025-12-25'), name: 'Christmas', year: 2025 },
    })

    const res = await GET(getRequest())
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.holidays).toHaveLength(2)
    expect(json.years).toEqual([2025, 2026])
  })

  it('filters by year', async () => {
    await mockAdminAuth()
    await prisma.publicHoliday.create({
      data: { date: new Date('2026-01-01'), name: 'New Year', year: 2026 },
    })
    await prisma.publicHoliday.create({
      data: { date: new Date('2025-12-25'), name: 'Christmas', year: 2025 },
    })

    const res = await GET(getRequest('year=2026'))
    const json = await res.json()

    expect(json.holidays).toHaveLength(1)
    expect(json.holidays[0].name).toBe('New Year')
  })

  it('rolls 1701A due date forward when a known PH holiday is declared', async () => {
    await mockAdminAuth()
    // 1701A for tax year 2026 is due Apr 15 2027 (Thu). Declare Apr 15 as a holiday.
    // The Prisma @db.Date column strips the time component but Prisma's round-trip
    // is timezone-sensitive, so we use an explicit UTC midnight to make the test
    // deterministic across local-TZ environments.
    await prisma.publicHoliday.create({
      data: {
        date: new Date(Date.UTC(2027, 3, 15)),
        name: 'Araw ng Kagitingan (test)',
        year: 2027,
      },
    })

    const res = await GET(getRequest('year=2026&preview=true'))
    const json = await res.json()

    expect(res.status).toBe(200)
    const annual = json.rollPreview.find(
      (e: { formType: string; quarter: number | null }) =>
        e.formType === 'FORM_1701A'
    )
    expect(annual).toBeDefined()
    expect(new Date(annual.statutoryDueDate).toDateString()).toBe('Thu Apr 15 2027')
    expect(new Date(annual.adjustedDueDate).toDateString()).toBe('Fri Apr 16 2027')
  })
})

describe('POST /api/admin/holidays', () => {
  it('creates a holiday and writes an audit log', async () => {
    await mockAdminAuth()

    const res = await POST(
      new NextRequest('http://localhost/api/admin/holidays', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: '2026-06-12', name: 'Independence Day' }),
      })
    )
    const json = await res.json()

    expect(res.status).toBe(201)
    expect(json.holiday.name).toBe('Independence Day')
    expect(json.holiday.year).toBe(2026)

    const audit = await prisma.auditLog.findFirst({
      where: { action: 'HOLIDAY_CREATED' },
    })
    expect(audit).not.toBeNull()
  })

  it('rejects invalid date', async () => {
    await mockAdminAuth()
    const res = await POST(
      new NextRequest('http://localhost/api/admin/holidays', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: 'not-a-date', name: 'X' }),
      })
    )
    expect(res.status).toBe(400)
  })
})

describe('DELETE /api/admin/holidays', () => {
  it('removes a holiday and writes an audit log', async () => {
    await mockAdminAuth()
    const holiday = await prisma.publicHoliday.create({
      data: { date: new Date('2026-06-12'), name: 'Independence Day', year: 2026 },
    })

    const res = await DELETE(
      new NextRequest('http://localhost/api/admin/holidays', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: holiday.id }),
      })
    )
    expect(res.status).toBe(200)

    const remaining = await prisma.publicHoliday.findUnique({ where: { id: holiday.id } })
    expect(remaining).toBeNull()

    const audit = await prisma.auditLog.findFirst({
      where: { action: 'HOLIDAY_DELETED', entityId: holiday.id },
    })
    expect(audit).not.toBeNull()
  })
})

describe('PUT /api/admin/holidays (CSV bulk import)', () => {
  it('imports holidays from a CSV body', async () => {
    await mockAdminAuth()
    const csv = [
      'date,name,year',
      '2026-01-01,New Year\'s Day,2026',
      '2026-04-09,Araw ng Kagitingan,2026',
      '2026-06-12,Independence Day,2026',
    ].join('\n')

    const res = await PUT(
      new NextRequest('http://localhost/api/admin/holidays', {
        method: 'PUT',
        headers: { 'Content-Type': 'text/csv' },
        body: csv,
      })
    )
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.inserted).toBe(3)
    expect(json.updated).toBe(0)
    expect(json.errors).toEqual([])

    const stored = await prisma.publicHoliday.findMany({ orderBy: { date: 'asc' } })
    expect(stored).toHaveLength(3)
    expect(stored[0].name).toBe("New Year's Day")
    expect(stored[0].year).toBe(2026)
  })

  it('skips duplicate dates in insert mode and writes an audit log', async () => {
    await mockAdminAuth()
    await prisma.publicHoliday.create({
      data: { date: new Date('2026-01-01'), name: 'New Year', year: 2026 },
    })

    const csv = [
      'date,name',
      '2026-01-01,New Year 2',
      '2026-06-12,Independence Day',
    ].join('\n')

    const res = await PUT(
      new NextRequest('http://localhost/api/admin/holidays', {
        method: 'PUT',
        headers: { 'Content-Type': 'text/csv' },
        body: csv,
      })
    )
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.inserted).toBe(1)
    expect(json.skipped).toBe(1)

    const audit = await prisma.auditLog.findFirst({
      where: { action: 'HOLIDAY_BULK_IMPORTED' },
    })
    expect(audit).not.toBeNull()
  })

  it('upserts when mode=upsert and an existing holiday is matched by date', async () => {
    await mockAdminAuth()
    await prisma.publicHoliday.create({
      data: { date: new Date('2026-01-01'), name: 'Old Name', year: 2026 },
    })

    const res = await PUT(
      new NextRequest('http://localhost/api/admin/holidays', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'upsert',
          rows: [
            { date: '2026-01-01', name: 'New Name' },
            { date: '2026-06-12', name: 'Independence Day' },
          ],
        }),
      })
    )
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.updated).toBe(1)
    expect(json.inserted).toBe(1)

    const updated = await prisma.publicHoliday.findFirst({
      where: { date: new Date('2026-01-01') },
    })
    expect(updated?.name).toBe('New Name')
  })

  it('rejects CSVs that are missing required columns', async () => {
    await mockAdminAuth()
    const csv = ['foo,bar', '1,2'].join('\n')

    const res = await PUT(
      new NextRequest('http://localhost/api/admin/holidays', {
        method: 'PUT',
        headers: { 'Content-Type': 'text/csv' },
        body: csv,
      })
    )
    expect(res.status).toBe(400)
  })
})
