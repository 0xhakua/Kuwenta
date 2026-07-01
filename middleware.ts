import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { requireAuth } from './lib/auth/session'

// Run middleware in the Node.js runtime so it can access Prisma and the full
// Node crypto stack used by jose. The Edge runtime silently fails auth checks
// on Railway because Prisma is unavailable and env access is inconsistent.
export const runtime = 'nodejs'

const PUBLIC_PATHS = ['/login', '/api/auth/login']

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (PUBLIC_PATHS.some((path) => pathname.startsWith(path))) {
    return NextResponse.next()
  }

  // Allow Next.js internal and static assets
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/api/auth')
  ) {
    return NextResponse.next()
  }

  const session = await requireAuth(req)
  if (!session) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const loginUrl = new URL('/login', req.url)
    return NextResponse.redirect(loginUrl)
  }

  // Admin-only routes
  if (
    pathname.startsWith('/admin') ||
    pathname.startsWith('/api/admin')
  ) {
    if (session.role !== 'ADMIN') {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      const dashboardUrl = new URL('/dashboard', req.url)
      return NextResponse.redirect(dashboardUrl)
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
