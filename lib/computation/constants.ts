import Decimal from 'decimal.js'

// RA 11976 (Ease of Paying Taxes Act) — effective Jan 22, 2024
// All Kuwenta users earn < ₱3,000,000 so ALL qualify for reduced rates
// RR No. 6-2024 (effective Apr 27, 2024); RR No. 8-2024
export const SURCHARGE_RATE = new Decimal('0.10') // was 0.25 before RA 11976
export const INTEREST_RATE = new Decimal('0.06') // was 0.12 before RA 11976
export const EXEMPTION_250K = new Decimal('250000')
export const VAT_THRESHOLD = new Decimal('3000000')
export const EIGHT_PCT_RATE = new Decimal('0.08')

/**
 * The two elected tax rates. Mirrors the Prisma `TaxRate` enum so that the
 * same string literals are used end-to-end. Use this in computation
 * signatures; use the `string | null` form only at the data-layer boundary
 * where an election may not yet have been recorded.
 */
export type TaxRateValue = 'RATE_8PCT' | 'GRADUATED'

/**
 * TRAIN Law (RA 10963) graduated income tax brackets.
 *
 * Legal basis: NIRC Sec 24(A)(2)(a)-(f) as amended by RA 10963, effective
 * January 1, 2018. Applies to self-employed individuals and professionals
 * who do not elect the 8% flat rate.
 *
 * Each bracket is `lowerBound < taxableIncome <= upperBound` (top bracket is
 * open-ended). `base` is the cumulative tax owed at `lowerBound` and is
 * included for verification against the TRAIN schedule and for use by
 * `applyGraduatedBrackets` so the call site never has to sum a long
 * prefix of brackets manually.
 */
export interface TaxBracket {
  lowerBound: Decimal
  upperBound: Decimal | null
  rate: Decimal
  base: Decimal
}

export const TRAIN_BRACKETS: readonly TaxBracket[] = [
  { lowerBound: new Decimal('0'), upperBound: new Decimal('250000'), rate: new Decimal('0'), base: new Decimal('0') },
  { lowerBound: new Decimal('250000'), upperBound: new Decimal('400000'), rate: new Decimal('0.20'), base: new Decimal('0') },
  { lowerBound: new Decimal('400000'), upperBound: new Decimal('800000'), rate: new Decimal('0.25'), base: new Decimal('30000') },
  { lowerBound: new Decimal('800000'), upperBound: new Decimal('2000000'), rate: new Decimal('0.30'), base: new Decimal('130000') },
  { lowerBound: new Decimal('2000000'), upperBound: new Decimal('8000000'), rate: new Decimal('0.32'), base: new Decimal('490000') },
  { lowerBound: new Decimal('8000000'), upperBound: null, rate: new Decimal('0.35'), base: new Decimal('2410000') },
] as const

/**
 * Apply the TRAIN graduated brackets to a positive taxable income.
 *
 * Returns 0 for taxable income at or below the 0% bracket. Negative inputs
 * are clamped to 0 (callers must already have applied the 250k exemption or
 * OSD reduction before reaching this function).
 */
export function applyGraduatedBrackets(taxableIncome: Decimal): Decimal {
  const income = Decimal.max(taxableIncome, new Decimal('0'))
  for (const bracket of TRAIN_BRACKETS) {
    if (bracket.upperBound === null) {
      return bracket.base.plus(income.minus(bracket.lowerBound).times(bracket.rate))
    }
    if (income.lessThanOrEqualTo(bracket.upperBound)) {
      return bracket.base.plus(income.minus(bracket.lowerBound).times(bracket.rate))
    }
  }
  // Unreachable: top bracket has upperBound === null
  return new Decimal('0')
}

// Standard path (COR includes 2551Q) — 8 returns
export const SEQUENCE_DEPENDENCIES_8: Record<number, number[]> = {
  1: [], // 2551Q Q1 — election on Item 13; no dependencies
  2: [1], // 2551Q Q2
  3: [1, 2], // 2551Q Q3
  4: [1, 2, 3], // 2551Q Q4
  5: [1], // 1701Q Q1 — needs Q1 2551Q
  6: [1, 5], // 1701Q Q2
  7: [1, 5, 6], // 1701Q Q3
  8: [1, 5, 6, 7], // 1701A
}

// Reduced path (COR does NOT include 2551Q) — 4 returns
// Election made on Item 16 of Q1 1701Q instead of Item 13 of Q1 2551Q
// Legal basis: RMO No. 23-2018 Sec. C.2.1; RR No. 8-2018 Sec. 3
export const SEQUENCE_DEPENDENCIES_4: Record<number, number[]> = {
  1: [], // 1701Q Q1 — election on Item 16
  2: [1], // 1701Q Q2
  3: [1, 2], // 1701Q Q3
  4: [1, 2, 3], // 1701A
}

