'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface PriorYearCredit {
  id: string
  amount: string
  originYear: number
  originForm: string
  priorDisposition: string
}

interface LineageNode {
  year: number
  credit: {
    id: string
    amount: string
    originYear: number
    originForm: string
    priorDisposition: string
  } | null
}

const DISPOSITION_OPTIONS = [
  { value: 'CARRY_OVER', label: 'Carry Over', eligible: true },
  { value: 'REFUND', label: 'Refund', eligible: false },
  { value: 'TAX_CREDIT_CERTIFICATE', label: 'Tax Credit Certificate', eligible: false },
] as const

export default function PriorYearCreditPage() {
  const [credit, setCredit] = useState<PriorYearCredit | null>(null)
  const [lineage, setLineage] = useState<LineageNode[]>([])
  const [amount, setAmount] = useState('')
  const [originYear, setOriginYear] = useState('')
  const [originForm, setOriginForm] = useState('1701A')
  const [priorDisposition, setPriorDisposition] = useState('CARRY_OVER')
  const [confirmed, setConfirmed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    let cancelled = false

    async function loadCredit() {
      try {
        const res = await fetch('/api/prior-year-credit')
        const data = await res.json()
        if (cancelled) return
        if (data.priorYearCredit) {
          setCredit(data.priorYearCredit)
          setPriorDisposition(data.priorYearCredit.priorDisposition)
        }
        if (Array.isArray(data.lineage)) {
          setLineage(data.lineage)
        }
      } catch {
        if (!cancelled) {
          setError('Failed to load prior-year credit')
        }
      }
    }

    loadCredit()
    return () => {
      cancelled = true
    }
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setMessage('')

    if (!confirmed) {
      setError('You must confirm the prior year ITR is available and reflects the elected disposition.')
      setLoading(false)
      return
    }

    if (priorDisposition !== 'CARRY_OVER') {
      setError('Only Carry Over credits are eligible. Refund and TCC cannot be applied as a prior-year credit (BR-09).')
      setLoading(false)
      return
    }

    try {
      const res = await fetch('/api/prior-year-credit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount,
          originYear: Number(originYear),
          originForm,
          priorDisposition,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to save credit')
        return
      }
      setCredit(data.priorYearCredit)
      setMessage('Prior-year credit saved and applied to 1701A.')
      setAmount('')
      setOriginYear('')
      setConfirmed(false)
      // Refresh lineage
      const lineageRes = await fetch('/api/prior-year-credit')
      const lineageData = await lineageRes.json()
      if (Array.isArray(lineageData.lineage)) {
        setLineage(lineageData.lineage)
      }
    } catch {
      setError('Failed to save credit')
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete() {
    if (!credit) return
    setLoading(true)
    setError('')
    setMessage('')
    try {
      const res = await fetch(`/api/prior-year-credit/${credit.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to remove credit')
        return
      }
      setCredit(null)
      setMessage('Prior-year credit removed.')
      const lineageRes = await fetch('/api/prior-year-credit')
      const lineageData = await lineageRes.json()
      if (Array.isArray(lineageData.lineage)) {
        setLineage(lineageData.lineage)
      }
    } catch {
      setError('Failed to remove credit')
    } finally {
      setLoading(false)
    }
  }

  function formatPeso(value: string | number) {
    return `₱${Number(value).toLocaleString('en-PH', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`
  }

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Prior Year Credit</h1>
      <p className="text-muted-foreground">
        Enter a carry-over credit from a previous tax year. This will be applied first in your 1701A Schedule 4.
      </p>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {message && <p className="text-sm text-green-600">{message}</p>}

      {credit ? (
        <Card>
          <CardHeader>
            <CardTitle>Active Carry-Over Credit</CardTitle>
            <CardDescription>One credit is allowed per tax year.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Amount</p>
                <p className="font-medium">{formatPeso(credit.amount)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Origin Year</p>
                <p className="font-medium">{credit.originYear}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Origin Form</p>
                <p className="font-medium">{credit.originForm}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Disposition</p>
                <p className="font-medium">{credit.priorDisposition}</p>
              </div>
            </div>
            <Button variant="destructive" onClick={handleDelete} disabled={loading}>
              Remove Credit
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Add Carry-Over Credit</CardTitle>
            <CardDescription>
              Only Carry Over credits are eligible (BR-09). Refund and TCC cannot be applied.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="amount">Amount</Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="originYear">Origin Year</Label>
                  <Input
                    id="originYear"
                    type="number"
                    value={originYear}
                    onChange={(e) => setOriginYear(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="originForm">Origin Form</Label>
                  <Input
                    id="originForm"
                    value={originForm}
                    onChange={(e) => setOriginForm(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="priorDisposition">Prior-Year Disposition</Label>
                  <Select
                    value={priorDisposition}
                    onValueChange={(v) => {
                      if (v != null) setPriorDisposition(v)
                    }}
                  >
                    <SelectTrigger id="priorDisposition">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DISPOSITION_OPTIONS.map((opt) => (
                        <SelectItem
                          key={opt.value}
                          value={opt.value}
                          disabled={!opt.eligible}
                        >
                          {opt.label}{!opt.eligible ? ' (not eligible)' : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Checkbox
                  id="confirmed"
                  checked={confirmed}
                  onCheckedChange={(v) => setConfirmed(v === true)}
                />
                <Label htmlFor="confirmed" className="text-sm font-normal leading-tight">
                  I confirm that my prior year ITR is available and reflects the elected disposition.
                </Label>
              </div>
              {priorDisposition !== 'CARRY_OVER' && (
                <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-3">
                  BR-09: Only Carry Over credits can be applied as a prior-year credit.
                  Refund and TCC credits are not eligible — the API will reject this submission.
                </p>
              )}
              <Button type="submit" disabled={loading || priorDisposition !== 'CARRY_OVER'}>
                {loading ? 'Saving…' : 'Save Carry-Over Credit'}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {lineage.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Carry-Over Lineage Chain</CardTitle>
            <CardDescription>
              Traces the credit back through prior tax years, stopping at the first year with no recorded credit.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="space-y-3">
              {lineage.map((node, idx) => {
                const isOrigin = idx === lineage.length - 1
                const hasCredit = node.credit != null
                return (
                  <li
                    key={`${node.year}-${idx}`}
                    className="flex flex-col gap-1 border-l-2 border-primary/30 pl-4"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">Tax Year {node.year}</span>
                      {idx === 0 && !isOrigin && (
                        <Badge variant="default">Current</Badge>
                      )}
                      {isOrigin && !hasCredit && (
                        <Badge variant="secondary">Origin (no prior credit)</Badge>
                      )}
                      {isOrigin && hasCredit && (
                        <Badge variant="secondary">Origin credit</Badge>
                      )}
                    </div>
                    {hasCredit ? (
                      <div className="text-sm text-muted-foreground">
                        Credit: {formatPeso(node.credit!.amount)} ·
                        Origin Form {node.credit!.originForm} ·
                        Disposition {node.credit!.priorDisposition}
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground">
                        No prior-year credit recorded for this year.
                      </div>
                    )}
                  </li>
                )
              })}
            </ol>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
