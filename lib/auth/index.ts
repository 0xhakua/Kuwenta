import { NextResponse } from 'next/server'
import { prisma } from '../prisma'
import type { JWTPayload } from './session'

export * from './session'
export * from './password'

export function unauthorizedResponse(): NextResponse {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

export async function getCurrentUser(session: JWTPayload) {
  return prisma.user.findUnique({
    where: { id: session.sub },
    select: { id: true, username: true, role: true },
  })
}
