import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'

export interface JWTPayload {
  sub: string
  username: string
  role: 'ADMIN' | 'TAXPAYER'
  iat: number
  exp: number
}

const COOKIE_NAME = 'kuwenta_session'
const TOKEN_MAX_AGE_SECONDS = 8 * 60 * 60 // 8 hours

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET
  if (!secret) {
    throw new Error('JWT_SECRET is not configured')
  }
  return new TextEncoder().encode(secret)
}

export async function signToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt(now)
    .setExpirationTime(now + TOKEN_MAX_AGE_SECONDS)
    .sign(getJwtSecret())
}

export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret(), {
      algorithms: ['HS256'],
    })

    const sub = payload.sub
    const username = payload.username
    const role = payload.role

    if (typeof sub !== 'string' || typeof username !== 'string' || (role !== 'ADMIN' && role !== 'TAXPAYER')) {
      return null
    }

    return {
      sub,
      username,
      role,
      iat: payload.iat as number,
      exp: payload.exp as number,
    }
  } catch {
    return null
  }
}

export async function setSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    maxAge: TOKEN_MAX_AGE_SECONDS,
    path: '/',
  })
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, '', {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    maxAge: 0,
    path: '/',
  })
}

export async function getSession(): Promise<JWTPayload | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token) return null
  return verifyToken(token)
}

async function isUserActive(userId: string): Promise<boolean> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { isActive: true },
    })
    return user?.isActive ?? false
  } catch {
    return false
  }
}

export async function requireAuth(req?: NextRequest): Promise<JWTPayload | null> {
  const session = req
    ? await verifyToken(req.cookies.get(COOKIE_NAME)?.value ?? '')
    : await getSession()

  if (!session) return null

  // Deactivated users lose access immediately even if their JWT is still valid.
  const active = await isUserActive(session.sub)
  if (!active) return null

  return session
}
