import { SEQUENCE_DEPENDENCIES_4, SEQUENCE_DEPENDENCIES_8 } from './constants'

export function getDependencies(corIncludes2551Q: boolean): Record<number, number[]> {
  return corIncludes2551Q ? SEQUENCE_DEPENDENCIES_8 : SEQUENCE_DEPENDENCIES_4
}

export function determineReturnStatus(
  sequenceOrder: number,
  allReturns: Array<{ sequenceOrder: number; status: string }>,
  corIncludes2551Q: boolean
): 'BLOCKED' | 'PENDING' | 'GENERATED' | 'FILED' {
  const current = allReturns.find((r) => r.sequenceOrder === sequenceOrder)
  if (!current) return 'BLOCKED'
  if (current.status === 'FILED') return 'FILED'
  if (current.status === 'GENERATED') return 'GENERATED'

  const dependencies = getDependencies(corIncludes2551Q)[sequenceOrder] ?? []
  const depsFiled = dependencies.every((depOrder) => {
    const dep = allReturns.find((r) => r.sequenceOrder === depOrder)
    return dep?.status === 'FILED'
  })

  return depsFiled ? 'PENDING' : 'BLOCKED'
}
