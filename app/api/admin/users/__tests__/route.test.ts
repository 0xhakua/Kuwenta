import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { GET, PATCH, POST } from '../route'
import { prisma } from '@/lib/testing/db'
import { createUser, createTaxpayerProfile, seedReferenceData } from '@/lib/testing/factories'
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

async function createAdminUser() {
  const admin = await createUser({ username: `admin-test-${Date.now()}`, role: 'ADMIN' })
  return admin.id
}

async function mockAdminAuth() {
  const adminId = await createAdminUser()
  vi.mocked(requireAuth).mockResolvedValue({
    sub: adminId,
    username: 'admin',
    role: 'ADMIN',
    iat: 1,
    exp: 9999999999,
  })
  return adminId
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

function getRequest(q = '') {
  return new NextRequest(`http://localhost/api/admin/users?q=${encodeURIComponent(q)}`, {
    method: 'GET',
  })
}

function patchRequest(body: unknown) {
  return new NextRequest('http://localhost/api/admin/users', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function postRequest(body: unknown) {
  return new NextRequest('http://localhost/api/admin/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('GET /api/admin/users', () => {
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

  it('lists all users with taxpayer data', async () => {
    await seedReferenceData()
    await mockAdminAuth()
    const user = await createUser({ username: 'list-test' })
    await createTaxpayerProfile(user.id, { tin: '111-222-333-4444', fullName: 'List Test' })

    const res = await GET(getRequest())
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.users).toHaveLength(2)
    const listUser = json.users.find((u: AdminUser) => u.username === 'list-test')
    expect(listUser).toMatchObject({
      username: 'list-test',
      role: 'TAXPAYER',
      isActive: true,
      taxpayer: {
        tin: '111-222-333-4444',
        fullName: 'List Test',
      },
    })
  })

  it('searches by username', async () => {
    await mockAdminAuth()
    await createUser({ username: 'alpha' })
    await createUser({ username: 'beta' })

    const res = await GET(getRequest('alp'))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.users).toHaveLength(1)
    expect(json.users[0].username).toBe('alpha')
  })

  it('searches by TIN', async () => {
    await seedReferenceData()
    await mockAdminAuth()
    const u1 = await createUser({ username: 'tin-search-1' })
    await createTaxpayerProfile(u1.id, { tin: '999-888-777-6666' })
    const u2 = await createUser({ username: 'tin-search-2' })
    await createTaxpayerProfile(u2.id, { tin: '111-222-333-4444' })

    const res = await GET(getRequest('999-888'))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.users).toHaveLength(1)
    expect(json.users[0].username).toBe('tin-search-1')
  })

  it('searches by full name', async () => {
    await seedReferenceData()
    await mockAdminAuth()
    const u1 = await createUser({ username: 'name-search-1' })
    await createTaxpayerProfile(u1.id, { fullName: 'Maria Clara' })
    const u2 = await createUser({ username: 'name-search-2' })
    await createTaxpayerProfile(u2.id, { fullName: 'Juan Luna' })

    const res = await GET(getRequest('maria'))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.users).toHaveLength(1)
    expect(json.users[0].username).toBe('name-search-1')
  })
})

describe('PATCH /api/admin/users', () => {
  it('deactivates a user and writes an audit log', async () => {
    await mockAdminAuth()
    const target = await createUser({ username: 'deactivate-target' })

    const res = await PATCH(patchRequest({ userId: target.id, isActive: false }))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.user.isActive).toBe(false)

    const audit = await prisma.auditLog.findFirst({
      where: { action: 'USER_DEACTIVATED', entityId: target.id },
    })
    expect(audit).not.toBeNull()
  })

  it('reactivates a user and writes an audit log', async () => {
    await mockAdminAuth()
    const target = await createUser({ username: 'reactivate-target', isActive: false })

    const res = await PATCH(patchRequest({ userId: target.id, isActive: true }))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.user.isActive).toBe(true)

    const audit = await prisma.auditLog.findFirst({
      where: { action: 'USER_REACTIVATED', entityId: target.id },
    })
    expect(audit).not.toBeNull()
  })

  it('prevents an admin from deactivating their own account', async () => {
    const adminId = await mockAdminAuth()

    const res = await PATCH(patchRequest({ userId: adminId, isActive: false }))
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toContain('own account')
  })

  it('returns 404 for unknown user', async () => {
    await mockAdminAuth()
    const res = await PATCH(patchRequest({ userId: 'nonexistent-id', isActive: false }))
    expect(res.status).toBe(404)
  })
})

describe('POST /api/admin/users (reset password)', () => {
  it('generates a temporary password and writes an audit log', async () => {
    await mockAdminAuth()
    const target = await createUser({ username: 'reset-target' })

    const res = await POST(postRequest({ userId: target.id }))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.username).toBe('reset-target')
    expect(json.tempPassword).toHaveLength(12)

    const updated = await prisma.user.findUnique({ where: { id: target.id } })
    expect(updated?.passwordHash).not.toBe(target.passwordHash)

    const audit = await prisma.auditLog.findFirst({
      where: { action: 'PASSWORD_RESET', entityId: target.id },
    })
    expect(audit).not.toBeNull()
  })

  it('returns 404 for unknown user', async () => {
    await mockAdminAuth()
    const res = await POST(postRequest({ userId: 'nonexistent-id' }))
    expect(res.status).toBe(404)
  })
})
