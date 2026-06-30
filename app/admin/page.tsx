'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

interface AdminUser {
  id: string
  username: string
  role: 'ADMIN' | 'TAXPAYER'
  createdAt: string
  taxpayer: {
    tin: string
    fullName: string
    rdoCode: string
    incomeType: string
    corIncludes2551Q: boolean
  } | null
}

interface SystemHealthSummary {
  ok: boolean
  stellar: { ok: boolean; network: string; reachable: boolean; message: string }
  storage: { ok: boolean; type: string; writable: boolean; message: string }
  database: { ok: boolean; message: string }
}

export default function AdminPage() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [health, setHealth] = useState<SystemHealthSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function loadUsers() {
      setLoading(true)
      try {
        const res = await fetch('/api/admin/users')
        const data = await res.json()
        if (cancelled) return
        if (!res.ok) {
          setError(data.error || 'Failed to load users')
          return
        }
        setUsers(data.users ?? [])
      } catch {
        if (!cancelled) setError('Failed to load users')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    async function loadHealth() {
      try {
        const res = await fetch('/api/admin/system-health')
        const data = await res.json()
        if (cancelled) return
        if (res.ok) {
          setHealth({
            ok: data.ok,
            stellar: data.stellar,
            storage: data.storage,
            database: data.database,
          })
        }
      } catch {
        /* leave health null on transient network errors */
      }
    }

    loadUsers()
    loadHealth()
    return () => {
      cancelled = true
    }
  }, [])

  const healthBadge = (ok: boolean) =>
    ok ? (
      <Badge className="bg-green-100 text-green-800">OK</Badge>
    ) : (
      <Badge className="bg-red-100 text-red-800">Degraded</Badge>
    )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Admin Panel</h1>
          <p className="text-muted-foreground">Manage taxpayers and system activity.</p>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {loading && <p className="text-muted-foreground">Loading users…</p>}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Link href="/admin/audit-log">
          <Card className="hover:bg-muted/50 transition-colors h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Audit Log</CardTitle>
              <CardDescription>System activity trail</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" size="sm">View</Button>
            </CardContent>
          </Card>
        </Link>
        <Link href="/admin/atc">
          <Card className="hover:bg-muted/50 transition-colors h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">ATC Codes</CardTitle>
              <CardDescription>Withholding tax codes</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" size="sm">Manage</Button>
            </CardContent>
          </Card>
        </Link>
        <Link href="/admin/holidays">
          <Card className="hover:bg-muted/50 transition-colors h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Holidays</CardTitle>
              <CardDescription>Deadline rolling calendar</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" size="sm">Manage</Button>
            </CardContent>
          </Card>
        </Link>
        <Link href="/admin/rdo-penalties">
          <Card className="hover:bg-muted/50 transition-colors h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">RDO Penalties</CardTitle>
              <CardDescription>Compromise fees by RDO</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" size="sm">Manage</Button>
            </CardContent>
          </Card>
        </Link>
        <Link href="/admin/system-health">
          <Card className="hover:bg-muted/50 transition-colors h-full">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">System Health</CardTitle>
                {health ? healthBadge(health.ok) : (
                  <Badge className="bg-muted text-muted-foreground">—</Badge>
                )}
              </div>
              <CardDescription>
                Stellar + storage status
              </CardDescription>
            </CardHeader>
            <CardContent>
              {health ? (
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Stellar</span>
                    {healthBadge(health.stellar.ok)}
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Storage</span>
                    {healthBadge(health.storage.ok)}
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Database</span>
                    {healthBadge(health.database.ok)}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Loading…</p>
              )}
            </CardContent>
          </Card>
        </Link>
      </div>

      {!loading && users.length === 0 ? (
        <p className="text-muted-foreground">No users found.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Username</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>TIN</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>RDO</TableHead>
              <TableHead>Income Type</TableHead>
              <TableHead>COR 2551Q</TableHead>
              <TableHead>Joined</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell>{user.username}</TableCell>
                <TableCell>
                  <Badge
                    className={
                      user.role === 'ADMIN'
                        ? 'bg-purple-100 text-purple-800'
                        : 'bg-blue-100 text-blue-800'
                    }
                  >
                    {user.role}
                  </Badge>
                </TableCell>
                <TableCell>{user.taxpayer?.tin ?? '—'}</TableCell>
                <TableCell>{user.taxpayer?.fullName ?? '—'}</TableCell>
                <TableCell>{user.taxpayer?.rdoCode ?? '—'}</TableCell>
                <TableCell>{user.taxpayer?.incomeType ?? '—'}</TableCell>
                <TableCell>
                  {user.taxpayer ? (user.taxpayer.corIncludes2551Q ? 'Yes' : 'No') : '—'}
                </TableCell>
                <TableCell>
                  {new Date(user.createdAt).toLocaleDateString('en-PH')}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
