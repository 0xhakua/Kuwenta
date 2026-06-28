import Decimal from 'decimal.js'
import { computeAnnualIncomeTax, computeAnnualIncomeTaxBreakdown, computeQuarterlyIncomeTax } from '../lib/computation'
import { computePenalties } from '../lib/computation/penalties'

const REFERENCE = {
  fullYearGross: new Decimal('187009.33'),
  cwtWithheld: new Decimal('18700.92'),
  priorYearCredit: new Decimal('54270.00'),
  q1Gross: new Decimal('39497.80'),
  q1Cwt: new Decimal('3949.78'),
  q2Gross: new Decimal('60291.42'),
  q2Cwt: new Decimal('6029.14'),
  q3Gross: new Decimal('57020.11'),
  q3Cwt: new Decimal('5702.00'),
  q4Gross: new Decimal('30200.00'),
  q4Cwt: new Decimal('3020.00'),
  expectedAnnualTaxDue: new Decimal('0.00'),
  expectedOverpayment: new Decimal('72970.92'),
}

function assertEqual(actual: Decimal, expected: Decimal, label: string) {
  if (!actual.equals(expected)) {
    throw new Error(`${label}: expected ${expected.toString()}, got ${actual.toString()}`)
  }
  console.log(`✓ ${label}: ${actual.toString()}`)
}

// Annual pure self-employment reference case
const annual = computeAnnualIncomeTaxBreakdown(
  REFERENCE.fullYearGross,
  REFERENCE.priorYearCredit,
  new Decimal('0'),
  REFERENCE.cwtWithheld,
  'PURE_SELF_EMPLOYMENT'
)
assertEqual(annual.taxDue, REFERENCE.expectedAnnualTaxDue, 'Annual tax due (pure)')
assertEqual(annual.overpayment, REFERENCE.expectedOverpayment, 'Annual overpayment (pure)')

// Mixed income — no exemption
const mixedAnnual = computeAnnualIncomeTax(
  REFERENCE.fullYearGross,
  new Decimal('0'),
  new Decimal('0'),
  new Decimal('0'),
  'MIXED_INCOME'
)
assertEqual(mixedAnnual.taxDue, new Decimal('14960.75'), 'Annual tax due (mixed)')

// Quarterly pure self-employment
const q1Tax = computeQuarterlyIncomeTax(REFERENCE.q1Gross, new Decimal('0'), 'PURE_SELF_EMPLOYMENT')
assertEqual(q1Tax, new Decimal('0.00'), 'Q1 tax due (pure, under exemption)')

// Quarterly mixed income
const q1Mixed = computeQuarterlyIncomeTax(REFERENCE.q1Gross, new Decimal('0'), 'MIXED_INCOME')
assertEqual(q1Mixed, new Decimal('3159.82'), 'Q1 tax due (mixed)')

// Penalty rates under RA 11976
const penalties = computePenalties({
  taxDue: new Decimal('10000'),
  daysLate: 365,
  compromiseFee: new Decimal('1000'),
})
assertEqual(penalties.surcharge, new Decimal('1000.00'), 'Surcharge 10%')
assertEqual(penalties.interest, new Decimal('600.00'), 'Interest 6% p.a.')
assertEqual(penalties.compromisePenalty, new Decimal('1000.00'), 'Compromise penalty')
assertEqual(penalties.totalPenalty, new Decimal('2600.00'), 'Total penalty')

// Zero tax due → no surcharge/interest but compromise applies
const zeroTaxPenalties = computePenalties({
  taxDue: new Decimal('0'),
  daysLate: 30,
  compromiseFee: new Decimal('500'),
})
assertEqual(zeroTaxPenalties.surcharge, new Decimal('0.00'), 'Zero surcharge for zero tax')
assertEqual(zeroTaxPenalties.interest, new Decimal('0.00'), 'Zero interest for zero tax')
assertEqual(zeroTaxPenalties.compromisePenalty, new Decimal('500.00'), 'Compromise applies even with zero tax')

console.log('\nAll computation checks passed.')
