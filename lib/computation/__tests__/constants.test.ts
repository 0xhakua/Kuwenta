import { describe, expect, it } from 'vitest'
import Decimal from 'decimal.js'
import { TRAIN_BRACKETS, applyGraduatedBrackets } from '../constants'

describe('TRAIN_BRACKETS', () => {
  it('declares the six brackets from NIRC Sec 24(A) as amended by TRAIN', () => {
    expect(TRAIN_BRACKETS).toHaveLength(6)
  })

  it('uses the official lower bounds, upper bounds, and rates', () => {
    const [b0, b1, b2, b3, b4, b5] = TRAIN_BRACKETS
    expect(b0.lowerBound.toString()).toBe('0')
    expect(b0.upperBound?.toString()).toBe('250000')
    expect(b0.rate.equals(new Decimal('0'))).toBe(true)

    expect(b1.lowerBound.toString()).toBe('250000')
    expect(b1.upperBound?.toString()).toBe('400000')
    expect(b1.rate.equals(new Decimal('0.20'))).toBe(true)

    expect(b2.lowerBound.toString()).toBe('400000')
    expect(b2.upperBound?.toString()).toBe('800000')
    expect(b2.rate.equals(new Decimal('0.25'))).toBe(true)

    expect(b3.lowerBound.toString()).toBe('800000')
    expect(b3.upperBound?.toString()).toBe('2000000')
    expect(b3.rate.equals(new Decimal('0.30'))).toBe(true)

    expect(b4.lowerBound.toString()).toBe('2000000')
    expect(b4.upperBound?.toString()).toBe('8000000')
    expect(b4.rate.equals(new Decimal('0.32'))).toBe(true)

    expect(b5.lowerBound.toString()).toBe('8000000')
    expect(b5.upperBound).toBeNull()
    expect(b5.rate.equals(new Decimal('0.35'))).toBe(true)
  })

  it('records the cumulative tax base for each bracket', () => {
    // Per TRAIN schedule: 0, 0, 30,000, 130,000, 490,000, 2,410,000
    const expected = ['0', '0', '30000', '130000', '490000', '2410000']
    TRAIN_BRACKETS.forEach((b, i) => {
      expect(b.base.toString()).toBe(expected[i])
    })
  })

  it('preserves the off-by-one semantics: 250000 lands in the 0% bracket', () => {
    // The first bracket is [0, 250000] (inclusive) at 0%, not strictly less.
    // 250001 should be the first peso that attracts the 20% rate.
    const lowerEdge = new Decimal('250000')
    const justAbove = new Decimal('250001')

    const atEdge = applyGraduatedBrackets(lowerEdge)
    const atJustAbove = applyGraduatedBrackets(justAbove)

    expect(atEdge.toString()).toBe('0')
    expect(atJustAbove.equals(new Decimal('0.2'))).toBe(true)
  })
})

describe('applyGraduatedBrackets', () => {
  it('returns 0 for income within the 250k 0% bracket', () => {
    expect(applyGraduatedBrackets(new Decimal('0')).toString()).toBe('0')
    expect(applyGraduatedBrackets(new Decimal('150000')).toString()).toBe('0')
    expect(applyGraduatedBrackets(new Decimal('250000')).toString()).toBe('0')
  })

  it('computes 20% on the amount over 250k (e.g. 300k -> 10,000)', () => {
    // (300000 - 250000) * 0.20 = 10,000
    expect(applyGraduatedBrackets(new Decimal('300000')).toString()).toBe('10000')
  })

  it('uses 25% with 30k base in the third bracket (e.g. 500k -> 60,000)', () => {
    // 30000 + (500000 - 400000) * 0.25 = 30,000 + 25,000 = 55,000
    expect(applyGraduatedBrackets(new Decimal('500000')).toString()).toBe('55000')
  })

  it('uses 30% with 130k base in the fourth bracket (e.g. 1,000,000 -> 190,000)', () => {
    // 130000 + (1000000 - 800000) * 0.30 = 130,000 + 60,000 = 190,000
    expect(applyGraduatedBrackets(new Decimal('1000000')).toString()).toBe('190000')
  })

  it('uses 32% with 490k base in the fifth bracket (e.g. 5,000,000 -> 1,490,000)', () => {
    // 490000 + (5000000 - 2000000) * 0.32 = 490,000 + 960,000 = 1,450,000
    expect(applyGraduatedBrackets(new Decimal('5000000')).toString()).toBe('1450000')
  })

  it('uses 35% with 2.41M base in the top open bracket (e.g. 10,000,000 -> 3,760,000)', () => {
    // 2410000 + (10000000 - 8000000) * 0.35 = 2,410,000 + 700,000 = 3,110,000
    expect(applyGraduatedBrackets(new Decimal('10000000')).toString()).toBe('3110000')
  })

  it('clamps negative inputs to 0', () => {
    expect(applyGraduatedBrackets(new Decimal('-5000')).toString()).toBe('0')
  })
})
