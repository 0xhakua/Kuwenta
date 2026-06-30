import { describe, expect, it } from 'vitest'
import { ACTIVE_YEAR_QUERY, parseYearFromString, buildActiveYearCookieAttributes } from '../active-year'

describe('parseYearFromString', () => {
  it('parses a valid 4-digit year', () => {
    expect(parseYearFromString('2025')).toBe(2025)
    expect(parseYearFromString('1999')).toBe(1999)
    expect(parseYearFromString('2999')).toBe(2999)
  })

  it('returns null for null, empty, or whitespace input', () => {
    expect(parseYearFromString(null)).toBeNull()
    expect(parseYearFromString(undefined)).toBeNull()
    expect(parseYearFromString('')).toBeNull()
    expect(parseYearFromString('   ')).toBeNull()
  })

  it('returns null for non-4-digit input', () => {
    expect(parseYearFromString('25')).toBeNull()
    expect(parseYearFromString('20255')).toBeNull()
    expect(parseYearFromString('abcd')).toBeNull()
    expect(parseYearFromString('2025.0')).toBeNull()
  })

  it('returns null for out-of-range years', () => {
    expect(parseYearFromString('1899')).toBeNull()
    expect(parseYearFromString('3000')).toBeNull()
    expect(parseYearFromString('0001')).toBeNull()
  })
})

describe('buildActiveYearCookieAttributes', () => {
  it('always includes path, sameSite, and maxAge', () => {
    const attrs = buildActiveYearCookieAttributes(2025)
    expect(attrs).toContain('active_year=2025')
    expect(attrs).toContain('Path=/')
    expect(attrs).toContain('SameSite=Lax')
    expect(attrs).toContain('Max-Age=31536000')
  })
})

describe('ACTIVE_YEAR_QUERY', () => {
  it('is the canonical query string key', () => {
    expect(ACTIVE_YEAR_QUERY).toBe('year')
  })
})
