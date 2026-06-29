import type { PrismaClient } from '@prisma/client'
import { prisma } from './prisma'
import { getDueDatesForYear } from './computation/due-dates'
import type { FormTypeValue, IncomeTypeValue } from './computation/constants'

type TransactionClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>

/**
 * Initialize a TaxYear and its mandatory TaxReturn slots for a taxpayer.
 *
 * - 8 returns if COR includes 2551Q (4 × 2551Q + 3 × 1701Q + annual)
 * - 4 returns if COR does not include 2551Q (3 × 1701Q + annual)
 * - Mixed-income earners use Form 1701 as the annual return; all others use 1701A.
 */
export async function initializeTaxYear(
  taxpayerId: string,
  year: number,
  corIncludes2551Q: boolean,
  holidays: Date[] = [],
  tx: TransactionClient = prisma,
  incomeType: IncomeTypeValue = 'PURE_SELF_EMPLOYMENT'
) {
  const taxYear = await tx.taxYear.upsert({
    where: {
      taxpayerId_year: {
        taxpayerId,
        year,
      },
    },
    update: {},
    create: {
      taxpayerId,
      year,
    },
  })

  const dueDates = getDueDatesForYear(year, corIncludes2551Q, holidays, incomeType)
  const annualForm: FormTypeValue = incomeType === 'MIXED_INCOME' ? 'FORM_1701' : 'FORM_1701A'
  const returns: Array<{
    formType: FormTypeValue
    quarter: number | null
    sequenceOrder: number
  }> = corIncludes2551Q
    ? [
        { formType: 'FORM_2551Q' as const, quarter: 1, sequenceOrder: 1 },
        { formType: 'FORM_2551Q' as const, quarter: 2, sequenceOrder: 2 },
        { formType: 'FORM_2551Q' as const, quarter: 3, sequenceOrder: 3 },
        { formType: 'FORM_2551Q' as const, quarter: 4, sequenceOrder: 4 },
        { formType: 'FORM_1701Q' as const, quarter: 1, sequenceOrder: 5 },
        { formType: 'FORM_1701Q' as const, quarter: 2, sequenceOrder: 6 },
        { formType: 'FORM_1701Q' as const, quarter: 3, sequenceOrder: 7 },
        { formType: annualForm, quarter: null, sequenceOrder: 8 },
      ]
    : [
        { formType: 'FORM_1701Q' as const, quarter: 1, sequenceOrder: 1 },
        { formType: 'FORM_1701Q' as const, quarter: 2, sequenceOrder: 2 },
        { formType: 'FORM_1701Q' as const, quarter: 3, sequenceOrder: 3 },
        { formType: annualForm, quarter: null, sequenceOrder: 4 },
      ]

  for (const r of returns) {
    const dueDateEntry = dueDates.find(
      (d) => d.formType === r.formType && d.quarter === r.quarter
    )
    if (!dueDateEntry) continue

    const existing = await tx.taxReturn.findFirst({
      where: {
        taxYearId: taxYear.id,
        formType: r.formType,
        quarter: r.quarter,
      },
    })

    if (existing) {
      await tx.taxReturn.update({
        where: { id: existing.id },
        data: {
          sequenceOrder: r.sequenceOrder,
          statutoryDueDate: dueDateEntry.adjustedDueDate,
        },
      })
    } else {
      await tx.taxReturn.create({
        data: {
          taxYearId: taxYear.id,
          formType: r.formType,
          quarter: r.quarter,
          sequenceOrder: r.sequenceOrder,
          statutoryDueDate: dueDateEntry.adjustedDueDate,
        },
      })
    }
  }

  return taxYear
}
