import { describe, expect, it } from 'vitest'
import { buildLineage, type LineageCredit } from '../prior-year-credit-lineage'

function credit(partial: Partial<LineageCredit> & { taxYear: number }): LineageCredit {
  return {
    id: `c-${partial.taxYear}`,
    taxYearId: `ty-${partial.taxYear}`,
    amount: '1000.00',
    originYear: partial.taxYear - 1,
    originForm: '1701A',
    priorDisposition: 'CARRY_OVER',
    ...partial,
  }
}

describe('buildLineage', () => {
  it('returns a single node with no credit when none exists for the current year', () => {
    const chain = buildLineage(2026, new Map())
    expect(chain).toEqual([{ year: 2026, credit: null }])
  })

  it('walks back through carry-over credits across tax years', () => {
    const credits = new Map<number, LineageCredit>([
      [2026, credit({ taxYear: 2026, originYear: 2024 })],
      [2024, credit({ taxYear: 2024, originYear: 2022 })],
      [2022, credit({ taxYear: 2022, originYear: 2020, amount: '300.00' })],
    ])

    const chain = buildLineage(2026, credits)
    expect(chain).toHaveLength(4)
    expect(chain.map((n) => n.year)).toEqual([2026, 2024, 2022, 2020])
    expect(chain[0].credit?.amount).toBe('1000.00')
    expect(chain[2].credit?.amount).toBe('300.00')
    expect(chain[3].credit).toBeNull()
  })

  it('stops at the first year with no credit', () => {
    const credits = new Map<number, LineageCredit>([
      [2026, credit({ taxYear: 2026, originYear: 2023 })],
    ])

    const chain = buildLineage(2026, credits)
    expect(chain).toHaveLength(2)
    expect(chain[1]).toEqual({ year: 2023, credit: null })
  })

  it('breaks the chain on a cycle (defensive)', () => {
    const credits = new Map<number, LineageCredit>([
      [2026, credit({ taxYear: 2026, originYear: 2025 })],
      [2025, credit({ taxYear: 2025, originYear: 2026 })],
    ])

    const chain = buildLineage(2026, credits)
    expect(chain.length).toBeLessThanOrEqual(50)
    expect(chain[0].year).toBe(2026)
    expect(chain[1].year).toBe(2025)
  })

  it('includes disposition info for each credit', () => {
    const credits = new Map<number, LineageCredit>([
      [2026, credit({ taxYear: 2026, priorDisposition: 'CARRY_OVER' })],
    ])

    const chain = buildLineage(2026, credits)
    expect(chain[0].credit?.priorDisposition).toBe('CARRY_OVER')
  })
})
