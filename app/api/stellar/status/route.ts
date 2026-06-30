import { NextResponse } from 'next/server'
import { getStellarStatus } from '@/lib/stellar/verify'

export async function GET() {
  try {
    const status = await getStellarStatus()
    return NextResponse.json(status, {
      status: status.healthy ? 200 : 503,
    })
  } catch (err) {
    console.error('Stellar status error:', err)
    return NextResponse.json(
      {
        healthy: false,
        error: 'Internal server error',
        checkedAt: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}
