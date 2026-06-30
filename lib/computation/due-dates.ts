import { STATUTORY_DUE_DATES, type FormTypeValue, type IncomeTypeValue } from './constants'

/**
 * Roll a due date forward to the next business day if it falls on a weekend
 * or a public holiday.
 */
export function adjustForHoliday(date: Date, holidays: Date[]): Date {
  const holidaySet = new Set(holidays.map((d) => normalizeDate(d)))
  let adjusted = new Date(date)

  while (isWeekend(adjusted) || holidaySet.has(normalizeDate(adjusted))) {
    adjusted = addDays(adjusted, 1)
  }

  return adjusted
}

function isWeekend(date: Date): boolean {
  const day = date.getDay()
  return day === 0 || day === 6
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

function normalizeDate(date: Date): string {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).toISOString().split('T')[0]
}

/**
 * Build a full Date for the statutory due date of a given return.
 * Does NOT apply holiday rolling — use adjustForHoliday() afterwards.
 */
export function getStatutoryDueDate(formType: string, quarter: number | null, year: number): Date {
  const key = quarter == null ? formType : `${formType}-Q${quarter}`
  const fn = STATUTORY_DUE_DATES[key]
  if (!fn) {
    throw new Error(`Unknown due date key: ${key}`)
  }
  return fn(year)
}

/**
 * Return the calendar of returns for a tax year, with holiday-rolled due dates.
 */
export function getDueDatesForYear(
  year: number,
  corIncludes2551Q: boolean,
  holidays: Date[],
  incomeType: IncomeTypeValue = 'PURE_SELF_EMPLOYMENT'
): Array<{
  formType: FormTypeValue
  quarter: number | null
  statutoryDueDate: Date
  adjustedDueDate: Date
}> {
  const annualForm: FormTypeValue = incomeType === 'MIXED_INCOME' ? 'FORM_1701' : 'FORM_1701A'
  const returns: Array<{
    formType: FormTypeValue
    quarter: number | null
  }> = corIncludes2551Q
    ? [
        { formType: 'FORM_2551Q', quarter: 1 },
        { formType: 'FORM_2551Q', quarter: 2 },
        { formType: 'FORM_2551Q', quarter: 3 },
        { formType: 'FORM_2551Q', quarter: 4 },
        { formType: 'FORM_1701Q', quarter: 1 },
        { formType: 'FORM_1701Q', quarter: 2 },
        { formType: 'FORM_1701Q', quarter: 3 },
        { formType: annualForm, quarter: null },
      ]
    : [
        { formType: 'FORM_1701Q', quarter: 1 },
        { formType: 'FORM_1701Q', quarter: 2 },
        { formType: 'FORM_1701Q', quarter: 3 },
        { formType: annualForm, quarter: null },
      ]

  return returns.map((r) => {
    const statutory = getStatutoryDueDate(r.formType, r.quarter, year)
    return {
      ...r,
      statutoryDueDate: statutory,
      adjustedDueDate: adjustForHoliday(statutory, holidays),
    }
  })
}
