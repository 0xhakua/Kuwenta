import { describe, expect, it } from 'vitest'
import { generateIncomeRecognitionEntries } from '../entries/9a-income'
import { ACCOUNTS } from '../accounts'
import { buildCertificate, buildTaxYearContext, d } from './helpers'

describe('generateIncomeRecognitionEntries', () => {
  const taxYear = buildTaxYearContext()

  it('creates a 9.1 entry for a newly added 2307 certificate', () => {
    const certificate = buildCertificate()
    const entries = generateIncomeRecognitionEntries({
      taxYear,
      certificate,
      eventType: '2307_ADDED',
    })

    expect(entries).toHaveLength(1)
    expect(entries[0].entryNumber).toBe('9.1')
    expect(entries[0].triggerEvent).toBe('2307_ADDED')
    expect(entries[0].lines).toHaveLength(3)

    const [cash, cwt, income] = entries[0].lines
    expect(cash.accountCode).toBe(ACCOUNTS.CASH.code)
    expect(cash.debit.toString()).toBe('90000')
    expect(cwt.debit.toString()).toBe('10000')
    expect(income.credit.toString()).toBe('100000')
  })

  it('creates a reversal and re-add entry for an amended certificate', () => {
    const previous = buildCertificate({ quarterlyTotal: d('80000'), cwtWithheld: d('8000') })
    const current = buildCertificate({ quarterlyTotal: d('100000'), cwtWithheld: d('10000') })

    const entries = generateIncomeRecognitionEntries({
      taxYear,
      certificate: current,
      eventType: '2307_AMENDED',
      previousCertificate: previous,
    })

    expect(entries).toHaveLength(2)

    const reversal = entries[0]
    expect(reversal.entryNumber).toBe('9.2')
    expect(reversal.lines[0].debit.toString()).toBe('-72000')
    expect(reversal.lines[1].debit.toString()).toBe('-8000')
    expect(reversal.lines[2].credit.toString()).toBe('-80000')

    const reAdd = entries[1]
    expect(reAdd.entryNumber).toBe('9.1')
    expect(reAdd.lines[0].debit.toString()).toBe('90000')
  })

  it('creates only a reversal entry for a deleted certificate', () => {
    const certificate = buildCertificate()
    const entries = generateIncomeRecognitionEntries({
      taxYear,
      certificate,
      eventType: '2307_DELETED',
    })

    expect(entries).toHaveLength(1)
    expect(entries[0].entryNumber).toBe('9.2')
    expect(entries[0].triggerEvent).toBe('2307_REVERSAL')
    expect(entries[0].lines[0].debit.toString()).toBe('-90000')
  })

  it('uses certificate.createdAt as the entry date', () => {
    const certificate = buildCertificate()
    const entries = generateIncomeRecognitionEntries({
      taxYear,
      certificate,
      eventType: '2307_ADDED',
    })

    expect(entries[0].entryDate).toBe(certificate.createdAt)
  })

  it('never produces negative cash by capping net cash at zero', () => {
    const certificate = buildCertificate({ quarterlyTotal: d('5000'), cwtWithheld: d('10000') })
    const entries = generateIncomeRecognitionEntries({
      taxYear,
      certificate,
      eventType: '2307_ADDED',
    })

    expect(entries[0].lines[0].debit.toString()).toBe('0')
    expect(entries[0].lines[1].debit.toString()).toBe('10000')
    expect(entries[0].lines[2].credit.toString()).toBe('5000')
  })
})
