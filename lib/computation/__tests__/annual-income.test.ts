import { describe, expect, it } from 'vitest'
import {
  computeAnnualIncomeTax,
  computeAnnualIncomeTaxBreakdown,
} from '../annual-income'
import { d } from './helpers'

describe('computeAnnualIncomeTax', () => {
  it('computes tax due above the 250k exemption', () => {
    // 600000 - 250000 = 350000; 8% = 28000
    const result = computeAnnualIncomeTax(d('600000'), d('0'), d('0'), d('0'))
    expect(result.taxDue.toString()).toBe('28000')
    expect(result.totalCredits.toString()).toBe('0')
    expect(result.netPosition.toString()).toBe('28000')
  })

  it('applies credits in sequence and leaves remaining tax due', () => {
    // taxDue 28000; credits 5000 + 10000 + 3000 = 18000; net 10000
    const result = computeAnnualIncomeTax(d('600000'), d('5000'), d('10000'), d('3000'))
    expect(result.taxDue.toString()).toBe('28000')
    expect(result.totalCredits.toString()).toBe('18000')
    expect(result.netPosition.toString()).toBe('10000')
  })

  it('results in overpayment when credits exceed tax due', () => {
    // taxDue 28000; credits 50000; net -22000
    const result = computeAnnualIncomeTax(d('600000'), d('20000'), d('20000'), d('10000'))
    expect(result.netPosition.toString()).toBe('-22000')
  })

  it('gives no exemption for mixed-income earners', () => {
    // 600000 * 8% = 48000
    const result = computeAnnualIncomeTax(d('600000'), d('0'), d('0'), d('0'), 'MIXED_INCOME')
    expect(result.taxDue.toString()).toBe('48000')
  })

  it('returns zero tax due when full-year gross is below exemption', () => {
    const result = computeAnnualIncomeTax(d('200000'), d('0'), d('0'), d('0'))
    expect(result.taxDue.toString()).toBe('0')
    expect(result.netPosition.toString()).toBe('0')
  })
})

describe('computeAnnualIncomeTaxBreakdown', () => {
  it('returns full breakdown with positive net position', () => {
    const result = computeAnnualIncomeTaxBreakdown(d('600000'), d('5000'), d('10000'), d('3000'))

    expect(result.fullYearGross.toString()).toBe('600000')
    expect(result.exemption.toString()).toBe('250000')
    expect(result.taxableIncome.toString()).toBe('350000')
    expect(result.taxDue.toString()).toBe('28000')
    expect(result.priorYearCredit.toString()).toBe('5000')
    expect(result.quarterlyPayments.toString()).toBe('10000')
    expect(result.cwtWithheld.toString()).toBe('3000')
    expect(result.totalCredits.toString()).toBe('18000')
    expect(result.netPosition.toString()).toBe('10000')
    expect(result.overpayment.toString()).toBe('0')
    expect(result.electedRate).toBe('RATE_8PCT')
  })

  it('captures overpayment when credits exceed tax due', () => {
    const result = computeAnnualIncomeTaxBreakdown(d('600000'), d('0'), d('0'), d('50000'))

    expect(result.taxDue.toString()).toBe('28000')
    expect(result.netPosition.toString()).toBe('-22000')
    expect(result.overpayment.toString()).toBe('22000')
  })

  it('uses zero exemption for mixed income and no overpayment', () => {
    const result = computeAnnualIncomeTaxBreakdown(
      d('600000'),
      d('0'),
      d('0'),
      d('0'),
      'MIXED_INCOME'
    )

    expect(result.exemption.toString()).toBe('0')
    expect(result.taxableIncome.toString()).toBe('600000')
    expect(result.taxDue.toString()).toBe('48000')
    expect(result.netPosition.toString()).toBe('48000')
    expect(result.overpayment.toString()).toBe('0')
  })

  it('echoes the elected rate', () => {
    expect(
      computeAnnualIncomeTaxBreakdown(d('600000'), d('0'), d('0'), d('0'), 'PURE_SELF_EMPLOYMENT', 'GRADUATED')
        .electedRate
    ).toBe('GRADUATED')
  })
})

