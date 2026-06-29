import Decimal from 'decimal.js'

/**
 * Format a monetary value as Philippine Peso.
 * Returns '₱0.00' for null, undefined, or non-numeric input.
 */
export function formatPeso(value: Decimal.Value | null | undefined): string {
  if (value == null) return '₱0.00'
  try {
    const decimal = value instanceof Decimal ? value : new Decimal(value)
    return `₱${decimal.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`
  } catch {
    return '₱0.00'
  }
}

/**
 * Format a date value as a readable string.
 * Returns '—' for null or undefined.
 */
export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '—'
  const date = typeof value === 'string' ? new Date(value) : value
  return date.toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}
