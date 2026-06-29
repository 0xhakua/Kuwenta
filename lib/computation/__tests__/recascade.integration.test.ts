import { describe, expect, it } from 'vitest'
import { recascadeTaxYear } from '../recascade'
import { prisma } from '../../testing/db'
import {
  createForm2307,
  createTaxpayerWithYear,
  createATCCode,
  createRDOPenaltySchedule,
  seedReferenceData,
} from '../../testing/factories'

describe('recascadeTaxYear integration', () => {
  it('recomputes 8% path returns for Q1 and Q2 income', async () => {
    await seedReferenceData()
    const { profile, taxYear } = await createTaxpayerWithYear({
      year: 2026,
      incomeType: 'PURE_SELF_EMPLOYMENT',
      corIncludes2551Q: true,
      electedRate: 'RATE_8PCT',
    })

    const atc = await createATCCode({ code: 'WI100' })
    await createRDOPenaltySchedule({ rdoCode: profile.rdoCode, compromiseFee: 500 })

    await createForm2307(taxYear.id, atc.code, {
      quarter: 1,
      quarterlyTotal: 400000,
      cwtWithheld: 5000,
    })
    await createForm2307(taxYear.id, atc.code, {
      quarter: 2,
      quarterlyTotal: 200000,
      cwtWithheld: 3000,
    })

    const returnsBefore = await prisma.taxReturn.findMany({
      where: { taxYearId: taxYear.id },
      orderBy: { sequenceOrder: 'asc' },
    })
    expect(returnsBefore).toHaveLength(8)

    await recascadeTaxYear({ taxYearId: taxYear.id })

    const returns = await prisma.taxReturn.findMany({
      where: { taxYearId: taxYear.id },
      include: { penalties: true },
      orderBy: { sequenceOrder: 'asc' },
    })

    const q1_2551q = returns.find((r) => r.formType === 'FORM_2551Q' && r.quarter === 1)
    expect(q1_2551q?.computedTaxDue?.toString()).toBe('0')
    expect(q1_2551q?.netTaxDue?.toString()).toBe('0')

    const q1_1701q = returns.find((r) => r.formType === 'FORM_1701Q' && r.quarter === 1)
    expect(q1_1701q?.computedTaxDue?.toString()).toBe('12000')
    expect(q1_1701q?.taxCreditsTotal?.toString()).toBe('5000')
    expect(q1_1701q?.netTaxDue?.toString()).toBe('7000')
    expect(q1_1701q?.overpaymentAmt?.toString()).toBe('0')

    const q2_1701q = returns.find((r) => r.formType === 'FORM_1701Q' && r.quarter === 2)
    expect(q2_1701q?.computedTaxDue?.toString()).toBe('16000')
    expect(q2_1701q?.taxCreditsTotal?.toString()).toBe('8000')
    expect(q2_1701q?.netTaxDue?.toString()).toBe('8000')
    expect(q2_1701q?.overpaymentAmt?.toString()).toBe('0')

    const annual = returns.find((r) => r.formType === 'FORM_1701A')
    expect(annual?.computedTaxDue?.toString()).toBe('28000')
    expect(annual?.taxCreditsTotal?.toString()).toBe('23000')
    expect(annual?.netTaxDue?.toString()).toBe('5000')
    expect(annual?.overpaymentAmt?.toString()).toBe('0')

    // Penalties should have been computed for non-filed returns
    const penalizedReturns = returns.filter((r) => r.status !== 'FILED' && r.penalties)
    expect(penalizedReturns.length).toBeGreaterThan(0)
  })

  it('nulls out 1701Q/1701A values under graduated rate', async () => {
    await seedReferenceData()
    const { profile, taxYear } = await createTaxpayerWithYear({
      year: 2026,
      electedRate: 'GRADUATED',
      electionStatus: 'ELECTED_GRADUATED',
    })

    const atc = await createATCCode({ code: 'WI100' })
    await createRDOPenaltySchedule({ rdoCode: profile.rdoCode, compromiseFee: 500 })
    await createForm2307(taxYear.id, atc.code, {
      quarter: 1,
      quarterlyTotal: 100000,
      cwtWithheld: 10000,
    })

    await recascadeTaxYear({ taxYearId: taxYear.id })

    const returns = await prisma.taxReturn.findMany({
      where: { taxYearId: taxYear.id },
      include: { penalties: true },
    })

    const q1_2551q = returns.find((r) => r.formType === 'FORM_2551Q' && r.quarter === 1)
    expect(q1_2551q?.computedTaxDue?.toString()).toBe('3000')

    const q1_1701q = returns.find((r) => r.formType === 'FORM_1701Q' && r.quarter === 1)
    expect(q1_1701q?.computedTaxDue).toBeNull()
    expect(q1_1701q?.netTaxDue).toBeNull()

    const annual = returns.find((r) => r.formType === 'FORM_1701A')
    expect(annual?.computedTaxDue).toBeNull()
    expect(annual?.netTaxDue).toBeNull()

    // Penalties computed against zero tax due still include compromise fee
    expect(q1_1701q?.penalties?.totalPenalty.toString()).toBe('500')
  })

  it('applies mixed-income rules with no 250k exemption', async () => {
    await seedReferenceData()
    const { profile, taxYear } = await createTaxpayerWithYear({
      year: 2026,
      incomeType: 'MIXED_INCOME',
      electedRate: 'RATE_8PCT',
    })

    const atc = await createATCCode({ code: 'WI100' })
    await createRDOPenaltySchedule({ rdoCode: profile.rdoCode, compromiseFee: 500 })
    await createForm2307(taxYear.id, atc.code, {
      quarter: 1,
      quarterlyTotal: 200000,
      cwtWithheld: 5000,
    })

    await recascadeTaxYear({ taxYearId: taxYear.id })

    const q1_1701q = await prisma.taxReturn.findFirst({
      where: { taxYearId: taxYear.id, formType: 'FORM_1701Q', quarter: 1 },
    })

    // 200000 * 8% = 16000; minus 5000 CWT = 11000
    expect(q1_1701q?.computedTaxDue?.toString()).toBe('16000')
    expect(q1_1701q?.netTaxDue?.toString()).toBe('11000')
  })
})
