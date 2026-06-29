import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { Button } from '@/components/ui/button'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getSession()
  if (!session) {
    redirect('/login')
  }

  return (
    <div className="min-h-screen flex">
      <aside className="w-64 border-r bg-muted/40 p-4 hidden md:block">
        <nav className="space-y-2">
          <Link href="/dashboard">
            <Button variant="ghost" className="w-full justify-start">Dashboard</Button>
          </Link>
          <Link href="/onboarding">
            <Button variant="ghost" className="w-full justify-start">Onboarding</Button>
          </Link>
          <Link href="/income">
            <Button variant="ghost" className="w-full justify-start">Income</Button>
          </Link>
          <Link href="/election">
            <Button variant="ghost" className="w-full justify-start">Election</Button>
          </Link>
          <Link href="/returns">
            <Button variant="ghost" className="w-full justify-start">Returns</Button>
          </Link>
          <Link href="/prior-year-credit">
            <Button variant="ghost" className="w-full justify-start">Prior Year Credit</Button>
          </Link>
          <Link href="/sawt">
            <Button variant="ghost" className="w-full justify-start">SAWT</Button>
          </Link>
          <Link href="/journal">
            <Button variant="ghost" className="w-full justify-start">Journal</Button>
          </Link>
          <Link href="/stellar">
            <Button variant="ghost" className="w-full justify-start">Stellar</Button>
          </Link>
          {session.role === 'ADMIN' && (
            <Link href="/admin">
              <Button variant="ghost" className="w-full justify-start">Admin</Button>
            </Link>
          )}
        </nav>
      </aside>
      <main className="flex-1 p-6">{children}</main>
    </div>
  )
}
