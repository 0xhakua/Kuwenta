'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

interface SystemHealth {
  ok: boolean
  stellar: {
    ok: boolean
    network: string
    horizonUrl: string
    reachable: boolean
    configured: boolean
    message: string
  }
  storage: {
    ok: boolean
    type: string
    path: string
    writable: boolean
    message: string
  }
  database: { ok: boolean; message: string }
  checkedAt: string
}

const STATUS_BG = {
  ok: 'bg-green-100 text-green-800',
  warn: 'bg-amber-100 text-amber-800',
  bad: 'bg-red-100 text-red-800',
}

function badgeFor(ok: boolean, warnOnly = false) {
  if (ok) return <Badge className={STATUS_BG.ok}>OK</Badge>
  if (warnOnly) return <Badge className={STATUS_BG.warn}>Warning</Badge>
  return <Badge className={STATUS_BG.bad}>Down</Badge>
}

export default function SystemHealthPage() {
  const [health, setHealth] = useState<SystemHealth | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/system-health')
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to load system health')
        return
      }
      setHealth(data)
    } catch {
      setError('Failed to load system health')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const controller = new AbortController()
    void (async () => {
      setLoading(true)
      setError('')
      try {
        const res = await fetch('/api/admin/system-health', {
          signal: controller.signal,
        })
        const data = await res.json()
        if (controller.signal.aborted) return
        if (!res.ok) {
          setError(data.error || 'Failed to load system health')
          return
        }
        setHealth(data)
      } catch (err) {
        if (controller.signal.aborted) return
        setError(err instanceof Error ? err.message : 'Failed to load system health')
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    })()
    return () => controller.abort()
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">System Health</h1>
          <p className="text-muted-foreground">
            Stellar Horizon, storage backend, and database reachability.
          </p>
        </div>
        <Button variant="outline" onClick={load} disabled={loading}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </Button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {health ? (
        <>
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Overall</CardTitle>
                {badgeFor(health.ok)}
              </div>
              <CardDescription>
                Last checked {new Date(health.checkedAt).toLocaleString('en-PH')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {health.ok
                  ? 'All subsystems are healthy.'
                  : 'One or more subsystems are degraded. See the details below.'}
              </p>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Stellar</CardTitle>
                  {badgeFor(health.stellar.ok, !health.stellar.configured)}
                </div>
                <CardDescription>Hedera-style anchoring endpoint</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <Row label="Network" value={health.stellar.network} />
                <Row label="Horizon URL" value={health.stellar.horizonUrl} />
                <Row
                  label="Reachable"
                  value={health.stellar.reachable ? 'Yes' : 'No'}
                />
                <Row
                  label="Signing key configured"
                  value={health.stellar.configured ? 'Yes' : 'No'}
                />
                <Row label="Message" value={health.stellar.message} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Storage</CardTitle>
                  {badgeFor(health.storage.ok)}
                </div>
                <CardDescription>PDF / filing package backend</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <Row label="Type" value={health.storage.type} />
                <Row label="Path" value={health.storage.path} />
                <Row
                  label="Writable"
                  value={health.storage.writable ? 'Yes' : 'No'}
                />
                <Row label="Message" value={health.storage.message} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Database</CardTitle>
                  {badgeFor(health.database.ok)}
                </div>
                <CardDescription>PostgreSQL via Prisma</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <Row label="Status" value={health.database.ok ? 'Reachable' : 'Down'} />
                <Row label="Message" value={health.database.message} />
              </CardContent>
            </Card>
          </div>
        </>
      ) : (
        !loading && <p className="text-muted-foreground">No data.</p>
      )}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="font-mono text-sm break-all">{value}</span>
    </div>
  )
}
