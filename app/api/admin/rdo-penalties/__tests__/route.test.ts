import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { GET, POST, PATCH, DELETE } from '../route'
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

function postRequest(body: unknown) {
  return new NextRequest('http://localhost/api/admin/rdo-penalties', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function patchRequest(body: unknown) {
  return new NextRequest('http://localhost/api/admin/rdo-penalties', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function deleteRequest(body: unknown) {
  return new NextRequest('http://localhost/api/admin/rdo-penalties', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('GET /api/admin/rdo-penalties', () => {
  it('returns 401 when not authenticated', async () => {
    vi.mocked(requireAuth).mockResolvedValue(null)
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('returns 403 for non-admin users', async () => {
    const user = await createUser()
    mockTaxpayerAuth(user.id)
    const res = await GET()
    expect(res.status).toBe(403)
  })

  it('lists schedules ordered by RDO code', async () => {
    await mockAdminAuth()
    await prisma.rDOPenaltySchedule.create({
      data: { rdoCode: '044', compromiseFee: 750 },
    })
    await prisma.rDOPenaltySchedule.create({
      data: { rdoCode: '040', compromiseFee: 500 },
    })

    const res = await GET()
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.schedules).toHaveLength(2)
    expect(json.schedules[0].rdoCode).toBe('040')
    expect(json.schedules[1].rdoCode).toBe('044')
  })
})

describe('POST /api/admin/rdo-penalties', () => {
  it('creates a schedule and writes an audit log', async () => {
    await mockAdminAuth()

    const res = await POST(postRequest({ rdoCode: '040', compromiseFee: '500.00' }))
    const json = await res.json()

    expect(res.status).toBe(201)
    expect(json.schedule.rdoCode).toBe('040')
    expect(json.schedule.compromiseFee).toBe('500')

    const audit = await prisma.auditLog.findFirst({
      where: { action: 'RDO_PENALTY_CREATED' },
    })
    expect(audit).not.toBeNull()
  })

  it('uppercases the RDO code', async () => {
    await mockAdminAuth()
    const res = await POST(postRequest({ rdoCode: ' 040a ', compromiseFee: '500' }))
    const json = await res.json()
    expect(json.schedule.rdoCode).toBe('040A')
  })

  it('updates an existing schedule on duplicate POST and writes a single audit log', async () => {
    await mockAdminAuth()
    await prisma.rDOPenaltySchedule.create({
      data: { rdoCode: '040', compromiseFee: 500 },
    })

    const res = await POST(postRequest({ rdoCode: '040', compromiseFee: '750' }))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.schedule.compromiseFee).toBe('750')

    const stored = await prisma.rDOPenaltySchedule.findUnique({ where: { rdoCode: '040' } })
    expect(stored?.compromiseFee.toString()).toBe('750')

    const audit = await prisma.auditLog.findFirst({
      where: { action: 'RDO_PENALTY_UPDATED', entityId: stored?.id },
    })
    expect(audit).not.toBeNull()
    expect((audit?.metadata as { previousCompromiseFee?: string } | null)?.previousCompromiseFee).toBe('500')
  })

  it('rejects zero with a 400', async () => {
    await mockAdminAuth()
    const res = await POST(postRequest({ rdoCode: '040', compromiseFee: '0' }))
    expect(res.status).toBe(400)
  })

  it('rejects negative values with a 400', async () => {
    await mockAdminAuth()
    const res = await POST(postRequest({ rdoCode: '040', compromiseFee: '-100' }))
    expect(res.status).toBe(400)
  })

  it('rejects non-decimal strings with a 400', async () => {
    await mockAdminAuth()
    const res = await POST(postRequest({ rdoCode: '040', compromiseFee: 'abc' }))
    expect(res.status).toBe(400)
  })
})

describe('PATCH /api/admin/rdo-penalties', () => {
  it('updates an existing schedule and writes an audit log', async () => {
    await mockAdminAuth()
    const schedule = await prisma.rDOPenaltySchedule.create({
      data: { rdoCode: '040', compromiseFee: 500 },
    })

    const res = await PATCH(patchRequest({ id: schedule.id, compromiseFee: '1500.50' }))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.schedule.compromiseFee).toBe('1500.5')

    const audit = await prisma.auditLog.findFirst({
      where: { action: 'RDO_PENALTY_UPDATED', entityId: schedule.id },
    })
    expect(audit).not.toBeNull()
    expect((audit?.metadata as { previousCompromiseFee?: string } | null)?.previousCompromiseFee).toBe('500')
  })

  it('returns 404 for unknown IDs', async () => {
    await mockAdminAuth()
    const res = await PATCH(patchRequest({ id: 'does-not-exist', compromiseFee: '500' }))
    expect(res.status).toBe(404)
  })

  it('rejects zero with a 400', async () => {
    await mockAdminAuth()
    const schedule = await prisma.rDOPenaltySchedule.create({
      data: { rdoCode: '040', compromiseFee: 500 },
    })
    const res = await PATCH(patchRequest({ id: schedule.id, compromiseFee: '0' }))
    expect(res.status).toBe(400)
  })
})

describe('DELETE /api/admin/rdo-penalties', () => {
  it('deletes a schedule and writes an audit log', async () => {
    await mockAdminAuth()
    const schedule = await prisma.rDOPenaltySchedule.create({
      data: { rdoCode: '040', compromiseFee: 500 },
    })

    const res = await DELETE(deleteRequest({ id: schedule.id }))
    expect(res.status).toBe(200)

    const remaining = await prisma.rDOPenaltySchedule.findUnique({ where: { id: schedule.id } })
    expect(remaining).toBeNull()

    const audit = await prisma.auditLog.findFirst({
      where: { action: 'RDO_PENALTY_DELETED', entityId: schedule.id },
    })
    expect(audit).not.toBeNull()
  })

  it('returns 404 for unknown IDs', async () => {
    await mockAdminAuth()
    const res = await DELETE(deleteRequest({ id: 'does-not-exist' }))
    expect(res.status).toBe(404)
  })
})