describe('computeAnnualIncomeTax under GRADUATED election', () => {
  it('returns 0 for full-year gross within the 250k 0% bracket', () => {
    const result = computeAnnualIncomeTax(d('200000'), d('0'), d('0'), d('0'), 'PURE_SELF_EMPLOYMENT', 'GRADUATED')
    expect(result.taxDue.toString()).toBe('0')
    expect(result.netPosition.toString()).toBe('0')
  })

  it('applies the 25% bracket with 30k base (gross 800k -> taxable 550k -> 67,500)', () => {
    // taxable = 800000 - 250000 = 550000; in [400k, 800k] base 30k
    // 30000 + (550000 - 400000) * 0.25 = 30,000 + 37,500 = 67,500
    const result = computeAnnualIncomeTax(d('800000'), d('0'), d('0'), d('0'), 'PURE_SELF_EMPLOYMENT', 'GRADUATED')
    expect(result.taxDue.toString()).toBe('67500')
    expect(result.netPosition.toString()).toBe('67500')
  })

  it('applies the 32% bracket with 490k base (gross 5M -> taxable 4.75M -> 1,530,000)', () => {
    // taxable = 5000000 - 250000 = 4750000; in [2M, 8M] base 490k
    // 490000 + (4750000 - 2000000) * 0.32 = 490,000 + 880,000 = 1,370,000
    const result = computeAnnualIncomeTax(
      d('5000000'),
      d('0'),
      d('0'),
      d('0'),
      'PURE_SELF_EMPLOYMENT',
      'GRADUATED'
    )
    expect(result.taxDue.toString()).toBe('1370000')
    expect(result.netPosition.toString()).toBe('1370000')
  })

  it('applies credits in BIR-prescribed order under graduated (gross 800k, CWT 30k -> 37,500)', () => {
    const result = computeAnnualIncomeTax(
      d('800000'),
      d('0'),
      d('0'),
      d('30000'),
      'PURE_SELF_EMPLOYMENT',
      'GRADUATED'
    )
    // taxDue 67,500; totalCredits 30,000; net 37,500
    expect(result.taxDue.toString()).toBe('67500')
    expect(result.totalCredits.toString()).toBe('30000')
    expect(result.netPosition.toString()).toBe('37500')
  })

  it('yields overpayment when credits exceed tax due (gross 600k, prior 200k + CWT 100k)', () => {
    // taxable = 350000; in [250k, 400k] base 0
    // taxDue = 0 + (350000 - 250000) * 0.20 = 20,000
    // credits = 200000 + 0 + 100000 = 300,000
    // net = 20000 - 300000 = -280,000 (overpayment)
    const result = computeAnnualIncomeTax(
      d('600000'),
      d('200000'),
      d('0'),
      d('100000'),
      'PURE_SELF_EMPLOYMENT',
      'GRADUATED'
    )
    expect(result.taxDue.toString()).toBe('20000')
    expect(result.totalCredits.toString()).toBe('300000')
    expect(result.netPosition.toString()).toBe('-280000')
  })

  it('gives no exemption for mixed-income earners (gross 500k -> 55,000)', () => {
    // taxable = 500000 (no exemption); in [400k, 800k] base 30k
    // 30000 + (500000 - 400000) * 0.25 = 55,000
    const result = computeAnnualIncomeTax(d('500000'), d('0'), d('0'), d('0'), 'MIXED_INCOME', 'GRADUATED')
    expect(result.taxDue.toString()).toBe('55000')
  })

  it('breakdown captures overpayment under graduated', () => {
    // gross 600k, CWT 50k -> taxable 350k -> taxDue 20,000; net = -30,000
    const result = computeAnnualIncomeTaxBreakdown(
      d('600000'),
      d('0'),
      d('0'),
      d('50000'),
      'PURE_SELF_EMPLOYMENT',
      'GRADUATED'
    )
    expect(result.taxDue.toString()).toBe('20000')
    expect(result.netPosition.toString()).toBe('-30000')
    expect(result.overpayment.toString()).toBe('30000')
    expect(result.electedRate).toBe('GRADUATED')
  })
})

