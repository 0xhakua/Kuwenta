import { describe, expect, it } from 'vitest'
import {
  adjustForHoliday,
  getDueDatesForYear,
  getStatutoryDueDate,
} from '../due-dates'

describe('adjustForHoliday', () => {
  it('returns the same date when it is a weekday and not a holiday', () => {
    const date = new Date(2026, 3, 15) // Wed Apr 15
    const adjusted = adjustForHoliday(date, [])
    expect(adjusted.toDateString()).toBe('Wed Apr 15 2026')
  })

  it('rolls Saturday forward to Monday', () => {
    const date = new Date(2026, 3, 25) // Sat Apr 25
    const adjusted = adjustForHoliday(date, [])
    expect(adjusted.toDateString()).toBe('Mon Apr 27 2026')
  })

  it('rolls Sunday forward to Monday', () => {
    const date = new Date(2026, 3, 26) // Sun Apr 26
    const adjusted = adjustForHoliday(date, [])
    expect(adjusted.toDateString()).toBe('Mon Apr 27 2026')
  })

  it('rolls a single holiday forward one business day', () => {
    const date = new Date(2026, 3, 15) // Wed
    const holiday = new Date(2026, 3, 15)
    const adjusted = adjustForHoliday(date, [holiday])
    expect(adjusted.toDateString()).toBe('Thu Apr 16 2026')
  })

  it('rolls through consecutive holidays', () => {
    const date = new Date(2026, 3, 15) // Wed
    const adjusted = adjustForHoliday(date, [
      new Date(2026, 3, 15),
      new Date(2026, 3, 16),
    ])
    expect(adjusted.toDateString()).toBe('Fri Apr 17 2026')
  })

  it('rolls through a holiday that falls on a weekend to the next weekday', () => {
    // Sat Apr 25 is a holiday -> rolls to Mon Apr 27
    const date = new Date(2026, 3, 25)
    const adjusted = adjustForHoliday(date, [new Date(2026, 3, 25)])
    expect(adjusted.toDateString()).toBe('Mon Apr 27 2026')
  })

  it('ignores holidays in other months or years', () => {
    const date = new Date(2026, 3, 15)
    const adjusted = adjustForHoliday(date, [
      new Date(2025, 3, 15),
      new Date(2026, 4, 15),
    ])
    expect(adjusted.toDateString()).toBe('Wed Apr 15 2026')
  })
})

describe('getStatutoryDueDate', () => {
  it('returns the correct statutory due dates for the 8-return path', () => {
    expect(getStatutoryDueDate('FORM_2551Q', 1, 2026).toDateString()).toBe('Sat Apr 25 2026')
    expect(getStatutoryDueDate('FORM_2551Q', 2, 2026).toDateString()).toBe('Sat Jul 25 2026')
    expect(getStatutoryDueDate('FORM_2551Q', 3, 2026).toDateString()).toBe('Sun Oct 25 2026')
    expect(getStatutoryDueDate('FORM_2551Q', 4, 2026).toDateString()).toBe('Mon Jan 25 2027')
    expect(getStatutoryDueDate('FORM_1701Q', 1, 2026).toDateString()).toBe('Fri May 15 2026')
    expect(getStatutoryDueDate('FORM_1701Q', 2, 2026).toDateString()).toBe('Sat Aug 15 2026')
    expect(getStatutoryDueDate('FORM_1701Q', 3, 2026).toDateString()).toBe('Sun Nov 15 2026')
    expect(getStatutoryDueDate('FORM_1701A', null, 2026).toDateString()).toBe('Thu Apr 15 2027')
  })

  it('throws for an unknown form type/quarter combination', () => {
    expect(() => getStatutoryDueDate('FORM_UNKNOWN', 1, 2026)).toThrow('Unknown due date key')
  })
})

describe('getDueDatesForYear', () => {
  it('returns 8 returns when COR includes 2551Q', () => {
    const calendar = getDueDatesForYear(2026, true, [])
    expect(calendar).toHaveLength(8)
    expect(calendar[0]).toMatchObject({ formType: 'FORM_2551Q', quarter: 1 })
    expect(calendar[7]).toMatchObject({ formType: 'FORM_1701A', quarter: null })
  })

  it('returns 4 returns when COR does not include 2551Q', () => {
    const calendar = getDueDatesForYear(2026, false, [])
    expect(calendar).toHaveLength(4)
    expect(calendar[0]).toMatchObject({ formType: 'FORM_1701Q', quarter: 1 })
    expect(calendar[3]).toMatchObject({ formType: 'FORM_1701A', quarter: null })
  })

  it('applies holiday rolling to every statutory due date', () => {
    const calendar = getDueDatesForYear(2026, true, [])
    for (const entry of calendar) {
      const day = entry.adjustedDueDate.getDay()
      expect(day).not.toBe(0)
      expect(day).not.toBe(6)
    }
  })

  it('uses the provided holiday list when rolling dates', () => {
    // 1701A for 2026 is due Apr 15 2027 (Thursday). Make that date a holiday -> rolls to Apr 16 2027.
    const calendar = getDueDatesForYear(2026, false, [new Date(2027, 3, 15)])
    const annual = calendar.find((c) => c.formType === 'FORM_1701A')
    expect(annual?.statutoryDueDate.toDateString()).toBe('Thu Apr 15 2027')
    expect(annual?.adjustedDueDate.toDateString()).toBe('Fri Apr 16 2027')
  })
})
