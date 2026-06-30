import { describe, expect, it } from 'vitest'
import { canElect, freshElectionState } from '../election-rules'

describe('canElect', () => {
  it('allows election when electionLockedAt is null and no first return is filed', () => {
    const decision = canElect({ electionLockedAt: null, firstReturnStatus: null })
    expect(decision.allowed).toBe(true)
  })

  it('allows election when first return exists but is not FILED', () => {
    const decision = canElect({
      electionLockedAt: null,
      firstReturnStatus: 'PENDING',
    })
    expect(decision.allowed).toBe(true)
  })

  it('blocks election when electionLockedAt is set (BR-03)', () => {
    const decision = canElect({
      electionLockedAt: new Date('2026-02-15T08:00:00Z'),
      firstReturnStatus: null,
    })
    expect(decision.allowed).toBe(false)
    if (!decision.allowed) {
      expect(decision.reason).toMatch(/locked/i)
    }
  })

  it('blocks election when the first return is already FILED', () => {
    const decision = canElect({
      electionLockedAt: null,
      firstReturnStatus: 'FILED',
    })
    expect(decision.allowed).toBe(false)
    if (!decision.allowed) {
      expect(decision.reason).toMatch(/first quarterly return/i)
    }
  })

  it('prefers the lock reason over the filed-return reason when both apply', () => {
    const decision = canElect({
      electionLockedAt: new Date('2026-02-15T08:00:00Z'),
      firstReturnStatus: 'FILED',
    })
    expect(decision.allowed).toBe(false)
    if (!decision.allowed) {
      expect(decision.reason).toMatch(/locked/i)
    }
  })
})

describe('freshElectionState', () => {
  it('returns the BR-11 default for a new tax year', () => {
    const state = freshElectionState()
    expect(state).toEqual({
      electionStatus: 'NOT_ELECTED',
      electedRate: null,
      electionDate: null,
      electionLockedAt: null,
    })
  })

  it('produces a state that canElect allows', () => {
    const decision = canElect({
      electionLockedAt: freshElectionState().electionLockedAt,
      firstReturnStatus: null,
    })
    expect(decision.allowed).toBe(true)
  })
})
