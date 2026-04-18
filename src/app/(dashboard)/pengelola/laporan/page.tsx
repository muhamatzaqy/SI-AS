'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PageHeader } from '@/components/shared/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { JENIS_KEGIATAN_OPTIONS, UNIT_OPTIONS } from '@/lib/constants'
import { FileSpreadsheet, FileText, Loader2 } from 'lucide-react'
import { formatDate, formatCurrency, formatLabel, calcAttendancePercentage, calcAverage } from '@/lib/utils'

export default function LaporanPage() {
  const [exportType, setExportType] = useState<'presensi' | 'keuangan'>('presensi')
  const [filterJenis, setFilterJenis] = useState<string>('all')
  const [filterBulan, setFilterBulan] = useState<string>(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  const [filterUnit, setFilterUnit] = useState<string>('all')
  const [loading, setLoading] = useState(false)
  const [previewData, setPreviewData] = useState<any[]>([])
  const [previewLoading, setPreviewLoading] = useState(false)
  const { toast } = useToast()
  const supabase = createClient()

  const getMonthRange = (bulan: string) => {
    const [year, month] = bulan.split('-').map(Number)
    const start = new Date(year, month - 1, 1).toISOString().split('T')[0]
    const end = new Date(year, month, 0).toISOString().split('T')[0]
    return { start, end }
  }

  const fetchPresensiData = useCallback(async () => {
    const { start, end } = getMonthRange(filterBulan)

    let jadwalQuery = supabase.from('jadwal_kegiatan').select('id, nama_kegiatan, jenis').gte('tanggal', start).lte('tanggal', end)
    if (filterJenis !== 'all') jadwalQuery = jadwalQuery.eq('jenis', filterJenis)
    const { data: jadwals } = await jadwalQuery
    const jadwalIds = (jadwals ?? []).map((j: any) => j.id)

    if (jadwalIds.length === 0) return { presensi: [], jadwals: jadwals ?? [] }

    let query = supabase.from('presensi').select('*, profiles(nama, nim, unit), jadwal_kegiatan(nama_kegiatan, tanggal, jenis)').in('jadwal_id', jadwalIds).order('created_at', { ascending: false })

    if (filterUnit !== 'all') {
      const { data: profiles } = await supabase.from('profiles').select('id').eq('unit', filterUnit)
      const profileIds = (profiles ?? []).map((p: any) => p.id)
      if (profileIds.length === 0) return { presensi: [], jadwals: jadwals ?? [] }
      query = query.in('mahasiswa_id', profileIds)
    }

    const { data } = await query
    return { presensi: data ?? [], jadwals: jadwals ?? [] }
  }, [filterBulan, filterJenis, filterUnit])

  const fetchKeuanganData = useCallback(async () => {
    const { start, end } = getMonthRange(filterBulan)
    const endDateTime = `${end}T23:59:59`
    let query = supabase.from('pembayaran_spp').select('*, profiles(nama, nim, unit)').gte('created_at', start).lte('created_at', endDateTime).order('created_at', { ascending: false })

    if (filterUnit !== 'all') {
      const { data: profiles } = await supabase.from('profiles').select('id').eq('unit', filterUnit)
      const profileIds = (profiles ?? []).map((p: any) => p.id)
      if (profileIds.length === 0) return []
      query = query.in('mahasiswa_id', profileIds)
    }

    const { data } = await query
    return data ?? []
  }, [filterBulan, filterUnit])

  const loadPreview = useCallback(async () => {
    setPreviewLoading(true)
    try {
      if (exportType === 'presensi') {
        const { presensi } = await fetchPresensiData()
        setPreviewData(presensi.slice(0, 10))
      } else {
        const data = await fetchKeuanganData()
        setPreviewData(data.slice(0, 10))
      }
    } finally {
      setPreviewLoading(false)
    }
  }, [exportType, fetchPresensiData, fetchKeuanganData])

  useEffect(() => { loadPreview() }, [loadPreview])

  /**
   * Build attendance summary per mahasiswa per kegiatan
   * Returns: { mahasiswaId: { nama, nim, unit, activities: { kegiatanNama: { hadir, izin, alpha } } } }
   */
  const buildAttendanceSummary = (data: any[]) => {
    const mahasiswaMap: Record<string, {
      nama: string; nim: string; unit: string;
      activities: Record<string, { hadir: number; izin: number; alpha: number }>
    }> = {}

    data.forEach((p: any) => {
      const id = p.mahasiswa_id
      const kegiatan = p.jadwal_kegiatan?.nama_kegiatan ?? '-'
      if (!mahasiswaMap[id]) {
        mahasiswaMap[id] = {
          nama: p.profiles?.nama ?? '-',
          nim: p.profiles?.nim ?? '-',
          unit: p.profiles?.unit ?? '-',
          activities: {}
        }
      }
      if (!mahasiswaMap[id].activities[kegiatan]) {
        mahasiswaMap[id].activities[kegiatan] = { hadir: 0, izin: 0, alpha: 0 }
      }
      if (p.status === 'hadir') mahasiswaMap[id].activities[kegiatan].hadir++
      else if (p.status === 'izin') mahasiswaMap[id].activities[kegiatan].izin++
      else mahasiswaMap[id].activities[kegiatan].alpha++
    })
    return mahasiswaMap
  }

  const exportExcel = async () => {
    setLoading(true)
    try {
      const XLSX = await import('xlsx')
      const wb = XLSX.utils.book_new()

      if (exportType === 'presensi') {
        const { presensi: data } = await fetchPresensiData()

        // Sheet 1: Raw data
        const rows = data.map((p: any) => ({
          Nama: p.profiles?.nama,
          NIM: p.profiles?.nim,
          Unit: formatLabel(p.profiles?.unit),
          Kegiatan: p.jadwal_kegiatan?.nama_kegiatan,
          Jenis: formatLabel(p.jadwal_kegiatan?.jenis),
          Tanggal: p.jadwal_kegiatan?.tanggal ? formatDate(p.jadwal_kegiatan.tanggal) : '',
          Status: formatLabel(p.status),
        }))
        const ws = XLSX.utils.json_to_sheet(rows)
        XLSX.utils.book_append_sheet(wb, ws, 'Presensi')

        // Sheet 2: Rekap per Kegiatan
        const summary = buildAttendanceSummary(data)
        const allActivities = Array.from(new Set(data.map((p: any) => p.jadwal_kegiatan?.nama_kegiatan).filter(Boolean))) as string[]

        const rekapRows: any[] = []
        Object.values(summary).forEach(m => {
          Object.entries(m.activities).forEach(([kegiatan, stats]) => {
            const total = stats.hadir + stats.izin + stats.alpha
            const pct = calcAttendancePercentage(stats.hadir, stats.izin, stats.alpha)
            rekapRows.push({
              Nama: m.nama,
              Unit: formatLabel(m.unit),
              Kegiatan: kegiatan,
              Hadir: stats.hadir,
              Izin: stats.izin,
              Alpha: stats.alpha,
              Total: total,
              'Persentase (%)': pct.toFixed(1),
            })
          })
        })
        const wsRekap = XLSX.utils.json_to_sheet(rekapRows)
        XLSX.utils.book_append_sheet(wb, wsRekap, 'Rekap per Kegiatan')

        // Sheet 3: Rata-rata per Mahasiswa
        if (allActivities.length > 0) {
          const avgRows: any[] = []
          Object.values(summary).forEach(m => {
            const row: any = { Nama: m.nama, Unit: formatLabel(m.unit) }
            const pcts: number[] = []
            allActivities.forEach(kegiatan => {
              const stats = m.activities[kegiatan]
              if (stats) {
                const pct = calcAttendancePercentage(stats.hadir, stats.izin, stats.alpha)
                row[kegiatan] = `${pct.toFixed(1)}%`
                pcts.push(pct)
              } else {
                row[kegiatan] = '-'
              }
            })
            const avg = calcAverage(pcts)
            row['Rata-rata'] = `${avg.toFixed(2)}%`
            avgRows.push(row)
          })
          const wsAvg = XLSX.utils.json_to_sheet(avgRows)
          XLSX.utils.book_append_sheet(wb, wsAvg, 'Rata-rata Kehadiran')
        }
      } else {
        const data = await fetchKeuanganData()
        const rows = data.map((s: any) => ({
          Nama: s.profiles?.nama,
          NIM: s.profiles?.nim,
          Unit: formatLabel(s.profiles?.unit),
          Semester: s.semester,
          Nominal: s.nominal,
          Status: formatLabel(s.status),
        }))
        const ws = XLSX.utils.json_to_sheet(rows)
        XLSX.utils.book_append_sheet(wb, ws, 'Keuangan')
      }

      XLSX.writeFile(wb, `laporan-${exportType}-${filterBulan}.xlsx`)
      toast({ title: 'Berhasil', description: 'File Excel diunduh', variant: 'success' })
    } catch { toast({ title: 'Error', description: 'Gagal export', variant: 'destructive' }) }
    finally { setLoading(false) }
  }

  const exportPDF = async () => {
    setLoading(true)
    try {
      const jsPDF = (await import('jspdf')).default
      const autoTable = (await import('jspdf-autotable')).default
      const doc = new jsPDF()
      const bulanLabel = new Date(filterBulan + '-01').toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
      doc.setFontSize(16)
      doc.text(exportType === 'presensi' ? 'Laporan Presensi' : 'Laporan Keuangan SPP', 14, 20)
      doc.setFontSize(10)
      doc.text(`Bulan: ${bulanLabel}`, 14, 28)
      if (filterJenis !== 'all' && exportType === 'presensi') doc.text(`Jenis Kegiatan: ${formatLabel(filterJenis)}`, 14, 34)
      if (filterUnit !== 'all') doc.text(`Unit: ${formatLabel(filterUnit)}`, 14, filterJenis !== 'all' && exportType === 'presensi' ? 40 : 34)
      doc.text(`Dicetak: ${formatDate(new Date())}`, 14, 46)

      if (exportType === 'presensi') {
        const { presensi: data } = await fetchPresensiData()

        // Page 1: Rekap per Kegiatan
        const summary = buildAttendanceSummary(data)
        const rekapRows: string[][] = []
        Object.values(summary).forEach(m => {
          Object.entries(m.activities).forEach(([kegiatan, stats]) => {
            const total = stats.hadir + stats.izin + stats.alpha
            const pct = calcAttendancePercentage(stats.hadir, stats.izin, stats.alpha)
            rekapRows.push([
              m.nama, formatLabel(m.unit), kegiatan,
              String(stats.hadir), String(stats.izin), String(stats.alpha),
              `${pct.toFixed(1)}%`
            ])
          })
        })

        autoTable(doc, {
          startY: 52,
          head: [['Nama', 'Unit', 'Kegiatan', 'Hadir', 'Izin', 'Alpha', 'Persentase']],
          body: rekapRows,
          styles: { fontSize: 8 },
          headStyles: { fillColor: [34, 139, 34] },
        })

        // Page 2: Rata-rata per Mahasiswa
        const allActivities = Array.from(new Set(data.map((p: any) => p.jadwal_kegiatan?.nama_kegiatan).filter(Boolean))) as string[]
        if (allActivities.length > 0) {
          doc.addPage()
          doc.setFontSize(13)
          doc.text('Rata-rata Persentase Kehadiran per Mahasiswa', 14, 20)
          const avgHead = ['Nama', ...allActivities, 'Rata-rata']
          const avgBody: string[][] = []
          Object.values(summary).forEach(m => {
            const row: string[] = [m.nama]
            const pcts: number[] = []
            allActivities.forEach(kegiatan => {
              const stats = m.activities[kegiatan]
              if (stats) {
                const pct = calcAttendancePercentage(stats.hadir, stats.izin, stats.alpha)
                row.push(`${pct.toFixed(1)}%`)
                pcts.push(pct)
              } else {
                row.push('-')
              }
            })
            const avg = calcAverage(pcts)
            row.push(`${avg.toFixed(2)}%`)
            avgBody.push(row)
          })
          autoTable(doc, {
            startY: 26,
            head: [avgHead],
            body: avgBody,
            styles: { fontSize: 7 },
            headStyles: { fillColor: [34, 139, 34] },
          })
        }
      } else {
        const data = await fetchKeuanganData()
        autoTable(doc, {
          startY: 52,
          head: [['Nama', 'NIM', 'Semester', 'Nominal', 'Status']],
          body: data.map((s: any) => [s.profiles?.nama, s.profiles?.nim, s.semester, formatCurrency(s.nominal), formatLabel(s.status)]),
          headStyles: { fillColor: [34, 139, 34] },
        })
      }

      doc.save(`laporan-${exportType}-${filterBulan}.pdf`)
      toast({ title: 'Berhasil', description: 'File PDF diunduh', variant: 'success' })
    } catch { toast({ title: 'Error', description: 'Gagal export', variant: 'destructive' }) }
    finally { setLoading(false) }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Export Laporan" description="Unduh laporan dalam format Excel atau PDF" />
      <Card>
        <CardHeader><CardTitle>Pengaturan Laporan</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2"><Label>Jenis Laporan</Label>
              <Select value={exportType} onValueChange={v => setExportType(v as 'presensi' | 'keuangan')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="presensi">Laporan Presensi</SelectItem><SelectItem value="keuangan">Laporan Keuangan SPP</SelectItem></SelectContent>
              </Select>
            </div>
            {exportType === 'presensi' && (
              <div className="space-y-2"><Label>Jenis Kegiatan</Label>
                <Select value={filterJenis} onValueChange={setFilterJenis}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Kegiatan</SelectItem>
                    {JENIS_KEGIATAN_OPTIONS.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2"><Label>Bulan</Label>
              <Input type="month" value={filterBulan} onChange={e => setFilterBulan(e.target.value)} />
            </div>
            <div className="space-y-2"><Label>Unit</Label>
              <Select value={filterUnit} onValueChange={setFilterUnit}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Unit</SelectItem>
                  {UNIT_OPTIONS.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button onClick={exportExcel} disabled={loading} className="gap-2">{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}Export Excel</Button>
            <Button onClick={exportPDF} disabled={loading} variant="outline" className="gap-2">{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}Export PDF</Button>
          </div>
        </CardContent>
      </Card>

      {/* Preview Table */}
      <Card>
        <CardHeader><CardTitle className="text-sm font-semibold">Preview Data (10 baris pertama)</CardTitle></CardHeader>
        <CardContent className="p-0">
          {previewLoading ? (
            <div className="space-y-2 p-4">{[...Array(3)].map((_, i) => <div key={i} className="h-8 w-full animate-pulse rounded bg-muted" />)}</div>
          ) : previewData.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">Tidak ada data untuk filter yang dipilih.</p>
          ) : exportType === 'presensi' ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b bg-muted/50">{['Nama', 'Unit', 'Kegiatan', 'Tanggal', 'Status'].map(h => <th key={h} className="px-4 py-2 text-left font-medium text-muted-foreground whitespace-nowrap">{h}</th>)}</tr></thead>
                <tbody className="divide-y">
                  {previewData.map((p: any) => (
                    <tr key={p.id} className="hover:bg-muted/30">
                      <td className="px-4 py-2 whitespace-nowrap">{p.profiles?.nama ?? '-'}</td>
                      <td className="px-4 py-2 whitespace-nowrap">{formatLabel(p.profiles?.unit)}</td>
                      <td className="px-4 py-2 whitespace-nowrap">{p.jadwal_kegiatan?.nama_kegiatan ?? '-'}</td>
                      <td className="px-4 py-2 whitespace-nowrap">{p.jadwal_kegiatan?.tanggal ? formatDate(p.jadwal_kegiatan.tanggal) : '-'}</td>
                      <td className="px-4 py-2"><Badge variant={p.status === 'hadir' ? 'success' : p.status === 'izin' ? 'warning' : 'destructive'}>{formatLabel(p.status)}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b bg-muted/50">{['Nama', 'Unit', 'Semester', 'Nominal', 'Status'].map(h => <th key={h} className="px-4 py-2 text-left font-medium text-muted-foreground whitespace-nowrap">{h}</th>)}</tr></thead>
                <tbody className="divide-y">
                  {previewData.map((s: any) => (
                    <tr key={s.id} className="hover:bg-muted/30">
                      <td className="px-4 py-2 whitespace-nowrap">{s.profiles?.nama ?? '-'}</td>
                      <td className="px-4 py-2 whitespace-nowrap">{formatLabel(s.profiles?.unit)}</td>
                      <td className="px-4 py-2">{s.semester}</td>
                      <td className="px-4 py-2">{formatCurrency(s.nominal)}</td>
                      <td className="px-4 py-2"><Badge variant={s.status === 'lunas' ? 'success' : s.status === 'menunggu_verifikasi' ? 'warning' : 'secondary'}>{formatLabel(s.status)}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
export const dynamic = 'force-dynamic'