export type IncomeTypeValue = 'PURE_SELF_EMPLOYMENT' | 'MIXED_INCOME'
export type FormTypeValue = 'FORM_2551Q' | 'FORM_1701Q' | 'FORM_1701A' | 'FORM_1701'
export type SequenceReturn = {
  sequenceOrder: number
  formType: FormTypeValue
  quarter: number | null
  label: string
  period: string
  deadline: string
}

// Statutory due dates before holiday rolling.
// Keys use the full FormType enum values used elsewhere in the app.
export const STATUTORY_DUE_DATES: Record<string, (year: number) => Date> = {
  'FORM_2551Q-Q1': (y) => new Date(y, 3, 25), // April 25
  'FORM_2551Q-Q2': (y) => new Date(y, 6, 25), // July 25
  'FORM_2551Q-Q3': (y) => new Date(y, 9, 25), // October 25
  'FORM_2551Q-Q4': (y) => new Date(y + 1, 0, 25), // January 25 next year
  'FORM_1701Q-Q1': (y) => new Date(y, 4, 15), // May 15
  'FORM_1701Q-Q2': (y) => new Date(y, 7, 15), // August 15
  'FORM_1701Q-Q3': (y) => new Date(y, 10, 15), // November 15
  'FORM_1701A': (y) => new Date(y + 1, 3, 15), // April 15 next year
  'FORM_1701': (y) => new Date(y + 1, 3, 15), // April 15 next year (mixed-income annual)
}

export function getSequence(
  corIncludes2551Q: boolean,
  incomeType: IncomeTypeValue = 'PURE_SELF_EMPLOYMENT'
): SequenceReturn[] {
  const annualForm: FormTypeValue = incomeType === 'MIXED_INCOME' ? 'FORM_1701' : 'FORM_1701A'
  const annualLabel = incomeType === 'MIXED_INCOME' ? '1701 Annual' : '1701A Annual'

  if (corIncludes2551Q) {
    return [
      {
        sequenceOrder: 1,
        formType: 'FORM_2551Q',
        quarter: 1,
        label: '2551Q Q1',
        period: 'Jan–Mar',
        deadline: 'April 25',
      },
      {
        sequenceOrder: 2,
        formType: 'FORM_2551Q',
        quarter: 2,
        label: '2551Q Q2',
        period: 'Apr–Jun',
        deadline: 'July 25',
      },
      {
        sequenceOrder: 3,
        formType: 'FORM_2551Q',
        quarter: 3,
        label: '2551Q Q3',
        period: 'Jul–Sep',
        deadline: 'October 25',
      },
      {
        sequenceOrder: 4,
        formType: 'FORM_2551Q',
        quarter: 4,
        label: '2551Q Q4',
        period: 'Oct–Dec',
        deadline: 'January 25 (next yr)',
      },
      {
        sequenceOrder: 5,
        formType: 'FORM_1701Q',
        quarter: 1,
        label: '1701Q Q1',
        period: 'Jan–Mar cumulative',
        deadline: 'May 15',
      },
      {
        sequenceOrder: 6,
        formType: 'FORM_1701Q',
        quarter: 2,
        label: '1701Q Q2',
        period: 'Jan–Jun cumulative',
        deadline: 'August 15',
      },
      {
        sequenceOrder: 7,
        formType: 'FORM_1701Q',
        quarter: 3,
        label: '1701Q Q3',
        period: 'Jul–Sep cumulative',
        deadline: 'November 15',
      },
      {
        sequenceOrder: 8,
        formType: annualForm,
        quarter: null,
        label: annualLabel,
        period: 'Full Year',
        deadline: 'April 15 (next yr)',
      },
    ]
  }

  return [
    {
      sequenceOrder: 1,
      formType: 'FORM_1701Q',
      quarter: 1,
      label: '1701Q Q1',
      period: 'Jan–Mar cumulative',
      deadline: 'May 15',
    },
    {
      sequenceOrder: 2,
      formType: 'FORM_1701Q',
      quarter: 2,
      label: '1701Q Q2',
      period: 'Jan–Jun cumulative',
      deadline: 'August 15',
    },
    {
      sequenceOrder: 3,
      formType: 'FORM_1701Q',
      quarter: 3,
      label: '1701Q Q3',
      period: 'Jul–Sep cumulative',
      deadline: 'November 15',
    },
    {
      sequenceOrder: 4,
      formType: annualForm,
      quarter: null,
      label: annualLabel,
      period: 'Full Year',
      deadline: 'April 15 (next yr)',
    },
  ]
}
