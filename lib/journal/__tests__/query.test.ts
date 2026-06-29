import { describe, expect, it } from 'vitest'
import {
  buildJournalListWhere,
  parseAccountNameFilter,
  parseQuarterFilter,
  parseSubsectionFilter,
} from '../query'

describe('parseSubsectionFilter', () => {
  it('returns null for null, undefined, and empty string', () => {
    expect(parseSubsectionFilter(null)).toBeNull()
    expect(parseSubsectionFilter(undefined)).toBeNull()
    expect(parseSubsectionFilter('')).toBeNull()
  })

  it('returns null for "ALL" (case-insensitive)', () => {
    expect(parseSubsectionFilter('all')).toBeNull()
    expect(parseSubsectionFilter('ALL')).toBeNull()
  })

  it('returns the upper-cased subsection for valid values', () => {
    expect(parseSubsectionFilter('9a')).toBe('9A')
    expect(parseSubsectionFilter('9F')).toBe('9F')
  })

  it('returns an error object for invalid subsections', () => {
    expect(parseSubsectionFilter('9Z')).toMatchObject({ error: expect.any(String) })
  })
})

describe('parseQuarterFilter', () => {
  it('returns null for null, undefined, empty, "ALL", or "ANNUAL"', () => {
    expect(parseQuarterFilter(null)).toBeNull()
    expect(parseQuarterFilter(undefined)).toBeNull()
    expect(parseQuarterFilter('')).toBeNull()
    expect(parseQuarterFilter('all')).toBeNull()
    expect(parseQuarterFilter('ANNUAL')).toBeNull()
  })

  it('returns the number for valid 1-4 inputs', () => {
    expect(parseQuarterFilter('1')).toBe(1)
    expect(parseQuarterFilter('4')).toBe(4)
    expect(parseQuarterFilter(2)).toBe(2)
  })

  it('returns an error object for out-of-range or non-numeric values', () => {
    expect(parseQuarterFilter('0')).toMatchObject({ error: expect.any(String) })
    expect(parseQuarterFilter('5')).toMatchObject({ error: expect.any(String) })
    expect(parseQuarterFilter('Q1')).toMatchObject({ error: expect.any(String) })
  })
})

describe('parseAccountNameFilter', () => {
  it('returns null for null, undefined, empty, and whitespace-only', () => {
    expect(parseAccountNameFilter(null)).toBeNull()
    expect(parseAccountNameFilter(undefined)).toBeNull()
    expect(parseAccountNameFilter('')).toBeNull()
    expect(parseAccountNameFilter('   ')).toBeNull()
  })

  it('returns the trimmed string when non-empty', () => {
    expect(parseAccountNameFilter('  CWT Receivable  ')).toBe('CWT Receivable')
  })
})

describe('buildJournalListWhere', () => {
  const taxYearId = 'ty-1'

  it('returns just the tax-year scope when no filters are set', () => {
    const { where, accountName, quarter, subsection } = buildJournalListWhere(taxYearId, {
      subsection: null,
      quarter: null,
      accountName: null,
    })
    expect(where).toEqual({ taxYearId })
    expect(accountName).toBeNull()
    expect(quarter).toBeNull()
    expect(subsection).toBeNull()
  })

  it('includes the subsection filter', () => {
    const { where } = buildJournalListWhere(taxYearId, {
      subsection: '9F',
      quarter: null,
      accountName: null,
    })
    expect(where).toEqual({ taxYearId, subsection: '9F' })
  })

  it('includes the quarter filter (quarter is set)', () => {
    const { where } = buildJournalListWhere(taxYearId, {
      subsection: null,
      quarter: 2,
      accountName: null,
    })
    expect(where).toEqual({ taxYearId, quarter: 2 })
  })

  it('uses case-insensitive contains for accountName', () => {
    const { where } = buildJournalListWhere(taxYearId, {
      subsection: null,
      quarter: null,
      accountName: 'cwt',
    })
    expect(where).toEqual({
      taxYearId,
      lines: { some: { accountName: { contains: 'cwt', mode: 'insensitive' } } },
    })
  })

  it('combines all three filters', () => {
    const { where } = buildJournalListWhere(taxYearId, {
      subsection: '9A',
      quarter: 1,
      accountName: 'Service Income',
    })
    expect(where).toEqual({
      taxYearId,
      subsection: '9A',
      quarter: 1,
      lines: {
        some: { accountName: { contains: 'Service Income', mode: 'insensitive' } },
      },
    })
  })
})
