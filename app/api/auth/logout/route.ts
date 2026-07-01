import { NextResponse } from 'next/server'
import { clearSessionCookie } from '@/lib/auth'

export async function POST() {
  try {
    await clearSessionCookie()
    return NextResponse.json({ success: true })
  } catch (err) {
    // Mirror the structured error pattern in app/api/auth/login/route.ts.
    // The cookie store is the only failure surface here (the session helper
    // itself just calls cookies().set), so a 500 with a generic message keeps
    // the client from acting on a partially-applied sign-out.
    console.error('[logout] clearSessionCookie failed', {
      errorName: err instanceof Error ? err.name : typeof err,
      errorMessage: err instanceof Error ? err.message : String(err),
    })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
