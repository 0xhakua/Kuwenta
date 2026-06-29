import { describe, expect, it } from 'vitest'
import { computeDaysLate, computePenalties } from '../penalties'
import { d } from './helpers'

describe('computePenalties', () => {
  it('returns zero penalties when filed on time', () => {
    const result = computePenalties({ taxDue: d('10000'), daysLate: 0, compromiseFee: d('1000') })

    expect(result.daysLate).toBe(0)
    expect(result.surcharge.toString()).toBe('0')
    expect(result.interest.toString()).toBe('0')
    expect(result.compromisePenalty.toString()).toBe('0')
    expect(result.totalPenalty.toString()).toBe('0')
  })

  it('computes surcharge and interest when late with tax due', () => {
    // 10% surcharge = 1000; interest = 10000 * 6% * 30 / 365 = 49.315... -> 49.32; compromise 1000
    const result = computePenalties({ taxDue: d('10000'), daysLate: 30, compromiseFee: d('1000') })

    expect(result.surcharge.toString()).toBe('1000')
    expect(result.interest.toString()).toBe('49.32')
    expect(result.compromisePenalty.toString()).toBe('1000')
    expect(result.totalPenalty.toString()).toBe('2049.32')
  })

  it('applies only compromise penalty when tax due is zero but filing is late', () => {
    const result = computePenalties({ taxDue: d('0'), daysLate: 30, compromiseFee: d('1000') })

    expect(result.surcharge.toString()).toBe('0')
    expect(result.interest.toString()).toBe('0')
    expect(result.compromisePenalty.toString()).toBe('1000')
    expect(result.totalPenalty.toString()).toBe('1000')
  })

  it('rounds interest to two decimal places', () => {
    // 12345.67 * 6% * 16 / 365 = 32.470... -> 32.47
    const result = computePenalties({ taxDue: d('12345.67'), daysLate: 16, compromiseFee: d('500') })

    expect(result.interest.toString()).toBe('32.47')
  })
})

describe('computeDaysLate', () => {
  it('returns zero when filed on the due date', () => {
    const due = new Date(2026, 3, 15) // Apr 15
    const filed = new Date(2026, 3, 15)
    expect(computeDaysLate(due, filed)).toBe(0)
  })

  it('returns one when filed the day after the due date', () => {
    const due = new Date(2026, 3, 15)
    const filed = new Date(2026, 3, 16)
    expect(computeDaysLate(due, filed)).toBe(1)
  })

  it('ignores time of day and measures whole days', () => {
    const due = new Date(2026, 3, 15, 23, 59)
    const filed = new Date(2026, 3, 16, 0, 1)
    expect(computeDaysLate(due, filed)).toBe(1)
  })

  it('returns zero when filed before the due date', () => {
    const due = new Date(2026, 3, 15)
    const filed = new Date(2026, 3, 10)
    expect(computeDaysLate(due, filed)).toBe(0)
  })
})
