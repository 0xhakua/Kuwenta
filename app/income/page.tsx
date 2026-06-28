'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

type ATCCode = {
  code: string
  description: string
  ewtRate: number
}

type Certificate = {
  id: string
  quarter: number
  payorTin: string
  payorName: string
  atcCode: string
  atc: ATCCode
  month1Amount: string
  month2Amount: string
  month3Amount: string
  quarterlyTotal: string
  cwtWithheld: string
  cwtValidated: boolean
  cwtDiscrepancy: string | null
}

const emptyForm = {
  quarter: 1,
  payorTin: '',
  payorName: '',
  atcCode: '',
  month1Amount: '',
  month2Amount: '',
  month3Amount: '',
  cwtWithheld: '',
}

export default function IncomePage() {
  const [certificates, setCertificates] = useState<Certificate[]>([])
  const [atcCodes, setAtcCodes] = useState<ATCCode[]>([])
  const [totals, setTotals] = useState({
    totalGross: '0.00',
    totalCwt: '0.00',
    vatThreshold: '3000000',
    vatThresholdPercent: 0,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Certificate | null>(null)
  const [form, setForm] = useState(emptyForm)

  async function loadData() {
    try {
      const [certsRes, atcRes, totalsRes] = await Promise.all([
        fetch('/api/income'),
        fetch('/api/atc'),
        fetch('/api/income/totals'),
      ])
      const certsData = await certsRes.json()
      const atcData = await atcRes.json()
      const totalsData = await totalsRes.json()
      setCertificates(certsData.certificates || [])
      setAtcCodes(atcData.codes || [])
      setTotals(totalsData)
    } catch {
      setError('Failed to load income data')
    }
  }

  useEffect(() => {
    let cancelled = false
    async function fetchData() {
      try {
        const [certsRes, atcRes, totalsRes] = await Promise.all([
          fetch('/api/income'),
          fetch('/api/atc'),
          fetch('/api/income/totals'),
        ])
        const certsData = await certsRes.json()
        const atcData = await atcRes.json()
        const totalsData = await totalsRes.json()
        if (!cancelled) {
          setCertificates(certsData.certificates || [])
          setAtcCodes(atcData.codes || [])
          setTotals(totalsData)
        }
      } catch {
        if (!cancelled) {
          setError('Failed to load income data')
        }
      }
    }
    fetchData()
    return () => {
      cancelled = true
    }
  }, [])

  function formatPeso(value: string | number) {
    return `₱${Number(value).toLocaleString('en-PH', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`
  }

  function updateForm(field: string, value: string | number) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function startEdit(cert: Certificate) {
    setEditing(cert)
    setForm({
      quarter: cert.quarter,
      payorTin: cert.payorTin,
      payorName: cert.payorName,
      atcCode: cert.atcCode,
      month1Amount: cert.month1Amount,
      month2Amount: cert.month2Amount,
      month3Amount: cert.month3Amount,
      cwtWithheld: cert.cwtWithheld,
    })
    setOpen(true)
  }

  function startAdd() {
    setEditing(null)
    setForm(emptyForm)
    setOpen(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const payload = {
      ...form,
      month1Amount: Number(form.month1Amount),
      month2Amount: Number(form.month2Amount),
      month3Amount: Number(form.month3Amount),
      cwtWithheld: Number(form.cwtWithheld),
    }

    try {
      const url = editing ? `/api/income/${editing.id}` : '/api/income'
      const method = editing ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Failed to save certificate')
        return
      }

      setOpen(false)
      await loadData()
    } catch {
      setError('Failed to save certificate')
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this certificate?')) return
    try {
      const res = await fetch(`/api/income/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Failed to delete certificate')
        return
      }
      await loadData()
    } catch {
      setError('Failed to delete certificate')
    }
  }

  const grouped = certificates.reduce(
    (acc, cert) => {
      if (!acc[cert.quarter]) acc[cert.quarter] = []
      acc[cert.quarter].push(cert)
      return acc
    },
    {} as Record<number, Certificate[]>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Income (BIR Form 2307)</h1>
        <Button onClick={startAdd}>Add Certificate</Button>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editing ? 'Edit Certificate' : 'Add Certificate'}</DialogTitle>
              <DialogDescription>
                Enter quarterly 2307 details. CWT is validated against the ATC rate.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="quarter">Quarter</Label>
                  <Select
                    value={String(form.quarter)}
                    onValueChange={(v) => updateForm('quarter', Number(v))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4].map((q) => (
                        <SelectItem key={q} value={String(q)}>Q{q}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="atcCode">ATC Code</Label>
                  <Select
                    value={form.atcCode}
                    onValueChange={(v) => v && updateForm('atcCode', v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select ATC" />
                    </SelectTrigger>
                    <SelectContent>
                      {atcCodes.map((atc) => (
                        <SelectItem key={atc.code} value={atc.code}>
                          {atc.code} — {atc.description}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="payorName">Payor Name</Label>
                <Input
                  id="payorName"
                  value={form.payorName}
                  onChange={(e) => updateForm('payorName', e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="payorTin">Payor TIN</Label>
                <Input
                  id="payorTin"
                  value={form.payorTin}
                  onChange={(e) => updateForm('payorTin', e.target.value)}
                  required
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                {['month1Amount', 'month2Amount', 'month3Amount'].map((field, i) => (
                  <div key={field} className="space-y-2">
                    <Label htmlFor={field}>Month {i + 1}</Label>
                    <Input
                      id={field}
                      type="number"
                      step="0.01"
                      value={field === 'month1Amount' ? form.month1Amount : field === 'month2Amount' ? form.month2Amount : form.month3Amount}
                      onChange={(e) => updateForm(field, e.target.value)}
                      required
                    />
                  </div>
                ))}
              </div>
              <div className="space-y-2">
                <Label htmlFor="cwtWithheld">CWT Withheld</Label>
                <Input
                  id="cwtWithheld"
                  type="number"
                  step="0.01"
                  value={form.cwtWithheld}
                  onChange={(e) => updateForm('cwtWithheld', e.target.value)}
                  required
                />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Saving...' : 'Save Certificate'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">YTD Gross Income</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatPeso(totals.totalGross)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">YTD CWT Withheld</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatPeso(totals.totalCwt)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">VAT Threshold</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{totals.vatThresholdPercent.toFixed(1)}%</p>
            <p className="text-xs text-muted-foreground">of ₱{Number(totals.vatThreshold).toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>

      {error && !open && <p className="text-sm text-red-600">{error}</p>}

      {[1, 2, 3, 4].map((quarter) => (
        <Card key={quarter}>
          <CardHeader>
            <CardTitle>Quarter {quarter}</CardTitle>
            <CardDescription>
              {grouped[quarter]?.length ?? 0} certificate(s)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {grouped[quarter]?.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Payor</TableHead>
                    <TableHead>ATC</TableHead>
                    <TableHead className="text-right">Gross</TableHead>
                    <TableHead className="text-right">CWT</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {grouped[quarter].map((cert) => (
                    <TableRow key={cert.id}>
                      <TableCell>
                        <div className="font-medium">{cert.payorName}</div>
                        <div className="text-sm text-muted-foreground">{cert.payorTin}</div>
                      </TableCell>
                      <TableCell>{cert.atcCode}</TableCell>
                      <TableCell className="text-right">{formatPeso(cert.quarterlyTotal)}</TableCell>
                      <TableCell className="text-right">{formatPeso(cert.cwtWithheld)}</TableCell>
                      <TableCell>
                        {cert.cwtValidated ? (
                          <Badge variant="default">Validated</Badge>
                        ) : (
                          <Badge variant="destructive">Mismatch</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button variant="outline" size="sm" onClick={() => startEdit(cert)}>
                          Edit
                        </Button>
                        <Button variant="destructive" size="sm" onClick={() => handleDelete(cert.id)}>
                          Delete
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-sm text-muted-foreground">No certificates for this quarter.</p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
