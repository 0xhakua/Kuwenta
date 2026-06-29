'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

interface ATCCode {
  code: string
  description: string
  ewtRate: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export default function AdminAtcPage() {
  const [codes, setCodes] = useState<ATCCode[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  // Form state
  const [code, setCode] = useState('')
  const [description, setDescription] = useState('')
  const [ewtRate, setEwtRate] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [editingCode, setEditingCode] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function loadCodes() {
      setLoading(true)
      setError('')
      try {
        const res = await fetch('/api/admin/atc')
        const data = await res.json()
        if (cancelled) return
        if (!res.ok) {
          setError(data.error || 'Failed to load ATC codes')
          return
        }
        setCodes(data.codes ?? [])
      } catch {
        if (!cancelled) setError('Failed to load ATC codes')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadCodes()
    return () => {
      cancelled = true
    }
  }, [message])

  function resetForm() {
    setCode('')
    setDescription('')
    setEwtRate('')
    setIsActive(true)
    setEditingCode(null)
  }

  function startEdit(atc: ATCCode) {
    setEditingCode(atc.code)
    setCode(atc.code)
    setDescription(atc.description)
    setEwtRate(atc.ewtRate)
    setIsActive(atc.isActive)
    setDialogOpen(true)
  }

  function startCreate() {
    resetForm()
    setDialogOpen(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setMessage('')

    const payload = editingCode
      ? { code: editingCode, description, ewtRate, isActive }
      : { code, description, ewtRate, isActive }

    const url = '/api/admin/atc'
    const method = editingCode ? 'PATCH' : 'POST'

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || `Failed to ${editingCode ? 'update' : 'create'} ATC code`)
        return
      }
      setMessage(editingCode ? 'ATC code updated.' : 'ATC code created.')
      resetForm()
      setDialogOpen(false)
    } catch {
      setError(`Failed to ${editingCode ? 'update' : 'create'} ATC code`)
    }
  }

  async function handleDelete(atcCode: string) {
    if (!confirm(`Delete ATC code ${atcCode}? This cannot be undone if it is not in use.`)) {
      return
    }
    setError('')
    setMessage('')
    try {
      const res = await fetch('/api/admin/atc', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: atcCode }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to delete ATC code')
        return
      }
      setMessage('ATC code deleted.')
    } catch {
      setError('Failed to delete ATC code')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">ATC Codes</h1>
          <p className="text-muted-foreground">
            Manage Alphanumeric Tax Codes and withholding rates.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin">
            <Button variant="outline">← Back to Admin</Button>
          </Link>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger>
              <Button onClick={startCreate}>Add ATC Code</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingCode ? 'Edit ATC Code' : 'Add ATC Code'}</DialogTitle>
                <DialogDescription>
                  {editingCode
                    ? 'Update the description, rate, or status.'
                    : 'Create a new ATC code for taxpayers to select.'}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="code">ATC Code</Label>
                  <Input
                    id="code"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="WI071"
                    disabled={!!editingCode}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Input
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Insurance Agents & Adjusters"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ewtRate">EWT Rate (decimal)</Label>
                  <Input
                    id="ewtRate"
                    value={ewtRate}
                    onChange={(e) => setEwtRate(e.target.value)}
                    placeholder="0.10"
                    pattern="^\\d+(\\.\\d{1,4})?$"
                    required
                  />
                  <p className="text-xs text-muted-foreground">Example: 0.10 for 10%, 0.15 for 15%</p>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="isActive"
                    checked={isActive}
                    onCheckedChange={(checked) => setIsActive(checked === true)}
                  />
                  <Label htmlFor="isActive">Active</Label>
                </div>
                {error && <p className="text-sm text-red-600">{error}</p>}
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      resetForm()
                      setDialogOpen(false)
                    }}
                  >
                    Cancel
                  </Button>
                  <Button type="submit">{editingCode ? 'Update' : 'Create'}</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {message && <p className="text-sm text-green-600">{message}</p>}
      {error && !dialogOpen && <p className="text-sm text-red-600">{error}</p>}
      {loading ? (
        <p className="text-muted-foreground">Loading ATC codes…</p>
      ) : codes.length === 0 ? (
        <p className="text-muted-foreground">No ATC codes found.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>EWT Rate</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {codes.map((atc) => (
              <TableRow key={atc.code}>
                <TableCell className="font-medium">{atc.code}</TableCell>
                <TableCell>{atc.description}</TableCell>
                <TableCell>{Number(atc.ewtRate).toFixed(4)}</TableCell>
                <TableCell>
                  {atc.isActive ? (
                    <Badge className="bg-green-100 text-green-800">Active</Badge>
                  ) : (
                    <Badge className="bg-gray-100 text-gray-800">Inactive</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => startEdit(atc)}>
                      Edit
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDelete(atc.code)}
                    >
                      Delete
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
