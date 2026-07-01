import Decimal from 'decimal.js'
import { computeAnnualIncomeTax, computeAnnualIncomeTaxBreakdown, computeQuarterlyIncomeTax } from '../lib/computation'
import { computePenalties } from '../lib/computation/penalties'
import { GRADUATED_REFERENCE, OSD_REFERENCE } from '../lib/computation/__tests__/reference-figures'

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

// OSD reference case: gross 2M, OSD, graduated, no credits.
// OSD deduction 40% of gross = 800,000; taxable base = 800,000.
// TRAIN brackets: 250k @0% + 150k @20% = 30,000 + 400k @25% = 100,000; total 130,000
const osdAnnual = computeAnnualIncomeTax(
  new Decimal('2000000'),
  new Decimal('0'),
  new Decimal('0'),
  new Decimal('0'),
  'PURE_SELF_EMPLOYMENT',
  'GRADUATED',
  true
)
assertEqual(osdAnnual.taxDue, new Decimal('130000.00'), 'OSD graduated tax due (gross 2M)')

// ---------------------------------------------------------------------
// Sprint-6 graduated + OSD reference figures (AGENT.md "Reference Figures")
// Loaded from lib/computation/__tests__/reference-figures.ts so the table
// in AGENT.md, this script, and the .test.ts files share one source.
// ---------------------------------------------------------------------

const gradLow = computeAnnualIncomeTax(
  GRADUATED_REFERENCE.low.gross,
  new Decimal('0'),
  new Decimal('0'),
  new Decimal('0'),
  GRADUATED_REFERENCE.low.incomeType,
  'GRADUATED'
)
assertEqual(gradLow.taxDue, GRADUATED_REFERENCE.low.expectedTaxDue, 'Graduated LOW')

const gradMid = computeAnnualIncomeTax(
  GRADUATED_REFERENCE.mid.gross,
  new Decimal('0'),
  new Decimal('0'),
  new Decimal('0'),
  GRADUATED_REFERENCE.mid.incomeType,
  'GRADUATED'
)
assertEqual(gradMid.taxDue, GRADUATED_REFERENCE.mid.expectedTaxDue, 'Graduated MID')

const gradHigh = computeAnnualIncomeTax(
  GRADUATED_REFERENCE.high.gross,
  new Decimal('0'),
  new Decimal('0'),
  new Decimal('0'),
  GRADUATED_REFERENCE.high.incomeType,
  'GRADUATED'
)
assertEqual(gradHigh.taxDue, GRADUATED_REFERENCE.high.expectedTaxDue, 'Graduated HIGH')

const gradMixedMid = computeAnnualIncomeTax(
  GRADUATED_REFERENCE.mixedMid.gross,
  new Decimal('0'),
  new Decimal('0'),
  new Decimal('0'),
  GRADUATED_REFERENCE.mixedMid.incomeType,
  'GRADUATED'
)
assertEqual(gradMixedMid.taxDue, GRADUATED_REFERENCE.mixedMid.expectedTaxDue, 'Graduated MIXED MID')

const osdHigh = computeAnnualIncomeTax(
  OSD_REFERENCE.high.gross,
  new Decimal('0'),
  new Decimal('0'),
  new Decimal('0'),
  OSD_REFERENCE.high.incomeType,
  'GRADUATED',
  OSD_REFERENCE.high.osdElection
)
assertEqual(osdHigh.taxDue, OSD_REFERENCE.high.expectedTaxDue, 'OSD HIGH')

// Quarterly graduated reference cases — cumulative gross drives the 1701Q.
const gradCumLow = computeQuarterlyIncomeTax(
  GRADUATED_REFERENCE.low.gross,
  new Decimal('0'),
  GRADUATED_REFERENCE.low.incomeType,
  'GRADUATED'
)
assertEqual(gradCumLow, GRADUATED_REFERENCE.low.expectedTaxDue, 'Graduated CUMULATIVE LOW')

const gradCumMid = computeQuarterlyIncomeTax(
  GRADUATED_REFERENCE.mid.gross,
  new Decimal('0'),
  GRADUATED_REFERENCE.mid.incomeType,
  'GRADUATED'
)
assertEqual(gradCumMid, GRADUATED_REFERENCE.mid.expectedTaxDue, 'Graduated CUMULATIVE MID')

const gradCumHigh = computeQuarterlyIncomeTax(
  GRADUATED_REFERENCE.high.gross,
  new Decimal('0'),
  GRADUATED_REFERENCE.high.incomeType,
  'GRADUATED'
)
assertEqual(gradCumHigh, GRADUATED_REFERENCE.high.expectedTaxDue, 'Graduated CUMULATIVE HIGH')

console.log('\nAll computation checks passed.')
