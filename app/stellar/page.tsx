'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

interface StellarReceipt {
  id: string
  returnId: string
  taxYear: number
  formType: 'FORM_2551Q' | 'FORM_1701Q' | 'FORM_1701A'
  quarter: number | null
  sequenceOrder: number
  stellarTxId: string
  payloadHash: string
  network: string
  explorerUrl: string
  status: 'PENDING' | 'CONFIRMED' | 'FAILED'
  anchoredAt: string
}

export default function StellarPage() {
  const [receipts, setReceipts] = useState<StellarReceipt[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadReceipts() {
      try {
        const res = await fetch('/api/stellar/receipts')
        const data = await res.json()
        if (cancelled) return
        if (!res.ok) {
          setError(data.error || 'Failed to load receipts')
          return
        }
        setReceipts(data.receipts ?? [])
      } catch {
        if (!cancelled) setError('Failed to load receipts')
      }
    }

    loadReceipts()
    return () => {
      cancelled = true
    }
  }, [])

  function formatForm(receipt: StellarReceipt) {
    const form = receipt.formType.replace('FORM_', '')
    return receipt.quarter ? `${form} Q${receipt.quarter}` : form
  }

  function statusColor(status: string) {
    switch (status) {
      case 'CONFIRMED':
        return 'bg-green-100 text-green-800'
      case 'FAILED':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-amber-100 text-amber-800'
    }
  }

  async function copyTxId(txId: string, id: string) {
    try {
      await navigator.clipboard.writeText(txId)
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 1500)
    } catch {
      setError('Failed to copy TX ID')
    }
  }

  async function retryReceipt(id: string) {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/stellar/receipts/${id}/retry`, {
        method: 'POST',
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Retry failed')
        return
      }
      setReceipts((prev) =>
        prev.map((r) =>
          r.id === id ? { ...r, ...data.receipt, anchoredAt: data.receipt.anchoredAt } : r
        )
      )
    } catch {
      setError('Retry failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Stellar Compliance Receipts</h1>
        <p className="text-muted-foreground">
          All on-chain filing receipts for the current taxable year.
        </p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {receipts.length === 0 ? (
        <p className="text-muted-foreground">No Stellar receipts yet.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Return</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Network</TableHead>
              <TableHead>TX ID</TableHead>
              <TableHead>Anchored</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {receipts.map((receipt) => (
              <TableRow key={receipt.id}>
                <TableCell>{formatForm(receipt)}</TableCell>
                <TableCell>
                  <Badge className={statusColor(receipt.status)}>{receipt.status}</Badge>
                </TableCell>
                <TableCell className="capitalize">{receipt.network}</TableCell>
                <TableCell className="max-w-[200px] truncate font-mono text-xs">
                  {receipt.stellarTxId}
                </TableCell>
                <TableCell>
                  {new Date(receipt.anchoredAt).toLocaleString('en-PH')}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyTxId(receipt.stellarTxId, receipt.id)}
                    >
                      {copiedId === receipt.id ? 'Copied' : 'Copy'}
                    </Button>
                    {receipt.explorerUrl && (
                      <a
                        href={receipt.explorerUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <Button variant="outline" size="sm">Explorer</Button>
                      </a>
                    )}
                    {receipt.status === 'FAILED' && (
                      <Button
                        size="sm"
                        onClick={() => retryReceipt(receipt.id)}
                        disabled={loading}
                      >
                        Retry
                      </Button>
                    )}
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
