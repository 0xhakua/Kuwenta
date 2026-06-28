'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type ReturnDetail = {
  id: string
  formType: 'FORM_2551Q' | 'FORM_1701Q' | 'FORM_1701A'
  quarter: number | null
  sequenceOrder: number
  status: 'BLOCKED' | 'PENDING' | 'GENERATED' | 'FILED'
  statutoryDueDate: string
  computedTaxDue: string | null
  taxCreditsTotal: string | null
  netTaxDue: string | null
  overpaymentAmt: string | null
  filedDate: string | null
  generatedAt: string | null
  penalties: {
    daysLate: number
    surcharge: string
    interest: string
    compromisePenalty: string
    totalPenalty: string
  } | null
  stellarReceipt: {
    stellarTxId: string
    status: string
    explorerUrl: string
  } | null
}

export default function ReturnDetailPage() {
  const params = useParams()
  const id = params.id as string

  const [ret, setRet] = useState<ReturnDetail | null>(null)
  const [taxYear, setTaxYear] = useState<number | null>(null)
  const [disposition, setDisposition] = useState<string | null>(null)
  const [dispositionLoading, setDispositionLoading] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    let cancelled = false

    async function fetchReturn() {
      try {
        const res = await fetch(`/api/returns/${id}`)
        const data = await res.json()
        if (cancelled) return
        if (!res.ok) {
          setError(data.error || 'Failed to load return')
          return
        }
        setRet(data.return)
        setTaxYear(data.taxYear ?? null)

        if (
          data.return.formType === 'FORM_1701A' &&
          Number(data.return.overpaymentAmt) > 0
        ) {
          await loadDisposition(data.taxYear)
        }
      } catch {
        if (!cancelled) setError('Failed to load return')
      }
    }

    async function loadDisposition(year: number) {
      try {
        const res = await fetch(`/api/overpayment/${year}`)
        const data = await res.json()
        if (cancelled) return
        if (res.ok && data.overpayment?.disposition) {
          setDisposition(data.overpayment.disposition)
        }
      } catch {
        // Non-fatal: the user can still select a disposition
      }
    }

    fetchReturn()
    return () => {
      cancelled = true
    }
  }, [id])

  function formatPeso(value: string | null) {
    if (value == null) return '₱0.00'
    return `₱${Number(value).toLocaleString('en-PH', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`
  }

  function formatDate(value: string | null) {
    if (!value) return '—'
    return new Date(value).toLocaleDateString('en-PH')
  }

  function statusColor(status: string) {
    switch (status) {
      case 'FILED':
        return 'bg-green-100 text-green-800'
      case 'PENDING':
      case 'GENERATED':
        return 'bg-amber-100 text-amber-800'
      default:
        return 'bg-red-100 text-red-800'
    }
  }

  async function generateReturn() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/returns/${id}/generate`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to generate return')
        return
      }
      window.location.reload()
    } catch {
      setError('Failed to generate return')
    } finally {
      setLoading(false)
    }
  }

  async function fileReturn() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/returns/${id}/file`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to file return')
        return
      }
      window.location.reload()
    } catch {
      setError('Failed to file return')
    } finally {
      setLoading(false)
    }
  }

  async function saveDisposition() {
    if (!taxYear || !disposition) return
    setDispositionLoading(true)
    setError('')
    setMessage('')
    try {
      const res = await fetch(`/api/overpayment/${taxYear}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ disposition }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to save disposition')
        return
      }
      setMessage('Overpayment disposition saved.')
    } catch {
      setError('Failed to save disposition')
    } finally {
      setDispositionLoading(false)
    }
  }

  if (!ret) {
    return <p className="p-6">Loading return...</p>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/returns">
            <Button variant="outline" size="sm">← Back to Returns</Button>
          </Link>
          <h1 className="text-2xl font-bold mt-2">
            {ret.formType.replace('FORM_', '')} {ret.quarter ? `Q${ret.quarter}` : 'Annual'}
          </h1>
        </div>
        <Badge className={statusColor(ret.status)}>{ret.status}</Badge>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {message && <p className="text-sm text-green-600">{message}</p>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Computation Breakdown</CardTitle>
            <CardDescription>Step-by-step tax computation for this return</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Computed Tax Due</span>
              <span className="font-medium">{formatPeso(ret.computedTaxDue)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tax Credits Applied</span>
              <span className="font-medium">{formatPeso(ret.taxCreditsTotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Net Tax Due</span>
              <span className="font-medium">{formatPeso(ret.netTaxDue)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Overpayment</span>
              <span className="font-medium">{formatPeso(ret.overpaymentAmt)}</span>
            </div>
            <hr />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Statutory Due Date</span>
              <span className="font-medium">{formatDate(ret.statutoryDueDate)}</span>
            </div>
            {ret.filedDate && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Filed Date</span>
                <span className="font-medium">{formatDate(ret.filedDate)}</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Penalties</CardTitle>
            <CardDescription>Computed as of today</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Days Late</span>
              <span className="font-medium">{ret.penalties?.daysLate ?? 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Surcharge</span>
              <span className="font-medium">{formatPeso(ret.penalties?.surcharge ?? null)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Interest</span>
              <span className="font-medium">{formatPeso(ret.penalties?.interest ?? null)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Compromise</span>
              <span className="font-medium">{formatPeso(ret.penalties?.compromisePenalty ?? null)}</span>
            </div>
            <hr />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Penalty</span>
              <span className="font-medium">{formatPeso(ret.penalties?.totalPenalty ?? null)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {ret.formType === 'FORM_1701A' && Number(ret.overpaymentAmt) > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Overpayment Disposition</CardTitle>
            <CardDescription>
              Choose how to treat the {formatPeso(ret.overpaymentAmt)} overpayment.
              Required before filing.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Select
              value={disposition ?? ''}
              onValueChange={(value) => setDisposition(value)}
            >
              <SelectTrigger className="w-full md:w-[360px]">
                <SelectValue placeholder="Select disposition" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CARRY_OVER">Carry Over</SelectItem>
                <SelectItem value="REFUND">Refund</SelectItem>
                <SelectItem value="TAX_CREDIT_CERTIFICATE">Tax Credit Certificate</SelectItem>
              </SelectContent>
            </Select>
            <Button
              onClick={saveDisposition}
              disabled={dispositionLoading || !disposition}
            >
              {dispositionLoading ? 'Saving…' : 'Save Disposition'}
            </Button>
          </CardContent>
        </Card>
      )}

      {ret.stellarReceipt && (
        <Card>
          <CardHeader>
            <CardTitle>Stellar Receipt</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p>
              <strong>Status:</strong> {ret.stellarReceipt.status}
            </p>
            <p className="break-all">
              <strong>TX ID:</strong> {ret.stellarReceipt.stellarTxId}
            </p>
            {ret.stellarReceipt.explorerUrl && (
              <a href={ret.stellarReceipt.explorerUrl} target="_blank" rel="noreferrer">
                <Button variant="outline" size="sm">View on Stellar Explorer</Button>
              </a>
            )}
          </CardContent>
        </Card>
      )}

      <div className="flex gap-2">
        {ret.status === 'PENDING' && (
          <Button onClick={generateReturn} disabled={loading}>Generate Return</Button>
        )}
        {ret.status === 'GENERATED' && (
          <Button
            onClick={fileReturn}
            disabled={
              loading ||
              (ret.formType === 'FORM_1701A' &&
                Number(ret.overpaymentAmt) > 0 &&
                !disposition)
            }
          >
            Mark as Filed
          </Button>
        )}
        {(ret.status === 'GENERATED' || ret.status === 'FILED') && (
          <a href={`/api/returns/${id}/pdf`} target="_blank" rel="noreferrer">
            <Button variant="outline">Download PDF</Button>
          </a>
        )}
      </div>
    </div>
  )
}
