import { describe, expect, it, vi, beforeEach } from 'vitest'

// `vi.mock` is hoisted to the top of the file, so any state it references
// has to be wrapped in `vi.hoisted` to avoid a TDZ error.
const mocks = vi.hoisted(() => ({
  clearSessionCookie: vi.fn(),
}))

vi.mock('@/lib/auth/session', async () => {
  const actual = await vi.importActual<typeof import('@/lib/auth/session')>('@/lib/auth/session')
  return {
    ...actual,
    clearSessionCookie: mocks.clearSessionCookie,
  }
})

const cookieStore = new Map<string, { name: string; value: string; maxAge?: number; path?: string }>()
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => {
      const entry = cookieStore.get(name)
      return entry ? { name: entry.name, value: entry.value } : undefined
    },
    set: (opts: { name: string; value: string; maxAge?: number; path?: string }) => {
      if (opts.maxAge === 0) {
        // Mirror the real cookie semantics: maxAge: 0 deletes the cookie.
        cookieStore.delete(opts.name)
        return
      }
      cookieStore.set(opts.name, { ...opts })
    },
  }),
}))

import { POST } from '../route'

function postRequest() {
  return new Request('http://localhost/api/auth/logout', { method: 'POST' })
}

describe('POST /api/auth/logout', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'test-jwt-secret-32-chars-minimum-aaaaaaaa'
    mocks.clearSessionCookie.mockReset()
    // Wire the mock to the underlying cookie store so it behaves like the
    // real helper: the route's call must remove the session cookie.
    mocks.clearSessionCookie.mockImplementation(async () => {
      const cookieJar = await (await import('next/headers')).cookies()
      cookieJar.set({
        name: 'kuwenta_session',
        value: '',
        maxAge: 0,
        path: '/',
      })
    })
    cookieStore.set('kuwenta_session', { name: 'kuwenta_session', value: 'stub-token', path: '/' })
  })

  it('returns 200 with { success: true }', async () => {
    const res = await POST(postRequest())
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body).toEqual({ success: true })
  })

  it('invokes clearSessionCookie exactly once per request', async () => {
    await POST(postRequest())
    expect(mocks.clearSessionCookie).toHaveBeenCalledTimes(1)
  })

  it('removes the session cookie from the cookie store', async () => {
    expect(cookieStore.get('kuwenta_session')?.value).toBe('stub-token')
    await POST(postRequest())
    expect(cookieStore.has('kuwenta_session')).toBe(false)
  })

  it('returns 500 when clearSessionCookie throws (cookie store failure)', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.clearSessionCookie.mockRejectedValueOnce(new Error('cookie store unavailable'))

    const res = await POST(postRequest())
    const body = await res.json()

    expect(res.status).toBe(500)
    expect(body).toEqual({ error: 'Internal server error' })

    const log = errorSpy.mock.calls.find(
      (call) => typeof call[0] === 'string' && call[0].includes('[logout]')
    )
    expect(log).toBeDefined()

    errorSpy.mockRestore()
  })
})
