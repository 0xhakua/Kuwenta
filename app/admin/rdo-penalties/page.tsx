'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

interface RDOPenaltySchedule {
  id: string
  rdoCode: string
  compromiseFee: string
  updatedAt: string
}

export default function AdminRdoPenaltiesPage() {
  const [schedules, setSchedules] = useState<RDOPenaltySchedule[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const [rdoCode, setRdoCode] = useState('')
  const [compromiseFee, setCompromiseFee] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadSchedules() {
      setLoading(true)
      setError('')
      try {
        const res = await fetch('/api/admin/rdo-penalties')
        const data = await res.json()
        if (cancelled) return
        if (!res.ok) {
          setError(data.error || 'Failed to load RDO penalty schedules')
          return
        }
        setSchedules(data.schedules ?? [])
      } catch {
        if (!cancelled) setError('Failed to load RDO penalty schedules')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadSchedules()
    return () => {
      cancelled = true
    }
  }, [message])

  function resetForm() {
    setRdoCode('')
    setCompromiseFee('')
    setEditingId(null)
  }

  function startEdit(schedule: RDOPenaltySchedule) {
    setEditingId(schedule.id)
    setRdoCode(schedule.rdoCode)
    setCompromiseFee(schedule.compromiseFee)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setMessage('')

    const payload = editingId
      ? { id: editingId, compromiseFee }
      : { rdoCode, compromiseFee }

    const url = '/api/admin/rdo-penalties'
    const method = editingId ? 'PATCH' : 'POST'

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || `Failed to ${editingId ? 'update' : 'create'} schedule`)
        return
      }
      setMessage(editingId ? 'RDO schedule updated.' : 'RDO schedule created.')
      resetForm()
    } catch {
      setError(`Failed to ${editingId ? 'update' : 'create'} schedule`)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">RDO Penalty Schedule</h1>
          <p className="text-muted-foreground">
            Compromise penalty amount per RDO for late-filed returns.
          </p>
        </div>
        <Link href="/admin">
          <Button variant="outline">← Back to Admin</Button>
        </Link>
      </div>

      <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-3 items-end">
        <div className="space-y-2">
          <Label htmlFor="rdoCode">RDO Code</Label>
          <Input
            id="rdoCode"
            value={rdoCode}
            onChange={(e) => setRdoCode(e.target.value.toUpperCase())}
            placeholder="e.g. 039"
            disabled={!!editingId}
            required
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="compromiseFee">Compromise Fee (₱)</Label>
          <div className="flex gap-2">
            <Input
              id="compromiseFee"
              value={compromiseFee}
              onChange={(e) => setCompromiseFee(e.target.value)}
              placeholder="500.00"
              pattern="^\\d+(\\.\\d{1,2})?$"
              required
            />
            <Button type="submit">{editingId ? 'Update' : 'Add'}</Button>
            {editingId && (
              <Button type="button" variant="outline" onClick={resetForm}>
                Cancel
              </Button>
            )}
          </div>
        </div>
      </form>

      {message && <p className="text-sm text-green-600">{message}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {loading ? (
        <p className="text-muted-foreground">Loading schedules…</p>
      ) : schedules.length === 0 ? (
        <p className="text-muted-foreground">No RDO penalty schedules configured.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>RDO Code</TableHead>
              <TableHead>Compromise Fee</TableHead>
              <TableHead>Last Updated</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {schedules.map((schedule) => (
              <TableRow key={schedule.id}>
                <TableCell className="font-medium">{schedule.rdoCode}</TableCell>
                <TableCell>₱{Number(schedule.compromiseFee).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                <TableCell>
                  {new Date(schedule.updatedAt).toLocaleDateString('en-PH')}
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="outline" size="sm" onClick={() => startEdit(schedule)}>
                    Edit
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
