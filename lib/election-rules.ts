/**
 * Pure business rules for the 8% election flow.
 *
 * BR-03: Election is irrevocable for the entire taxable year (locked at the
 *        moment the user confirms the election).
 * BR-11: A new taxable year resets election to default (Graduated); the user
 *        is re-prompted to elect.
 *
 * These rules are extracted so they can be unit-tested without touching the
 * database or the Next.js request/cookie layer.
 */

export type ElectionState = {
  electionLockedAt: Date | null | undefined
  firstReturnStatus?: string | null
}

export type ElectionDecision =
  | { allowed: true }
  | { allowed: false; reason: string }

/**
 * Determine whether a taxpayer is allowed to record an election for the
 * current tax year.
 */
export function canElect(state: ElectionState): ElectionDecision {
  if (state.electionLockedAt) {
    return { allowed: false, reason: 'Election is locked for this tax year' }
  }
  if (state.firstReturnStatus === 'FILED') {
    return {
      allowed: false,
      reason: 'Cannot elect after the first quarterly return has been filed',
    }
  }
  return { allowed: true }
}

/**
 * Default election state for a freshly initialized tax year (BR-11).
 */
export function freshElectionState(): {
  electionStatus: 'NOT_ELECTED'
  electedRate: null
  electionDate: null
  electionLockedAt: null
} {
  return {
    electionStatus: 'NOT_ELECTED',
    electedRate: null,
    electionDate: null,
    electionLockedAt: null,
  }
}
