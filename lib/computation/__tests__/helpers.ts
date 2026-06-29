import Decimal from 'decimal.js'

/**
 * Short helper for building Decimal values in tests.
 */
export function d(value: string | number): Decimal {
  return new Decimal(value)
}

/**
 * Compare a Decimal to an expected string representation.
 */
export function expectDecimal(actual: Decimal, expected: string): void {
  expect(actual.toString()).toBe(expected)
}
