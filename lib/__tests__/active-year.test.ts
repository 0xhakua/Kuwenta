import { describe, expect, it, vi } from 'vitest'

const cookieStore = new Map<string, string>()
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => {
      const value = cookieStore.get(name)
      return value != null ? { name, value } : undefined
    },
    set: (opts: { name: string; value: string }) => {
      cookieStore.set(opts.name, opts.value)
    },
  }),
}))

import {
  ACTIVE_YEAR_QUERY,
  parseYearFromString,
  buildActiveYearCookieAttributes,
  resolveTaxYearFromRequest,
} from '../active-year'

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

describe('resolveTaxYearFromRequest', () => {
  const taxYears = [
    { year: 2026, label: 'y2026' },
    { year: 2025, label: 'y2025' },
    { year: 2024, label: 'y2024' },
  ]

  it('returns null when taxYears is empty', async () => {
    const result = await resolveTaxYearFromRequest(new Request('https://x.test/api'), [])
    expect(result).toBeNull()
  })

  it('honors ?year= query param when it matches an available year', async () => {
    const req = new Request('https://x.test/api?year=2025')
    const result = await resolveTaxYearFromRequest(req, taxYears)
    expect(result).toEqual({ year: 2025, label: 'y2025' })
  })

  it('rejects ?year= values that are not in the available years', async () => {
    const req = new Request('https://x.test/api?year=1999')
    const result = await resolveTaxYearFromRequest(req, taxYears)
    expect(result).toEqual({ year: 2026, label: 'y2026' })
  })

  it('falls back to the cookie when no query param is present', async () => {
    cookieStore.set('active_year', '2024')
    const req = new Request('https://x.test/api')
    const result = await resolveTaxYearFromRequest(req, taxYears)
    expect(result).toEqual({ year: 2024, label: 'y2024' })
    cookieStore.delete('active_year')
  })

  it('falls back to the first (latest) tax year when no signal is set', async () => {
    cookieStore.delete('active_year')
    const req = new Request('https://x.test/api')
    const result = await resolveTaxYearFromRequest(req, taxYears)
    expect(result).toEqual({ year: 2026, label: 'y2026' })
  })

  it('prefers ?year= over the cookie', async () => {
    cookieStore.set('active_year', '2024')
    const req = new Request('https://x.test/api?year=2025')
    const result = await resolveTaxYearFromRequest(req, taxYears)
    expect(result).toEqual({ year: 2025, label: 'y2025' })
    cookieStore.delete('active_year')
  })
})
