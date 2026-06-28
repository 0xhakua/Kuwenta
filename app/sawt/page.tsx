'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { FileDown, Package, ClipboardList } from 'lucide-react'

type SawtRow = {
  quarter: number
  payorTin: string
  payorName: string
  atcCode: string
  gross: string
  cwt: string
}

type ReturnMeta = {
  id: string
  formType: string
  quarter: number | null
  label: string
  status: string
  stellarTxId: string | null
}

type Attachment = {
  name: string
  status: string
}

type FilingPackage = {
  taxYear: number
  totalGross: string
  totalCwt: string
  filedCount: number
  totalCount: number
  returns: ReturnMeta[]
  attachments: Attachment[]
}

type Tab = 'sawt' | 'attachments' | 'package'

export default function SawtPage() {
  const [tab, setTab] = useState<Tab>('sawt')
  const [sawt, setSawt] = useState<SawtRow[]>([])
  const [pkg, setPkg] = useState<FilingPackage | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    async function fetchData() {
      try {
        const [sawtRes, pkgRes] = await Promise.all([
          fetch('/api/sawt'),
          fetch('/api/filing-package'),
        ])
        const sawtJson = await sawtRes.json()
        const pkgJson = await pkgRes.json()
        if (cancelled) return
        if (!sawtRes.ok) {
          setError(sawtJson.error || 'Failed to load SAWT')
          return
        }
        if (!pkgRes.ok) {
          setError(pkgJson.error || 'Failed to load filing package')
          return
        }
        setSawt(sawtJson.sawt || [])
        setPkg(pkgJson)
      } catch {
        if (!cancelled) setError('Failed to load SAWT data')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchData()
    return () => {
      cancelled = true
    }
  }, [])

  function statusColor(status: string) {
    if (status === 'Available' || status === 'FILED') return 'bg-green-100 text-green-800'
    if (status === 'NOT REQUIRED') return 'bg-blue-100 text-blue-800'
    return 'bg-amber-100 text-amber-800'
  }

  if (loading) return <p className="p-6">Loading…</p>
  if (error) return <p className="p-6 text-red-600">{error}</p>

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">SAWT & Filing Package</h1>
          <p className="text-muted-foreground">Tax Year {pkg?.taxYear}</p>
        </div>
        <div className="flex gap-2">
          <Link href="/api/sawt/export">
            <Button variant="outline" size="sm">
              <FileDown className="mr-2 h-4 w-4" /> Export SAWT CSV
            </Button>
          </Link>
          <Link href="/api/filing-package/download">
            <Button variant="outline" size="sm">
              <Package className="mr-2 h-4 w-4" /> Download ZIP
            </Button>
          </Link>
        </div>
      </div>

      <div className="flex gap-2 border-b pb-2">
        {[
          { key: 'sawt', label: 'SAWT Alphalist', icon: ClipboardList },
          { key: 'attachments', label: 'Attachments Checklist', icon: ClipboardList },
          { key: 'package', label: 'Filing Package', icon: Package },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as Tab)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-md ${
              tab === t.key ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground'
            }`}
          >
            <t.icon className="h-4 w-4" /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'sawt' && (
        <Card>
          <CardHeader>
            <CardTitle>SAWT Alphalist</CardTitle>
            <CardDescription>
              Aggregated by payor, ATC, and quarter for BIR eSubmission.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {sawt.length === 0 ? (
              <p className="text-muted-foreground">No 2307 certificates recorded yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Quarter</TableHead>
                    <TableHead>Payor TIN</TableHead>
                    <TableHead>Payor Name</TableHead>
                    <TableHead>ATC</TableHead>
                    <TableHead className="text-right">Gross Income</TableHead>
                    <TableHead className="text-right">CWT</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sawt.map((row, idx) => (
                    <TableRow key={idx}>
                      <TableCell>Q{row.quarter}</TableCell>
                      <TableCell>{row.payorTin}</TableCell>
                      <TableCell>{row.payorName}</TableCell>
                      <TableCell>{row.atcCode}</TableCell>
                      <TableCell className="text-right">₱{Number(row.gross).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</TableCell>
                      <TableCell className="text-right">₱{Number(row.cwt).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {tab === 'attachments' && pkg && (
        <Card>
          <CardHeader>
            <CardTitle>Attachments Checklist</CardTitle>
            <CardDescription>Status of required supporting documents.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {pkg.attachments.map((att, idx) => (
              <div key={idx} className="flex items-center justify-between">
                <span>{att.name}</span>
                <Badge className={statusColor(att.status)}>{att.status}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {tab === 'package' && pkg && (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>YTD Gross</CardDescription>
                <CardTitle className="text-2xl">₱{Number(pkg.totalGross).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>YTD CWT</CardDescription>
                <CardTitle className="text-2xl">₱{Number(pkg.totalCwt).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Returns Filed</CardDescription>
                <CardTitle className="text-2xl">{pkg.filedCount}/{pkg.totalCount}</CardTitle>
              </CardHeader>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Included Returns</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Return</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Stellar TX</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pkg.returns.map((ret) => (
                    <TableRow key={ret.id}>
                      <TableCell>{ret.label}</TableCell>
                      <TableCell>
                        <Badge className={statusColor(ret.status)}>{ret.status}</Badge>
                      </TableCell>
                      <TableCell className="break-all text-muted-foreground">
                        {ret.stellarTxId ?? '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
