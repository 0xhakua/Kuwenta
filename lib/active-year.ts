import { cookies } from 'next/headers'

export const ACTIVE_YEAR_COOKIE = 'active_year'
export const ACTIVE_YEAR_QUERY = 'year'
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365

function parseYear(raw: string | null | undefined): number | null {
  if (!raw) return null
  const trimmed = raw.trim()
  if (!/^\d{4}$/.test(trimmed)) return null
  const year = Number.parseInt(trimmed, 10)
  if (!Number.isFinite(year) || year < 1900 || year > 2999) return null
  return year
}

export function parseYearFromString(raw: string | null | undefined): number | null {
  return parseYear(raw)
}

export async function getActiveYearFromCookie(): Promise<number | null> {
  const store = await cookies()
  const value = store.get(ACTIVE_YEAR_COOKIE)?.value
  return parseYear(value)
}

export async function getActiveYearFromRequest(
  request: Request,
  availableYears?: number[]
): Promise<number | null> {
  const url = new URL(request.url)
  const queryYear = parseYear(url.searchParams.get(ACTIVE_YEAR_QUERY))
  if (queryYear != null) {
    if (!availableYears || availableYears.length === 0) return queryYear
    return availableYears.includes(queryYear) ? queryYear : null
  }
  return getActiveYearFromCookie()
}

export async function setActiveYearCookie(year: number): Promise<void> {
  const store = await cookies()
  store.set({
    name: ACTIVE_YEAR_COOKIE,
    value: String(year),
    httpOnly: false,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: COOKIE_MAX_AGE_SECONDS,
  })
}

export function buildActiveYearCookieAttributes(year: number): string {
  return [
    `${ACTIVE_YEAR_COOKIE}=${encodeURIComponent(String(year))}`,
    'Path=/',
    'SameSite=Lax',
    `Max-Age=${COOKIE_MAX_AGE_SECONDS}`,
    process.env.NODE_ENV === 'production' ? 'Secure' : '',
  ]
    .filter(Boolean)
    .join('; ')
}

export type TaxYearLike = { year: number }

export async function resolveTaxYearFromRequest<T extends TaxYearLike>(
  request: Request,
  taxYears: T[]
): Promise<T | null> {
  if (taxYears.length === 0) return null
  const availableYears = taxYears.map((ty) => ty.year)
  const resolved = await getActiveYearFromRequest(request, availableYears)
  if (resolved != null) {
    const match = taxYears.find((ty) => ty.year === resolved)
    if (match) return match
  }
  return taxYears[0]
}

