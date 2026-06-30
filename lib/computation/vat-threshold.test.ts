import { describe, it, expect } from 'vitest'
import { prisma } from '@/lib/testing/db'
import {
  createTaxpayerWithYear,
  createATCCode,
  createForm2307,
  seedReferenceData,
} from '@/lib/testing/factories'
import { checkAndRecordVatBreach, VAT_WARNING_THRESHOLD, VAT_THRESHOLD } from '@/lib/computation/vat-threshold'

describe('checkAndRecordVatBreach', () => {
  it('returns thresholdReached=false when YTD gross is below threshold', async () => {
    await seedReferenceData()
    const { taxYear } = await createTaxpayerWithYear()
    const atc = await createATCCode({ code: 'WI001', ewtRate: 0.1 })
    await createForm2307(taxYear.id, atc.code, { quarterlyTotal: 100_000 })

    const result = await checkAndRecordVatBreach(taxYear.id, prisma)

    expect(result.thresholdReached).toBe(false)
    expect(result.warningActive).toBe(false)

    const updated = await prisma.taxYear.findUnique({ where: { id: taxYear.id } })
    expect(updated?.vatBreached).toBe(false)
    expect(updated?.vatBreachDate).toBeNull()
  })

  it('activates warning at 80% of the VAT threshold', async () => {
    await seedReferenceData()
    const { taxYear } = await createTaxpayerWithYear()
    const atc = await createATCCode({ code: 'WI002', ewtRate: 0.1 })
    await createForm2307(taxYear.id, atc.code, { quarterlyTotal: VAT_WARNING_THRESHOLD.plus(1).toNumber() })

    const result = await checkAndRecordVatBreach(taxYear.id, prisma)

    expect(result.warningActive).toBe(true)
    expect(result.thresholdReached).toBe(false)
  })

  it('records VAT breach once YTD gross reaches ₱3,000,000', async () => {
    await seedReferenceData()
    const { taxYear } = await createTaxpayerWithYear()
    const atc = await createATCCode({ code: 'WI003', ewtRate: 0.1 })
    await createForm2307(taxYear.id, atc.code, { quarterlyTotal: VAT_THRESHOLD.toNumber() })

    const result = await checkAndRecordVatBreach(taxYear.id, prisma)

    expect(result.thresholdReached).toBe(true)
    expect(result.warningActive).toBe(true)

    const updated = await prisma.taxYear.findUnique({ where: { id: taxYear.id } })
    expect(updated?.vatBreached).toBe(true)
    expect(updated?.vatBreachDate).not.toBeNull()
  })

  it('keeps the original breach date on subsequent crossings', async () => {
    await seedReferenceData()
    const { taxYear } = await createTaxpayerWithYear()
    const atc = await createATCCode({ code: 'WI004', ewtRate: 0.1 })

    await createForm2307(taxYear.id, atc.code, { quarterlyTotal: VAT_THRESHOLD.toNumber() })
    await checkAndRecordVatBreach(taxYear.id, prisma)
    const firstDate = (await prisma.taxYear.findUnique({ where: { id: taxYear.id } }))?.vatBreachDate

    await createForm2307(taxYear.id, atc.code, { quarter: 2, quarterlyTotal: 100_000 })
    await checkAndRecordVatBreach(taxYear.id, prisma)

    const updated = await prisma.taxYear.findUnique({ where: { id: taxYear.id } })
    expect(updated?.vatBreachDate).toEqual(firstDate)
  })
})
