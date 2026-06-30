import crypto from 'crypto'
import { describe, it, expect } from 'vitest'
import {
  encodeAnchorPayload,
  parseAnchorOperations,
} from '../anchor'

describe('encodeAnchorPayload', () => {
  it('splits the hash and ISO timestamp into two manageData entries', () => {
    const returnId = 'cm00000000000000000000001'
    const hash = crypto.createHash('sha256').update('pdf-bytes').digest('hex')
    const filedDate = '2026-06-29T12:34:56.789Z'

    const payload = encodeAnchorPayload(returnId, hash, filedDate)

    expect(payload.hashKey).toBe(`kuwenta:ph:${returnId}`)
    expect(payload.hashValue).toBe(hash)
    expect(payload.timestampKey).toBe(`kuwenta:ts:${returnId}`)
    expect(payload.timestampValue).toBe(filedDate)

    expect(Buffer.byteLength(payload.hashValue, 'utf8')).toBe(64)
    expect(Buffer.byteLength(payload.timestampValue, 'utf8')).toBeLessThanOrEqual(64)
  })

  it('rejects an invalid hash', () => {
    expect(() => encodeAnchorPayload('ret-id', 'not-a-hash', '2026-06-29T12:34:56.789Z')).toThrow(
      'payloadHash must be a 64-character lower/upper-case hex string'
    )
  })

  it('rejects an invalid timestamp', () => {
    const hash = crypto.createHash('sha256').update('x').digest('hex')
    expect(() => encodeAnchorPayload('ret-id', hash, 'not-a-date')).toThrow(
      'filedDate must be a valid ISO timestamp'
    )
  })
})

describe('parseAnchorOperations', () => {
  const returnId = 'cm00000000000000000000001'
  const hash = crypto.createHash('sha256').update('pdf-bytes').digest('hex')
  const filedDate = '2026-06-29T12:34:56.789Z'

  it('recovers hash and timestamp from SDK-style Buffer operations', () => {
    const parsed = parseAnchorOperations([
      { type: 'manageData', name: `kuwenta:ph:${returnId}`, value: Buffer.from(hash, 'utf8') },
      { type: 'manageData', name: `kuwenta:ts:${returnId}`, value: Buffer.from(filedDate, 'utf8') },
    ])

    expect(parsed).toEqual({ payloadHash: hash, filedDate })
  })

  it('recovers hash and timestamp from Horizon-style base64 operations', () => {
    const parsed = parseAnchorOperations([
      {
        type: 'manageData',
        name: `kuwenta:ph:${returnId}`,
        value: Buffer.from(hash, 'utf8').toString('base64'),
      },
      {
        type: 'manageData',
        name: `kuwenta:ts:${returnId}`,
        value: Buffer.from(filedDate, 'utf8').toString('base64'),
      },
    ])

    expect(parsed).toEqual({ payloadHash: hash, filedDate })
  })

  it('returns null when the hash entry is missing', () => {
    const parsed = parseAnchorOperations([
      { type: 'manageData', name: `kuwenta:ts:${returnId}`, value: Buffer.from(filedDate, 'utf8') },
    ])

    expect(parsed).toBeNull()
  })

  it('returns null when the timestamp entry is missing', () => {
    const parsed = parseAnchorOperations([
      { type: 'manageData', name: `kuwenta:ph:${returnId}`, value: Buffer.from(hash, 'utf8') },
    ])

    expect(parsed).toBeNull()
  })

  it('ignores non-manageData operations', () => {
    const parsed = parseAnchorOperations([
      { type: 'payment', name: undefined, value: undefined },
      { type: 'manageData', name: `kuwenta:ph:${returnId}`, value: Buffer.from(hash, 'utf8') },
      { type: 'manageData', name: `kuwenta:ts:${returnId}`, value: Buffer.from(filedDate, 'utf8') },
    ])

    expect(parsed).toEqual({ payloadHash: hash, filedDate })
  })
})
