'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

interface AuditLogEntry {
  id: string
  userId: string
  username: string
  action: string
  entityType: string | null
  entityId: string | null
  metadata: Record<string, unknown> | null
  createdAt: string
}

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function loadLogs() {
      setLoading(true)
      try {
        const res = await fetch('/api/admin/audit-log')
        const data = await res.json()
        if (cancelled) return
        if (!res.ok) {
          setError(data.error || 'Failed to load audit log')
          return
        }
        setLogs(data.logs ?? [])
      } catch {
        if (!cancelled) setError('Failed to load audit log')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadLogs()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Audit Log</h1>
          <p className="text-muted-foreground">System audit trail for elections, filings, and Stellar anchors.</p>
        </div>
        <Link href="/admin">
          <Button variant="outline">← Back to Admin</Button>
        </Link>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {loading && <p className="text-muted-foreground">Loading audit log…</p>}

      {!loading && logs.length === 0 ? (
        <p className="text-muted-foreground">No audit log entries yet.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Time</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Entity</TableHead>
              <TableHead>Metadata</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.map((log) => (
              <TableRow key={log.id}>
                <TableCell>
                  {new Date(log.createdAt).toLocaleString('en-PH')}
                </TableCell>
                <TableCell>{log.username}</TableCell>
                <TableCell>{log.action}</TableCell>
                <TableCell>
                  {log.entityType ? `${log.entityType} (${log.entityId ?? '—'})` : '—'}
                </TableCell>
                <TableCell className="max-w-md truncate font-mono text-xs">
                  {log.metadata ? JSON.stringify(log.metadata) : '—'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
