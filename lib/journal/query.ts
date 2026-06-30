import type { Prisma } from '@prisma/client'

export interface JournalListFilters {
  subsection?: string | null
  quarter?: number | string | null
  accountName?: string | null
}

export interface JournalListFilterResult {
  where: Prisma.JournalEntryWhereInput
  accountName: string | null
  quarter: number | null
  subsection: string | null
}

/**
 * Parse a raw `quarter` value from a query string into a number.
 *
 * Accepts "ALL", "ANNUAL", or an empty string as "no quarter filter" (null).
 * Accepts "1"-"4" as a numeric quarter. Anything else is rejected.
 */
export function parseQuarterFilter(
  raw: string | number | null | undefined
): number | null | { error: string } {
  if (raw === null || raw === undefined) return null
  if (typeof raw === 'number') {
    if (raw === 1 || raw === 2 || raw === 3 || raw === 4) return raw
    return { error: `Invalid quarter: ${raw}` }
  }
  const trimmed = raw.trim()
  if (trimmed === '' || trimmed.toUpperCase() === 'ALL' || trimmed.toUpperCase() === 'ANNUAL') {
    return null
  }
  const n = Number(trimmed)
  if (Number.isInteger(n) && n >= 1 && n <= 4) return n
  return { error: `Invalid quarter: ${raw}` }
}

export function parseAccountNameFilter(
  raw: string | null | undefined
): string | null {
  if (!raw) return null
  const trimmed = raw.trim()
  return trimmed.length > 0 ? trimmed : null
}

export function hasFilterError(
  value: unknown
): value is { error: string } {
  return value !== null && typeof value === 'object' && 'error' in value
}

const VALID_SUBSECTIONS = new Set(['9A', '9B', '9C', '9D', '9E', '9F', '9G'])

export function parseSubsectionFilter(
  raw: string | null | undefined
): string | null | { error: string } {
  if (!raw) return null
  const trimmed = raw.trim()
  if (trimmed === '' || trimmed.toUpperCase() === 'ALL') return null
  const upper = trimmed.toUpperCase()
  if (!VALID_SUBSECTIONS.has(upper)) {
    return { error: `Invalid subsection: ${raw}` }
  }
  return upper
}

export function buildJournalListWhere(
  taxYearId: string,
  filters: JournalListFilters
): JournalListFilterResult {
  const where: Prisma.JournalEntryWhereInput = {
    taxYearId,
  }

  if (filters.subsection) {
    where.subsection = filters.subsection
  }

  if (filters.quarter !== null && filters.quarter !== undefined) {
    where.quarter = filters.quarter
  }

  if (filters.accountName) {
    where.lines = {
      some: {
        accountName: { contains: filters.accountName, mode: 'insensitive' },
      },
    }
  }

  return {
    where,
    accountName: filters.accountName ?? null,
    quarter: filters.quarter ?? null,
    subsection: filters.subsection ?? null,
  }
}
