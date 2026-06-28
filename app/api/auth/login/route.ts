import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { signToken, verifyPassword, setSessionCookie } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const result = loginSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
    }

    const { username, password } = result.data

    const user = await prisma.user.findUnique({
      where: { username },
    })

    if (!user) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    const valid = await verifyPassword(password, user.passwordHash)
    if (!valid) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    const token = await signToken({
      sub: user.id,
      username: user.username,
      role: user.role,
    })

    await setSessionCookie(token)

    return NextResponse.json({
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
      },
    })
  } catch (err) {
    console.error('Login error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
