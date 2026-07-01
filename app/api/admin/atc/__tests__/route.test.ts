import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { GET, POST, PATCH, DELETE } from '../route'
import { prisma } from '@/lib/testing/db'
import { createUser, createTaxpayerProfile, createTaxYear, createForm2307 } from '@/lib/testing/factories'
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
  const url = query ? `http://localhost/api/admin/atc?${query}` : 'http://localhost/api/admin/atc'
  return new NextRequest(url, { method: 'GET' })
}

describe('GET /api/admin/atc', () => {
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

  it('lists active codes with usage counts by default', async () => {
    await mockAdminAuth()
    await prisma.aTCCode.create({
      data: { code: 'WI100', description: 'Professional', ewtRate: 0.1, isActive: true },
    })
    await prisma.aTCCode.create({
      data: { code: 'WI200', description: 'Inactive Code', ewtRate: 0.15, isActive: false },
    })

    const user = await createUser()
    const profile = await createTaxpayerProfile(user.id)
    await prisma.taxpayerATC.create({ data: { taxpayerId: profile.id, atcCode: 'WI100' } })
    const taxYear = await createTaxYear(profile.id, 2026)
    await createForm2307(taxYear.id, 'WI100', { quarter: 1 })

    const res = await GET(getRequest())
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.codes).toHaveLength(1)
    expect(json.codes[0]).toMatchObject({
      code: 'WI100',
      description: 'Professional',
      isActive: true,
      taxpayerCount: 1,
      certificateCount: 1,
      usageCount: 2,
    })
  })

  it('includes inactive codes when includeInactive=true', async () => {
    await mockAdminAuth()
    await prisma.aTCCode.create({
      data: { code: 'WI100', description: 'Active', ewtRate: 0.1, isActive: true },
    })
    await prisma.aTCCode.create({
      data: { code: 'WI200', description: 'Inactive', ewtRate: 0.15, isActive: false },
    })

    const res = await GET(getRequest('includeInactive=true'))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.codes).toHaveLength(2)
  })

  it('filters by code or description (case-insensitive)', async () => {
    await mockAdminAuth()
    await prisma.aTCCode.create({
      data: { code: 'WI100', description: 'Professional fees', ewtRate: 0.1, isActive: true },
    })
    await prisma.aTCCode.create({
      data: { code: 'WI200', description: 'Agent commissions', ewtRate: 0.1, isActive: true },
    })

    const byCode = await GET(getRequest('q=wi100'))
    const byCodeJson = await byCode.json()
    expect(byCodeJson.codes).toHaveLength(1)
    expect(byCodeJson.codes[0].code).toBe('WI100')

    const byDesc = await GET(getRequest('q=commissions'))
    const byDescJson = await byDesc.json()
    expect(byDescJson.codes).toHaveLength(1)
    expect(byDescJson.codes[0].code).toBe('WI200')
  })
})

describe('POST /api/admin/atc', () => {
  it('creates a code and writes an audit log', async () => {
    await mockAdminAuth()

    const res = await POST(
      new NextRequest('http://localhost/api/admin/atc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: 'wi300',
          description: 'Test Code',
          ewtRate: '0.12',
          isActive: true,
        }),
      })
    )
    const json = await res.json()

    expect(res.status).toBe(201)
    expect(json.code.code).toBe('WI300')
    expect(json.code.ewtRate).toBe('0.12')

    const audit = await prisma.auditLog.findFirst({
      where: { action: 'ATC_CREATED', entityId: 'WI300' },
    })
    expect(audit).not.toBeNull()
  })

  it('rejects duplicate codes with 409', async () => {
    await mockAdminAuth()
    await prisma.aTCCode.create({
      data: { code: 'WI100', description: 'Existing', ewtRate: 0.1 },
    })

    const res = await POST(
      new NextRequest('http://localhost/api/admin/atc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: 'WI100',
          description: 'Duplicate',
          ewtRate: '0.1',
          isActive: true,
        }),
      })
    )
    expect(res.status).toBe(409)
  })

  it('rejects invalid ewt rate format', async () => {
    await mockAdminAuth()

    const res = await POST(
      new NextRequest('http://localhost/api/admin/atc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: 'WI100',
          description: 'Bad',
          ewtRate: 'abc',
          isActive: true,
        }),
      })
    )
    expect(res.status).toBe(400)
  })
})

describe('PATCH /api/admin/atc', () => {
  it('updates description, rate, and isActive', async () => {
    await mockAdminAuth()
    await prisma.aTCCode.create({
      data: { code: 'WI100', description: 'Original', ewtRate: 0.1, isActive: true },
    })

    const res = await PATCH(
      new NextRequest('http://localhost/api/admin/atc', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: 'WI100',
          description: 'Updated',
          ewtRate: '0.15',
          isActive: false,
        }),
      })
    )
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.code.description).toBe('Updated')
    expect(json.code.ewtRate).toBe('0.15')
    expect(json.code.isActive).toBe(false)

    const audit = await prisma.auditLog.findFirst({
      where: { action: 'ATC_UPDATED', entityId: 'WI100' },
    })
    expect(audit).not.toBeNull()
    expect((audit?.metadata as { previousIsActive?: boolean } | null)?.previousIsActive).toBe(true)
  })

  it('returns 404 for unknown codes', async () => {
    await mockAdminAuth()
    const res = await PATCH(
      new NextRequest('http://localhost/api/admin/atc', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: 'ZZZZZ', description: 'X' }),
      })
    )
    expect(res.status).toBe(404)
  })
})

describe('DELETE /api/admin/atc', () => {
  it('deletes an unused code and writes an audit log', async () => {
    await mockAdminAuth()
    await prisma.aTCCode.create({
      data: { code: 'WI100', description: 'Test', ewtRate: 0.1 },
    })

    const res = await DELETE(
      new NextRequest('http://localhost/api/admin/atc', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: 'WI100' }),
      })
    )
    expect(res.status).toBe(200)

    const audit = await prisma.auditLog.findFirst({
      where: { action: 'ATC_DELETED', entityId: 'WI100' },
    })
    expect(audit).not.toBeNull()
  })

  it('refuses to delete a code referenced by a taxpayer', async () => {
    await mockAdminAuth()
    await prisma.aTCCode.create({
      data: { code: 'WI100', description: 'Test', ewtRate: 0.1 },
    })
    const user = await createUser()
    const profile = await createTaxpayerProfile(user.id)
    await prisma.taxpayerATC.create({ data: { taxpayerId: profile.id, atcCode: 'WI100' } })

    const res = await DELETE(
      new NextRequest('http://localhost/api/admin/atc', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: 'WI100' }),
      })
    )
    expect(res.status).toBe(409)
  })

  it('refuses to delete a code referenced by a Form 2307', async () => {
    await mockAdminAuth()
    await prisma.aTCCode.create({
      data: { code: 'WI100', description: 'Test', ewtRate: 0.1 },
    })
    const user = await createUser()
    const profile = await createTaxpayerProfile(user.id)
    const taxYear = await createTaxYear(profile.id, 2026)
    await createForm2307(taxYear.id, 'WI100', { quarter: 1 })

    const res = await DELETE(
      new NextRequest('http://localhost/api/admin/atc', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: 'WI100' }),
      })
    )
    expect(res.status).toBe(409)
  })
})