describe('computeAnnualIncomeTax under OSD + GRADUATED', () => {
  // OSD reference case: gross 2,000,000, no other inputs.
  // OSD deduction 40% of gross = 800,000; taxable base = 800,000.
  // TRAIN brackets on 800,000:
  //   250,000 @ 0%   =       0
  //   150,000 @ 20%  =  30,000  (250k-400k)
  //   400,000 @ 25%  = 100,000  (400k-800k)
  //                  = 130,000
  it('OSD reference case: gross 2M -> tax due 130,000', () => {
    const result = computeAnnualIncomeTax(
      d('2000000'),
      d('0'),
      d('0'),
      d('0'),
      'PURE_SELF_EMPLOYMENT',
      'GRADUATED',
      true
    )
    expect(result.taxDue.toString()).toBe('130000')
    expect(result.netPosition.toString()).toBe('130000')
  })

  it('OSD applies the 40% deduction before brackets (gross 1M -> 30,000)', () => {
    // taxable = 1,000,000 * 0.40 = 400,000
    // applyGraduatedBrackets(400,000) = 0 + (400,000 - 250,000) * 0.20 = 30,000
    const result = computeAnnualIncomeTax(
      d('1000000'),
      d('0'),
      d('0'),
      d('0'),
      'PURE_SELF_EMPLOYMENT',
      'GRADUATED',
      true
    )
    expect(result.taxDue.toString()).toBe('30000')
  })

  it('OSD replaces the 250k exemption for pure self-employment (no double-deduction)', () => {
    const result = computeAnnualIncomeTaxBreakdown(
      d('2000000'),
      d('0'),
      d('0'),
      d('0'),
      'PURE_SELF_EMPLOYMENT',
      'GRADUATED',
      true
    )
    // Exemption must be 0 under OSD even though incomeType is pure self-employment
    expect(result.exemption.toString()).toBe('0')
    // Taxable = 2M * 0.40 = 800,000
    expect(result.taxableIncome.toString()).toBe('800000')
    expect(result.taxDue.toString()).toBe('130000')
    expect(result.osdElection).toBe(true)
  })

  it('OSD works for mixed-income earners (no exemption either way)', () => {
    // gross 1M, OSD, mixed -> taxable = 1M * 0.40 = 400,000
    // tax = applyGraduatedBrackets(400,000) = 30,000
    const result = computeAnnualIncomeTax(
      d('1000000'),
      d('0'),
      d('0'),
      d('0'),
      'MIXED_INCOME',
      'GRADUATED',
      true
    )
    expect(result.taxDue.toString()).toBe('30000')
  })

  it('OSD applies credits in BIR-prescribed order', () => {
    // gross 2M, OSD, CWT 50,000
    // taxDue 130,000; credits 50,000; net 80,000
    const result = computeAnnualIncomeTax(
      d('2000000'),
      d('0'),
      d('0'),
      d('50000'),
      'PURE_SELF_EMPLOYMENT',
      'GRADUATED',
      true
    )
    expect(result.taxDue.toString()).toBe('130000')
    expect(result.totalCredits.toString()).toBe('50000')
    expect(result.netPosition.toString()).toBe('80000')
  })

  it('OSD yields overpayment when credits exceed tax due', () => {
    // gross 1M, OSD, CWT 100,000
    // taxDue 30,000; credits 100,000; net -70,000
    const result = computeAnnualIncomeTax(
      d('1000000'),
      d('0'),
      d('0'),
      d('100000'),
      'PURE_SELF_EMPLOYMENT',
      'GRADUATED',
      true
    )
    expect(result.taxDue.toString()).toBe('30000')
    expect(result.netPosition.toString()).toBe('-70000')
  })

  it('throws when OSD is combined with the 8% flat rate (NIRC Sec 24(A)(2))', () => {
    expect(() =>
      computeAnnualIncomeTax(
        d('1000000'),
        d('0'),
        d('0'),
        d('0'),
        'PURE_SELF_EMPLOYMENT',
        'RATE_8PCT',
        true
      )
    ).toThrow(/OSD is not valid for 8% flat-rate electees/)
  })

  it('osdElection=false preserves the existing 8% behaviour (no exemption in mixed income)', () => {
    const result = computeAnnualIncomeTax(
      d('600000'),
      d('0'),
      d('0'),
      d('0'),
      'MIXED_INCOME',
      'RATE_8PCT',
      false
    )
    // 600000 * 0.08 = 48,000
    expect(result.taxDue.toString()).toBe('48000')
  })
})
