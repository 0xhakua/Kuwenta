import { describe, it, expect } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from './route'
import { prisma } from '@/lib/testing/db'
import { createUser, createATCCode, seedReferenceData } from '@/lib/testing/factories'
import { signToken } from '@/lib/auth/session'

async function makeRequest(userId: string, body: object): Promise<NextRequest> {
  const token = await signToken({ sub: userId, username: 'test', role: 'TAXPAYER' })
  return new NextRequest('http://localhost/api/taxpayer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: `kuwenta_session=${token}` },
    body: JSON.stringify(body),
  })
}

const basePayload = {
  tin: '123-456-789-9999',
  fullName: 'New Registrant',
  rdoCode: '040',
  registeredAddress: '123 Test St',
  zipCode: '1200',
  natureOfBusiness: 'Consulting',
  incomeType: 'PURE_SELF_EMPLOYMENT',
  corIncludes2551Q: true,
  taxYear: 2026,
}

describe('POST /api/taxpayer', () => {
  it('pre-confirms 8% election when isNewRegistrant is true', async () => {
    await seedReferenceData()
    const user = await createUser()
    const atc = await createATCCode({ code: 'WI999', ewtRate: 0.1 })

    const req = await makeRequest(user.id, {
      ...basePayload,
      isNewRegistrant: true,
      atcCodes: [atc.code],
    })

    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(201)
    expect(json.profile.isNewRegistrant).toBe(true)

    const taxYear = await prisma.taxYear.findFirst({
      where: { taxpayerId: json.profile.id },
    })
    expect(taxYear?.electionStatus).toBe('ELECTED_8PCT')
    expect(taxYear?.electedRate).toBe('RATE_8PCT')
    expect(taxYear?.electionDate).not.toBeNull()
    expect(taxYear?.electionLockedAt).not.toBeNull()
  })

  it('leaves election as NOT_ELECTED when isNewRegistrant is false', async () => {
    await seedReferenceData()
    const user = await createUser()
    const atc = await createATCCode({ code: 'WI998', ewtRate: 0.1 })

    const req = await makeRequest(user.id, {
      ...basePayload,
      isNewRegistrant: false,
      atcCodes: [atc.code],
    })

    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(201)
    expect(json.profile.isNewRegistrant).toBe(false)

    const taxYear = await prisma.taxYear.findFirst({
      where: { taxpayerId: json.profile.id },
    })
    expect(taxYear?.electionStatus).toBe('NOT_ELECTED')
    expect(taxYear?.electedRate).toBeNull()
  })

  // Regression for #97: Zod's `error.format()` returns a nested
  // `{ _errors, field: { _errors, ... } }` object. Rendering that object
  // directly as a React child throws "Objects are not valid as a React
  // child (found: object with keys {_errors, tin})". The API must return
  // a flat, serializable shape.
  it('returns a flat, serializable error body on validation failure (issue #97)', async () => {
    await seedReferenceData()
    const user = await createUser()

    const req = await makeRequest(user.id, {
      ...basePayload,
      tin: '12345', // invalid: must match NNN-NNN-NNN-NNNN
      atcCodes: [], // invalid: at least one required
    })

    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    // Top-level `error` is a plain string, never an object.
    expect(typeof json.error).toBe('string')
    // Field errors are flat string arrays keyed by field name.
    expect(json.fieldErrors).toBeTypeOf('object')
    expect(Array.isArray(json.fieldErrors.tin)).toBe(true)
    expect(json.fieldErrors.tin[0]).toMatch(/NNN-NNN-NNN-NNNN/)
    expect(Array.isArray(json.fieldErrors.atcCodes)).toBe(true)
    // No nested `_errors` shape that would crash React.
    expect(json).not.toHaveProperty('_errors')
    expect(json.fieldErrors.tin).not.toHaveProperty('_errors')
  })
})
