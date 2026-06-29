export interface LineageCredit {
  id: string
  taxYearId: string
  taxYear: number
  amount: string
  originYear: number
  originForm: string
  priorDisposition: string
}

export interface LineageNode {
  year: number
  credit: {
    id: string
    amount: string
    originYear: number
    originForm: string
    priorDisposition: string
  } | null
}

const MAX_LINEAGE_DEPTH = 50

export function buildLineage(
  currentYear: number,
  creditsByYear: Map<number, LineageCredit>
): LineageNode[] {
  const chain: LineageNode[] = []
  let cursor: number | null = currentYear
  let safety = 0

  while (cursor != null && safety < MAX_LINEAGE_DEPTH) {
    safety += 1
    const credit: LineageCredit | null = creditsByYear.get(cursor) ?? null
    chain.push({
      year: cursor,
      credit: credit
        ? {
            id: credit.id,
            amount: credit.amount,
            originYear: credit.originYear,
            originForm: credit.originForm,
            priorDisposition: credit.priorDisposition,
          }
        : null,
    })
    cursor = credit ? credit.originYear : null
  }

  return chain
}
