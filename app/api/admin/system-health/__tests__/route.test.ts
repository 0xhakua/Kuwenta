import { describe, it, expect, vi, beforeEach } from 'vitest'
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

function mockTaxpayerAuth(userId: string) {
  vi.mocked(requireAuth).mockResolvedValue({
    sub: userId,
    username: 'taxpayer',
    role: 'TAXPAYER',
    iat: 1,
    exp: 9999999999,
  })
}

describe('GET /api/admin/system-health', () => {
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

  it('returns the full health payload with latency, free bytes, and migration status', async () => {
    await mockAdminAuth()

    const res = await GET()
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json).toHaveProperty('checkedAt')
    expect(typeof json.checkedAt).toBe('string')

    // Stellar
    expect(json.stellar).toMatchObject({
      network: expect.stringMatching(/^(testnet|public)$/),
      horizonUrl: expect.any(String),
      reachable: expect.any(Boolean),
      configured: expect.any(Boolean),
      message: expect.any(String),
    })
    // Latency is a number when the request completes, or null when fetch never resolves.
    expect(json.stellar.latencyMs === null || typeof json.stellar.latencyMs === 'number').toBe(true)

    // Storage
    expect(json.storage).toMatchObject({
      type: expect.any(String),
      path: expect.any(String),
      writable: expect.any(Boolean),
      message: expect.any(String),
    })
    // freeBytes/totalBytes may be null on systems without statfs; both are acceptable.
    expect(
      json.storage.freeBytes === null || typeof json.storage.freeBytes === 'number'
    ).toBe(true)
    expect(
      json.storage.totalBytes === null || typeof json.storage.totalBytes === 'number'
    ).toBe(true)

    // Database
    expect(json.database).toMatchObject({
      message: expect.any(String),
    })
    expect(typeof json.database.ok).toBe('boolean')
    if (json.database.migrations) {
      expect(json.database.migrations).toMatchObject({
        applied: expect.any(Number),
        pending: expect.any(Number),
        status: expect.stringMatching(/^(ok|pending|unknown)$/),
      })
    }
  })
})
