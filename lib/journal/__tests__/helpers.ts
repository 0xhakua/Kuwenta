import Decimal from 'decimal.js'
import type {
  Form2307Context,
  OverpaymentInput,
  PriorYearCreditInput,
  ReturnFilingInput,
  TaxReturnContext,
  TaxYearContext,
} from '../types'

export function d(value: string | number): Decimal {
  return new Decimal(value)
}

export function buildTaxYearContext(
  overrides: Partial<TaxYearContext> = {}
): TaxYearContext {
  return {
    id: 'ty-2026',
    year: 2026,
    electedRate: 'RATE_8PCT',
    taxpayer: { incomeType: 'PURE_SELF_EMPLOYMENT' },
    certificates: [],
    returns: [],
    priorYearCredit: null,
    overpayment: null,
    ...overrides,
  }
}

export function buildCertificate(
  overrides: Partial<Form2307Context> = {}
): Form2307Context {
  return {
    id: 'cert-1',
    quarter: 1,
    payorName: 'Acme Corp',
    payorTin: '123-456-789-000',
    atcCode: 'WI-010',
    quarterlyTotal: d('100000'),
    cwtWithheld: d('10000'),
    createdAt: new Date('2026-04-10'),
    updatedAt: new Date('2026-04-10'),
    ...overrides,
  }
}

export function buildTaxReturn(
  overrides: Partial<TaxReturnContext> = {}
): TaxReturnContext {
  return {
    id: 'return-1',
    formType: 'FORM_1701Q',
    quarter: 1,
    sequenceOrder: 1,
    status: 'FILED',
    computedTaxDue: d('2000'),
    taxCreditsTotal: d('0'),
    netTaxDue: d('2000'),
    overpaymentAmt: null,
    filedDate: new Date('2026-05-15'),
    penalties: null,
    ...overrides,
  }
}

export function buildReturnFilingInput(
  overrides: Partial<Omit<ReturnFilingInput, 'taxYear' | 'taxReturn'>> & {
    taxYear?: Partial<TaxYearContext>
    taxReturn?: Partial<TaxReturnContext>
  } = {}
): ReturnFilingInput {
  return {
    taxYear: buildTaxYearContext(overrides.taxYear ?? {}),
    taxReturn: buildTaxReturn(overrides.taxReturn ?? {}),
  }
}

export function buildPriorYearCreditInput(
  overrides: Partial<Omit<PriorYearCreditInput, 'taxYear' | 'credit'>> & {
    taxYear?: Partial<TaxYearContext>
    credit?: Partial<PriorYearCreditInput['credit']>
  } = {}
): PriorYearCreditInput {
  return {
    taxYear: buildTaxYearContext(overrides.taxYear ?? {}),
    credit: {
      id: 'pyc-1',
      amount: d('5000'),
      originYear: 2025,
      originForm: 'FORM_1701A',
      sourceOverpaymentId: null,
      ...overrides.credit,
    },
  }
}

export function buildOverpaymentInput(
  overrides: Partial<Omit<OverpaymentInput, 'taxYear' | 'overpayment'>> & {
    taxYear?: Partial<TaxYearContext>
    overpayment?: Partial<OverpaymentInput['overpayment']>
  } = {}
): OverpaymentInput {
  return {
    taxYear: buildTaxYearContext(overrides.taxYear ?? {}),
    overpayment: {
      id: 'ovp-1',
      amount: d('3000'),
      disposition: 'CARRY_OVER',
      electedAt: null,
      carryOverAppliedAt: null,
      refundReceivedAt: null,
      refundReference: null,
      tccNumber: null,
      tccAppliedAt: null,
      ...overrides.overpayment,
    },
  }
}
