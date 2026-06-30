import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/atc/[code] — fetch a single ATC code (rate + description).
 *
 * Returns inactive codes too — this endpoint is intended for callers that
 * need to look up the full record (e.g. admin tooling, audit reports, or
 * client-side validation of codes already on file). For the standard
 * "active codes only" list, see GET /api/atc.
 *
 * Updates still go through the admin collection endpoint:
 *   PATCH /api/admin/atc  with `{ code, description?, ewtRate?, isActive? }`.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const session = await requireAuth()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { code: rawCode } = await params
    const code = rawCode?.trim().toUpperCase()
    if (!code) {
      return NextResponse.json({ error: 'ATC code is required' }, { status: 400 })
    }

    const atc = await prisma.aTCCode.findUnique({
      where: { code },
    })

    if (!atc) {
      return NextResponse.json({ error: 'ATC code not found' }, { status: 404 })
    }

    return NextResponse.json({
      code: atc.code,
      description: atc.description,
      ewtRate: atc.ewtRate.toString(),
      isActive: atc.isActive,
      createdAt: atc.createdAt.toISOString(),
      updatedAt: atc.updatedAt.toISOString(),
    })
  } catch (err) {
    console.error('Get ATC by code error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
