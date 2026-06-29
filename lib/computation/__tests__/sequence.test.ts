import { describe, expect, it } from 'vitest'
import { determineReturnStatus, getDependencies } from '../sequence'

describe('getDependencies', () => {
  it('returns the 8-return dependency graph when COR includes 2551Q', () => {
    const deps = getDependencies(true)
    expect(deps[1]).toEqual([])
    expect(deps[5]).toEqual([1]) // 1701Q Q1 depends on 2551Q Q1
    expect(deps[8]).toEqual([1, 5, 6, 7]) // 1701A depends on prior returns
  })

  it('returns the 4-return dependency graph when COR does not include 2551Q', () => {
    const deps = getDependencies(false)
    expect(deps[1]).toEqual([])
    expect(deps[2]).toEqual([1])
    expect(deps[4]).toEqual([1, 2, 3])
  })
})

describe('determineReturnStatus', () => {
  it('returns BLOCKED when the return is missing', () => {
    const result = determineReturnStatus(1, [], true)
    expect(result).toBe('BLOCKED')
  })

  it('preserves FILED status regardless of dependencies', () => {
    const result = determineReturnStatus(1, [{ sequenceOrder: 1, status: 'FILED' }], true)
    expect(result).toBe('FILED')
  })

  it('preserves GENERATED status regardless of dependencies', () => {
    const result = determineReturnStatus(2, [{ sequenceOrder: 2, status: 'GENERATED' }], false)
    expect(result).toBe('GENERATED')
  })

  it('returns BLOCKED when dependencies are not all filed (8-path)', () => {
    const returns = [
      { sequenceOrder: 1, status: 'FILED' },
      { sequenceOrder: 5, status: 'PENDING' },
    ]
    // 1701Q Q2 (order 6) depends on 1 and 5
    const result = determineReturnStatus(6, returns, true)
    expect(result).toBe('BLOCKED')
  })

  it('returns PENDING when all dependencies are filed (8-path)', () => {
    const returns = [
      { sequenceOrder: 1, status: 'FILED' },
      { sequenceOrder: 5, status: 'FILED' },
      { sequenceOrder: 6, status: 'PENDING' },
    ]
    const result = determineReturnStatus(6, returns, true)
    expect(result).toBe('PENDING')
  })

  it('returns PENDING for Q1 because it has no dependencies', () => {
    const returns = [{ sequenceOrder: 1, status: 'PENDING' }]
    const result = determineReturnStatus(1, returns, true)
    expect(result).toBe('PENDING')
  })

  it('returns BLOCKED when dependencies are not all filed (4-path)', () => {
    const returns = [
      { sequenceOrder: 1, status: 'FILED' },
      { sequenceOrder: 2, status: 'PENDING' },
    ]
    const result = determineReturnStatus(3, returns, false)
    expect(result).toBe('BLOCKED')
  })

  it('returns PENDING when all dependencies are filed (4-path)', () => {
    const returns = [
      { sequenceOrder: 1, status: 'FILED' },
      { sequenceOrder: 2, status: 'FILED' },
      { sequenceOrder: 3, status: 'FILED' },
      { sequenceOrder: 4, status: 'PENDING' },
    ]
    const result = determineReturnStatus(4, returns, false)
    expect(result).toBe('PENDING')
  })
})
