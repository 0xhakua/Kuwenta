import Decimal from 'decimal.js'

/**
 * Sprint-6 reference figures for the graduated and OSD code paths.
 *
 * The same table is published in AGENT.md ("Reference Figures for Testing")
 * and exercised by `scripts/verify-computations.ts`. Keep this file in
 * sync with those two sources — the test cases in this directory, the
 * AGENT.md documentation table, and the verify-computations script all
 * derive from the values below.
 *
 * Legal basis: NIRC Sec 24(A) as amended by TRAIN Law (RA 10963);
 * NIRC Sec 24(A)(2) for the 40% OSD.
 */
export const GRADUATED_REFERENCE = {
  /** Gross 200,000 — sits in the 0% bracket; expected tax due 0. */
  low: {
    gross: new Decimal('200000'),
    incomeType: 'PURE_SELF_EMPLOYMENT' as const,
    expectedTaxDue: new Decimal('0.00'),
  },
  /** Gross 600,000 — taxable 350,000 in the 20% bracket; expected tax due 20,000. */
  mid: {
    gross: new Decimal('600000'),
    incomeType: 'PURE_SELF_EMPLOYMENT' as const,
    expectedTaxDue: new Decimal('20000.00'),
  },
  /** Gross 1,500,000 — taxable 1,250,000 spanning the 25% and 30% brackets; expected tax due 265,000. */
  high: {
    gross: new Decimal('1500000'),
    incomeType: 'PURE_SELF_EMPLOYMENT' as const,
    expectedTaxDue: new Decimal('265000.00'),
  },
  /** Gross 500,000 mixed income — no exemption (BR-13), in the 25% bracket; expected tax due 55,000. */
  mixedMid: {
    gross: new Decimal('500000'),
    incomeType: 'MIXED_INCOME' as const,
    expectedTaxDue: new Decimal('55000.00'),
  },
}

export const OSD_REFERENCE = {
  /**
   * Gross 2,000,000, OSD elected (40%), graduated.
   * OSD deduction = 800,000; taxable = 800,000; expected tax due 130,000.
   */
  high: {
    gross: new Decimal('2000000'),
    incomeType: 'PURE_SELF_EMPLOYMENT' as const,
    osdElection: true,
    expectedTaxDue: new Decimal('130000.00'),
  },
}
