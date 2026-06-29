import Decimal from 'decimal.js'

// RA 11976 (Ease of Paying Taxes Act) — effective Jan 22, 2024
// All Kuwenta users earn < ₱3,000,000 so ALL qualify for reduced rates
// RR No. 6-2024 (effective Apr 27, 2024); RR No. 8-2024
export const SURCHARGE_RATE = new Decimal('0.10') // was 0.25 before RA 11976
export const INTEREST_RATE = new Decimal('0.06') // was 0.12 before RA 11976
export const EXEMPTION_250K = new Decimal('250000')
export const VAT_THRESHOLD = new Decimal('3000000')
export const EIGHT_PCT_RATE = new Decimal('0.08')

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
