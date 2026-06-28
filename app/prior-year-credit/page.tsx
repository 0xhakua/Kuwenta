'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'

interface PriorYearCredit {
  id: string
  amount: string
  originYear: number
  originForm: string
  priorDisposition: string
}

export default function PriorYearCreditPage() {
  const [credit, setCredit] = useState<PriorYearCredit | null>(null)
  const [amount, setAmount] = useState('')
  const [originYear, setOriginYear] = useState('')
  const [originForm, setOriginForm] = useState('1701A')
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
        if (!cancelled && data.priorYearCredit) {
          setCredit(data.priorYearCredit)
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
      setError('You must confirm the prior year ITR is available and reflects Carry Over.')
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
          priorDisposition: 'CARRY_OVER',
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
    } catch {
      setError('Failed to remove credit')
    } finally {
      setLoading(false)
    }
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
                <p className="font-medium">₱{Number(credit.amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</p>
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
              <div className="space-y-2">
                <Label htmlFor="originForm">Origin Form</Label>
                <Input
                  id="originForm"
                  value={originForm}
                  onChange={(e) => setOriginForm(e.target.value)}
                  required
                />
              </div>
              <div className="flex items-start gap-2">
                <Checkbox
                  id="confirmed"
                  checked={confirmed}
                  onCheckedChange={(v) => setConfirmed(v === true)}
                />
                <Label htmlFor="confirmed" className="text-sm font-normal leading-tight">
                  I confirm that my prior year ITR is available and reflects a Carry Over election.
                </Label>
              </div>
              <Button type="submit" disabled={loading}>
                {loading ? 'Saving…' : 'Save Carry-Over Credit'}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
