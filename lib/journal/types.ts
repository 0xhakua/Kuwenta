import type { Decimal } from 'decimal.js'
import type { PrismaClient } from '@prisma/client'

export type TransactionClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>

export interface TaxYearContext {
  id: string
  year: number
  electedRate: 'RATE_8PCT' | 'GRADUATED' | null
  taxpayer: {
    incomeType: 'PURE_SELF_EMPLOYMENT' | 'MIXED_INCOME'
  }
  certificates: Form2307Context[]
  returns: TaxReturnContext[]
  priorYearCredit: { id: string; amount: Decimal; originYear: number; originForm: string; sourceOverpaymentId?: string | null } | null
  overpayment: {
    id: string
    amount: Decimal
    disposition: 'CARRY_OVER' | 'REFUND' | 'TAX_CREDIT_CERTIFICATE' | null
    electedAt: Date | null
    carryOverAppliedAt: Date | null
    refundReceivedAt: Date | null
    refundReference: string | null
    tccNumber: string | null
    tccAppliedAt: Date | null
  } | null
}

export interface Form2307Context {
  id: string
  quarter: number
  payorName: string
  payorTin: string
  atcCode: string
  quarterlyTotal: Decimal
  cwtWithheld: Decimal
  createdAt: Date
  updatedAt: Date
}

export interface TaxReturnContext {
  id: string
  formType: 'FORM_2551Q' | 'FORM_1701Q' | 'FORM_1701A'
  quarter: number | null
  sequenceOrder: number
  status: 'BLOCKED' | 'PENDING' | 'GENERATED' | 'FILED'
  computedTaxDue: Decimal | null
  taxCreditsTotal: Decimal | null
  netTaxDue: Decimal | null
  overpaymentAmt: Decimal | null
  filedDate: Date | null
  penalties: {
    surcharge: Decimal
    interest: Decimal
    compromisePenalty: Decimal
    totalPenalty: Decimal
  } | null
}

export interface IncomeRecognitionInput {
  taxYear: TaxYearContext
  certificate: Form2307Context
  eventType: '2307_ADDED' | '2307_AMENDED' | '2307_DELETED'
  previousCertificate?: Form2307Context
}

export interface ReturnFilingInput {
  taxYear: TaxYearContext
  taxReturn: TaxReturnContext
}

export interface PriorYearCreditInput {
  taxYear: TaxYearContext
  credit: { id: string; amount: Decimal; originYear: number; originForm: string; sourceOverpaymentId?: string | null }
}

export interface OverpaymentInput {
  taxYear: TaxYearContext
  overpayment: {
    id: string
    amount: Decimal
    disposition: 'CARRY_OVER' | 'REFUND' | 'TAX_CREDIT_CERTIFICATE'
    electedAt?: Date | null
    carryOverAppliedAt?: Date | null
    refundReceivedAt?: Date | null
    refundReference?: string | null
    tccNumber?: string | null
    tccAppliedAt?: Date | null
  }
}
