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
import { FileSpreadsheet, FileText, Loader2 } from 'lucide-react'
import { formatDate, formatCurrency, formatLabel, calcAttendancePercentage } from '@/lib/utils'

export default function LaporanPage() {
  const [exportType, setExportType] = useState<'presensi' | 'keuangan'>('presensi')
  
  // State Filter General
  const [filterUnit, setFilterUnit] = useState<string>('all')
  const [filterSemester, setFilterSemester] = useState<string>('all')
  
  // State Filter Presensi
  const [filterBulan, setFilterBulan] = useState<string>(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  const [filterJenis, setFilterJenis] = useState<string>('all')
  
  // State Filter Keuangan
  const [masterPeriode, setMasterPeriode] = useState<any[]>([])
  const [filterPeriode, setFilterPeriode] = useState<string>('all')
  const [masterJenisKegiatan, setMasterJenisKegiatan] = useState<any[]>([])

  const [loading, setLoading] = useState(false)
  const [previewData, setPreviewData] = useState<any[]>([])
  const [previewLoading, setPreviewLoading] = useState(false)
  const { toast } = useToast()
  const supabase = createClient()

  // Ambil Data Master untuk Dropdown
  useEffect(() => {
    const fetchMasters = async () => {
      const [resPeriode, resJenis] = await Promise.all([
        supabase.from('master_periode').select('*').order('nama_periode', { ascending: false }),
        supabase.from('jenis_kegiatan').select('*').order('nama_jenis')
      ])
      setMasterPeriode(resPeriode.data ?? [])
      setMasterJenisKegiatan(resJenis.data ?? [])
      
      // Auto-select periode aktif jika ada
      const activePeriode = resPeriode.data?.find(p => p.is_active)
      if (activePeriode) setFilterPeriode(activePeriode.id)
    }
    fetchMasters()
  }, [supabase])

  // Reset semester jika unit ganti ke LKIM
  useEffect(() => {
    if (filterUnit === 'lkim') setFilterSemester('all')
  }, [filterUnit])

  const getMonthRange = (bulan: string) => {
    const [year, month] = bulan.split('-').map(Number)
    const start = new Date(year, month - 1, 1).toISOString().split('T')[0]
    const end = new Date(year, month, 0).toISOString().split('T')[0]
    return { start, end }
  }

  // --- FETCH DATA PRESENSI ---
  const fetchPresensiData = useCallback(async () => {
    const { start, end } = getMonthRange(filterBulan)

    // Tarik semua data presensi di bulan tersebut beserta relasinya
    const { data: presensiData, error } = await supabase
      .from('presensi')
      .select(`
        *,
        profiles (nama, nim, unit, semester),
        sesi (
          tanggal,
          nama_kegiatan (nama_kegiatan, jenis_kegiatan (id, nama_jenis))
        )
      `)
      .gte('waktu_absen', `${start}T00:00:00`)
      .lte('waktu_absen', `${end}T23:59:59`)

    if (error) return []

    // Lakukan filter manual di Client-Side agar lebih aman dari error PostgREST
    const filtered = (presensiData ?? []).filter((p: any) => {
      const matchUnit = filterUnit === 'all' || p.profiles?.unit === filterUnit
      const matchSemester = filterSemester === 'all' || p.profiles?.semester?.toString() === filterSemester
      const matchJenis = filterJenis === 'all' || p.sesi?.nama_kegiatan?.jenis_kegiatan?.id === filterJenis
      return matchUnit && matchSemester && matchJenis
    })

    return filtered.sort((a, b) => new Date(b.waktu_absen).getTime() - new Date(a.waktu_absen).getTime())
  }, [filterBulan, filterUnit, filterSemester, filterJenis, supabase])

  // --- FETCH DATA KEUANGAN ---
  const fetchKeuanganData = useCallback(async () => {
    let query = supabase
      .from('tagihan_spp')
      .select(`
        *,
        profiles (nama, nim, unit, semester),
        master_tarif (nominal, periode_id, master_periode(nama_periode))
      `)

    // Filter by Periode Pembayaran
    if (filterPeriode !== 'all') {
      query = query.eq('master_tarif.periode_id', filterPeriode)
    }

    const { data: tagihanData, error } = await query
    if (error) return []

    // Filter Unit & Semester
    const filtered = (tagihanData ?? []).filter((t: any) => {
      // Pastikan data master_tarif tidak null (akibat inner join filter)
      if (filterPeriode !== 'all' && t.master_tarif === null) return false
      
      const matchUnit = filterUnit === 'all' || t.profiles?.unit === filterUnit
      const matchSemester = filterSemester === 'all' || t.profiles?.semester?.toString() === filterSemester
      return matchUnit && matchSemester
    })

    return filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  }, [filterPeriode, filterUnit, filterSemester, supabase])

  // Load Preview UI
  const loadPreview = useCallback(async () => {
    setPreviewLoading(true)
    try {
      if (exportType === 'presensi') {
        const data = await fetchPresensiData()
        setPreviewData(data.slice(0, 10))
      } else {
        const data = await fetchKeuanganData()
        setPreviewData(data.slice(0, 10))
      }
    } finally {
      setPreviewLoading(false)
    }
  }, [exportType, fetchPresensiData, fetchKeuanganData])

  useEffect(() => { loadPreview() }, [loadPreview])

  // Builder Rekap Presensi (Hitung persentase per anak)
  const buildAttendanceSummary = (data: any[]) => {
    const summary: Record<string, any> = {}
    data.forEach((p: any) => {
      const id = p.mahasiswa_id
      if (!summary[id]) {
        summary[id] = {
          nama: p.profiles?.nama ?? '-',
          nim: p.profiles?.nim ?? '-',
          unit: p.profiles?.unit ?? '-',
          semester: p.profiles?.semester ?? '-',
          hadir: 0, izin: 0, alpha: 0
        }
      }
      if (p.status === 'hadir') summary[id].hadir++
      else if (p.status === 'izin') summary[id].izin++
      else summary[id].alpha++
    })
    return Object.values(summary)
  }

  // --- EXPORT EXCEL ---
  const exportExcel = async () => {
    setLoading(true)
    try {
      const XLSX = await import('xlsx')
      const wb = XLSX.utils.book_new()

      if (exportType === 'presensi') {
        const data = await fetchPresensiData()
        
        // Sheet 1: Raw Data
        const rowsRaw = data.map((p: any) => ({
          Nama: p.profiles?.nama,
          NIM: p.profiles?.nim,
          Unit: formatLabel(p.profiles?.unit),
          Semester: p.profiles?.semester ?? '-',
          Kegiatan: p.sesi?.nama_kegiatan?.nama_kegiatan,
          Jenis: p.sesi?.nama_kegiatan?.jenis_kegiatan?.nama_jenis,
          Tanggal: p.sesi?.tanggal ? formatDate(p.sesi.tanggal) : '',
          Status: formatLabel(p.status),
        }))
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rowsRaw), 'Data Mentah')

        // Sheet 2: Rekap Persentase
        const summary = buildAttendanceSummary(data)
        const rowsRekap = summary.map(m => {
          const pct = calcAttendancePercentage(m.hadir, m.izin, m.alpha)
          return {
            Nama: m.nama,
            NIM: m.nim,
            Unit: formatLabel(m.unit),
            Semester: m.semester,
            Hadir: m.hadir,
            Izin: m.izin,
            Alpha: m.alpha,
            Total_Sesi: m.hadir + m.izin + m.alpha,
            'Persentase (%)': pct.toFixed(1)
          }
        })
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rowsRekap), 'Rekap Kehadiran')

      } else {
        const data = await fetchKeuanganData()
        const rows = data.map((s: any) => ({
          Nama: s.profiles?.nama,
          NIM: s.profiles?.nim,
          Unit: formatLabel(s.profiles?.unit),
          Semester: s.profiles?.semester ?? '-',
          Periode: s.master_tarif?.master_periode?.nama_periode ?? '-',
          Tagihan_Rp: s.master_tarif?.nominal ?? 0,
          Status: formatLabel(s.status),
        }))
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Tagihan SPP')
      }

      XLSX.writeFile(wb, `Laporan_${exportType}_${formatDate(new Date())}.xlsx`)
      toast({ title: 'Berhasil', description: 'File Excel berhasil diunduh', variant: 'success' })
    } catch (err) { 
      toast({ title: 'Error', description: 'Gagal mengunduh laporan', variant: 'destructive' }) 
    } finally { setLoading(false) }
  }

  // --- EXPORT PDF ---
  const exportPDF = async () => {
    setLoading(true)
    try {
      const jsPDF = (await import('jspdf')).default
      const autoTable = (await import('jspdf-autotable')).default
      const doc = new jsPDF()
      
      doc.setFontSize(16)
      doc.text(`Laporan ${exportType === 'presensi' ? 'Kehadiran Asrama' : 'Pembayaran SPP'}`, 14, 20)
      doc.setFontSize(10)
      doc.text(`Unit: ${filterUnit === 'all' ? 'Semua Unit' : formatLabel(filterUnit)}`, 14, 28)
      doc.text(`Dicetak: ${formatDate(new Date())}`, 14, 34)

      if (exportType === 'presensi') {
        const data = await fetchPresensiData()
        const summary = buildAttendanceSummary(data)
        
        const bodyRows = summary.map(m => [
          m.nama, 
          formatLabel(m.unit), 
          m.semester.toString(), 
          m.hadir.toString(), 
          m.izin.toString(), 
          m.alpha.toString(), 
          `${calcAttendancePercentage(m.hadir, m.izin, m.alpha).toFixed(1)}%`
        ])

        autoTable(doc, {
          startY: 40,
          head: [['Nama', 'Unit', 'Smt', 'Hadir', 'Izin', 'Alpha', 'Persentase']],
          body: bodyRows,
          headStyles: { fillColor: [34, 139, 34] },
        })
      } else {
        const data = await fetchKeuanganData()
        const bodyRows = data.map((s: any) => [
          s.profiles?.nama, 
          formatLabel(s.profiles?.unit), 
          s.profiles?.semester?.toString() ?? '-', 
          s.master_tarif?.master_periode?.nama_periode ?? '-',
          formatCurrency(s.master_tarif?.nominal ?? 0), 
          formatLabel(s.status)
        ])

        autoTable(doc, {
          startY: 40,
          head: [['Nama', 'Unit', 'Smt', 'Periode', 'Tagihan', 'Status']],
          body: bodyRows,
          headStyles: { fillColor: [34, 139, 34] },
        })
      }

      doc.save(`Laporan_${exportType}_${formatDate(new Date())}.pdf`)
      toast({ title: 'Berhasil', description: 'File PDF berhasil diunduh', variant: 'success' })
    } catch { 
      toast({ title: 'Error', description: 'Gagal mengunduh PDF', variant: 'destructive' }) 
    } finally { setLoading(false) }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Export Laporan" description="Unduh data asrama dalam format Excel atau PDF" />
      
      <Card>
        <CardHeader><CardTitle>Pengaturan Laporan</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            
            {/* Filter Jenis Laporan */}
            <div className="space-y-2">
              <Label>Jenis Laporan</Label>
              <Select value={exportType} onValueChange={v => setExportType(v as 'presensi' | 'keuangan')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="presensi">Presensi</SelectItem>
                  <SelectItem value="keuangan">Keuangan SPP</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Filter Waktu Dinamis (Bulan vs Periode) */}
            {exportType === 'presensi' ? (
              <div className="space-y-2">
                <Label>Bulan</Label>
                <Input type="month" value={filterBulan} onChange={e => setFilterBulan(e.target.value)} />
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Periode SPP</Label>
                <Select value={filterPeriode} onValueChange={setFilterPeriode}>
                  <SelectTrigger><SelectValue placeholder="Pilih Periode" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Periode</SelectItem>
                    {masterPeriode.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.nama_periode}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Filter Unit */}
            <div className="space-y-2">
              <Label>Unit Asrama</Label>
              <Select value={filterUnit} onValueChange={setFilterUnit}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Unit</SelectItem>
                  <SelectItem value="mahad_aly">Mahad Aly</SelectItem>
                  <SelectItem value="lkim">LKIM</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Filter Semester (Otomatis mati jika LKIM) */}
            <div className="space-y-2">
              <Label>Semester</Label>
              <Select value={filterSemester} onValueChange={setFilterSemester} disabled={filterUnit === 'lkim'}>
                <SelectTrigger><SelectValue placeholder="Semua Semester" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Semester</SelectItem>
                  <SelectItem value="1">Semester 1</SelectItem>
                  <SelectItem value="2">Semester 2</SelectItem>
                  <SelectItem value="3">Semester 3</SelectItem>
                  <SelectItem value="4">Semester 4</SelectItem>
                  <SelectItem value="5">Semester 5</SelectItem>
                  <SelectItem value="6">Semester 6</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Filter Jenis Kegiatan (Hanya muncul jika Presensi) */}
            {exportType === 'presensi' && (
              <div className="space-y-2">
                <Label>Kategori Kegiatan</Label>
                <Select value={filterJenis} onValueChange={setFilterJenis}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Kategori</SelectItem>
                    {masterJenisKegiatan.map(jk => (
                      <SelectItem key={jk.id} value={jk.id}>{jk.nama_jenis}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

          </div>

          <div className="flex flex-wrap gap-3 pt-2">
            <Button onClick={exportExcel} disabled={loading} className="gap-2">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />} Export Excel
            </Button>
            <Button onClick={exportPDF} disabled={loading} variant="outline" className="gap-2">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />} Export PDF
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* --- PREVIEW TABLE --- */}
      <Card>
        <CardHeader><CardTitle className="text-sm font-semibold">Preview Data (Max 10 baris)</CardTitle></CardHeader>
        <CardContent className="p-0">
          {previewLoading ? (
            <div className="space-y-2 p-4">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
          ) : previewData.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">Tidak ada data untuk filter yang dipilih.</p>
          ) : exportType === 'presensi' ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b bg-muted/50">{['Nama', 'Unit', 'Smt', 'Kegiatan', 'Status'].map(h => <th key={h} className="px-4 py-2 text-left font-medium text-muted-foreground whitespace-nowrap">{h}</th>)}</tr></thead>
                <tbody className="divide-y">
                  {previewData.map((p: any) => (
                    <tr key={p.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3 whitespace-nowrap">{p.profiles?.nama ?? '-'}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{formatLabel(p.profiles?.unit)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{p.profiles?.semester ?? '-'}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{p.sesi?.nama_kegiatan?.nama_kegiatan ?? '-'}</td>
                      <td className="px-4 py-3"><Badge variant={p.status === 'hadir' ? 'success' : p.status === 'izin' ? 'warning' : 'destructive'}>{formatLabel(p.status)}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b bg-muted/50">{['Nama', 'Unit', 'Smt', 'Periode', 'Tagihan', 'Status'].map(h => <th key={h} className="px-4 py-2 text-left font-medium text-muted-foreground whitespace-nowrap">{h}</th>)}</tr></thead>
                <tbody className="divide-y">
                  {previewData.map((s: any) => (
                    <tr key={s.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3 whitespace-nowrap">{s.profiles?.nama ?? '-'}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{formatLabel(s.profiles?.unit)}</td>
                      <td className="px-4 py-3">{s.profiles?.semester ?? '-'}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{s.master_tarif?.master_periode?.nama_periode ?? '-'}</td>
                      <td className="px-4 py-3">{formatCurrency(s.master_tarif?.nominal ?? 0)}</td>
                      <td className="px-4 py-3"><Badge variant={s.status === 'lunas' ? 'success' : s.status === 'menunggu_verifikasi' ? 'warning' : 'secondary'}>{formatLabel(s.status)}</Badge></td>
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
