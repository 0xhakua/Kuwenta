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

interface PublicHoliday {
  id: string
  date: string
  name: string
  year: number
}

export default function AdminHolidaysPage() {
  const [holidays, setHolidays] = useState<PublicHoliday[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const [date, setDate] = useState('')
  const [name, setName] = useState('')

  useEffect(() => {
    let cancelled = false

    async function loadHolidays() {
      setLoading(true)
      setError('')
      try {
        const res = await fetch('/api/admin/holidays')
        const data = await res.json()
        if (cancelled) return
        if (!res.ok) {
          setError(data.error || 'Failed to load holidays')
          return
        }
        setHolidays(data.holidays ?? [])
      } catch {
        if (!cancelled) setError('Failed to load holidays')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadHolidays()
    return () => {
      cancelled = true
    }
  }, [message])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setMessage('')

    try {
      const res = await fetch('/api/admin/holidays', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, name }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to add holiday')
        return
      }
      setMessage('Holiday added.')
      setDate('')
      setName('')
    } catch {
      setError('Failed to add holiday')
    }
  }

  async function handleDelete(id: string, holidayName: string) {
    if (!confirm(`Remove holiday "${holidayName}"?`)) return

    setError('')
    setMessage('')
    try {
      const res = await fetch('/api/admin/holidays', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to delete holiday')
        return
      }
      setMessage('Holiday removed.')
    } catch {
      setError('Failed to delete holiday')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Holiday Calendar</h1>
          <p className="text-muted-foreground">
            Public holidays used to roll statutory filing deadlines.
          </p>
        </div>
        <Link href="/admin">
          <Button variant="outline">← Back to Admin</Button>
        </Link>
      </div>

      <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-3 items-end">
        <div className="space-y-2">
          <Label htmlFor="date">Date</Label>
          <Input
            id="date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="name">Holiday Name</Label>
          <div className="flex gap-2">
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Independence Day"
              required
            />
            <Button type="submit">Add Holiday</Button>
          </div>
        </div>
      </form>

      {message && <p className="text-sm text-green-600">{message}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {loading ? (
        <p className="text-muted-foreground">Loading holidays…</p>
      ) : holidays.length === 0 ? (
        <p className="text-muted-foreground">No holidays configured.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Year</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {holidays.map((holiday) => (
              <TableRow key={holiday.id}>
                <TableCell>
                  {new Date(holiday.date).toLocaleDateString('en-PH', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </TableCell>
                <TableCell>{holiday.name}</TableCell>
                <TableCell>{holiday.year}</TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDelete(holiday.id, holiday.name)}
                  >
                    Remove
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
