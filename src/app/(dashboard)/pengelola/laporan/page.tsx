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
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import { FileSpreadsheet, FileText, Loader2, BarChart3, Download, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react'
import { formatDate, formatCurrency, formatLabel, calcAttendancePercentage, getAttendanceBgColor } from '@/lib/utils'

export default function LaporanPage() {
  const [exportType, setExportType] = useState<'presensi' | 'keuangan'>('presensi')

  // State Filter General Export
  const [filterUnit, setFilterUnit] = useState<string>('all')
  const [filterSemester, setFilterSemester] = useState<string>('all')

  // State Filter Presensi (Rentang Tanggal Export)
  const [startDate, setStartDate] = useState<string>(() => {
    const today = new Date()
    return new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0]
  })
  const [endDate, setEndDate] = useState<string>(() => {
    const today = new Date()
    return new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0]
  })
  const [filterJenis, setFilterJenis] = useState<string>('all')

  // State Filter Keuangan Export
  const [masterPeriode, setMasterPeriode] = useState<any[]>([])
  const [filterPeriode, setFilterPeriode] = useState<string>('all')
  const [masterJenisKegiatan, setMasterJenisKegiatan] = useState<any[]>([])

  const [loading, setLoading] = useState(false)
  const [previewData, setPreviewData] = useState<any[]>([])
  const [previewLoading, setPreviewLoading] = useState(false)

  // --- STATE UNTUK GRAFIK/STATISTIK ---
  const [statsMonth, setStatsMonth] = useState<string>(() => {
    const today = new Date()
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
  })
  const [statsLoading, setStatsLoading] = useState(true)
  const [statsOverview, setStatsOverview] = useState({ hadir: 0, izin: 0, alpha: 0, total: 0 })
  const [statsByUnit, setStatsByUnit] = useState({
    mahad_aly: { hadir: 0, izin: 0, alpha: 0 },
    lkim: { hadir: 0, izin: 0, alpha: 0 }
  })
  const [statsByKegiatan, setStatsByKegiatan] = useState<any[]>([])

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

      const activePeriode = resPeriode.data?.find(p => p.is_active)
      if (activePeriode) setFilterPeriode(activePeriode.id)
    }
    fetchMasters()
  }, [supabase])

  // Reset semester jika unit ganti ke LKIM
  useEffect(() => {
    if (filterUnit === 'lkim') setFilterSemester('all')
  }, [filterUnit])

  // --- FETCH DATA STATISTIK UNTUK GRAFIK ---
  const fetchStatsData = useCallback(async () => {
    setStatsLoading(true)
    try {
      const [year, month] = statsMonth.split('-').map(Number)
      const start = new Date(year, month - 1, 1).toISOString().split('T')[0]
      const end = new Date(year, month, 0).toISOString().split('T')[0]

      const { data, error } = await supabase
        .from('presensi')
        .select(`
          status,
          profiles!inner(unit),
          sesi!inner(tanggal, nama_kegiatan!inner(nama_kegiatan))
        `)
        .gte('sesi.tanggal', start)
        .lte('sesi.tanggal', end)

      if (error) throw error

      if (data) {
        let h = 0, i = 0, a = 0;
        let m_h = 0, m_i = 0, m_a = 0;
        let l_h = 0, l_i = 0, l_a = 0;
        const keg: Record<string, any> = {}

        data.forEach(row => {
          // Total Overview
          if (row.status === 'hadir') h++;
          else if (row.status === 'izin') i++;
          else a++;

          // Breakdown by Unit
          if (row.profiles?.unit === 'mahad_aly') {
            if (row.status === 'hadir') m_h++;
            else if (row.status === 'izin') m_i++;
            else m_a++;
          } else if (row.profiles?.unit === 'lkim') {
            if (row.status === 'hadir') l_h++;
            else if (row.status === 'izin') l_i++;
            else l_a++;
          }

          // Breakdown by Kegiatan
          const kname = row.sesi?.nama_kegiatan?.nama_kegiatan;
          if (kname) {
            if (!keg[kname]) keg[kname] = { nama: kname, hadir: 0, izin: 0, alpha: 0 };
            if (row.status === 'hadir') keg[kname].hadir++;
            else if (row.status === 'izin') keg[kname].izin++;
            else keg[kname].alpha++;
          }
        })

        setStatsOverview({ hadir: h, izin: i, alpha: a, total: h + i + a })
        setStatsByUnit({
          mahad_aly: { hadir: m_h, izin: m_i, alpha: m_a },
          lkim: { hadir: l_h, izin: l_i, alpha: l_a }
        })
        
        // Convert to array & sort by attendance percentage
        const kegArray = Object.values(keg).sort((a, b) => {
          const pctA = calcAttendancePercentage(a.hadir, a.izin, a.alpha)
          const pctB = calcAttendancePercentage(b.hadir, b.izin, b.alpha)
          return pctB - pctA // Highest first
        })
        setStatsByKegiatan(kegArray)
      }
    } catch (err) {
      console.error("Gagal memuat statistik", err)
    } finally {
      setStatsLoading(false)
    }
  }, [statsMonth, supabase])

  useEffect(() => { fetchStatsData() }, [fetchStatsData])

  // --- FETCH DATA PRESENSI (EXPORT) ---
  const fetchPresensiData = useCallback(async () => {
    let allPresensi: any[] = []
    let from = 0
    const pageSize = 1000 
    let hasMore = true

    while (hasMore) {
      let query = supabase
        .from('presensi')
        .select(`
          *,
          profiles!inner (nama, nim, unit, semester),
          sesi!inner (
            tanggal,
            nama_kegiatan!inner (id, nama_kegiatan, jenis_id, jenis_kegiatan (id, nama_jenis))
          )
        `)
        .gte('sesi.tanggal', startDate)
        .lte('sesi.tanggal', endDate)
        .range(from, from + pageSize - 1)

      if (filterUnit !== 'all') query = query.eq('profiles.unit', filterUnit)
      if (filterSemester !== 'all') query = query.eq('profiles.semester', filterSemester)
      if (filterJenis !== 'all') query = query.eq('sesi.nama_kegiatan.jenis_id', filterJenis)

      const { data, error } = await query
      if (error) break

      if (data && data.length > 0) {
        allPresensi = [...allPresensi, ...data]
        from += pageSize
        if (data.length < pageSize) hasMore = false
      } else {
        hasMore = false
      }
    }

    return allPresensi.sort((a, b) => new Date(b.sesi.tanggal).getTime() - new Date(a.sesi.tanggal).getTime())
  }, [startDate, endDate, filterUnit, filterSemester, filterJenis, supabase])

  // --- FETCH DATA KEUANGAN (EXPORT) ---
  const fetchKeuanganData = useCallback(async () => {
    let allKeuangan: any[] = []
    let from = 0
    const pageSize = 1000
    let hasMore = true

    while (hasMore) {
      let query = supabase
        .from('tagihan_spp')
        .select(`
          *,
          profiles!inner (nama, nim, unit, semester),
          master_tarif!inner (nominal, periode_id, master_periode(nama_periode))
        `)
        .range(from, from + pageSize - 1)

      if (filterPeriode !== 'all') query = query.eq('master_tarif.periode_id', filterPeriode)
      if (filterUnit !== 'all') query = query.eq('profiles.unit', filterUnit)
      if (filterSemester !== 'all') query = query.eq('profiles.semester', filterSemester)

      const { data, error } = await query
      if (error) break

      if (data && data.length > 0) {
        allKeuangan = [...allKeuangan, ...data]
        from += pageSize
        if (data.length < pageSize) hasMore = false
      } else {
        hasMore = false
      }
    }

    return allKeuangan.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
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
        if (data.length === 0) {
          toast({ title: 'Perhatian', description: 'Tidak ada data presensi yang sesuai dengan filter.', variant: 'destructive' })
          setLoading(false)
          return
        }

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

        const summary = buildAttendanceSummary(data)
        const rowsRekap = summary.map(m => {
          const totalJadwal = m.hadir + m.izin + m.alpha
          const pct = calcAttendancePercentage(m.hadir, m.izin, m.alpha)
          return {
            Nama: m.nama, NIM: m.nim, Unit: formatLabel(m.unit), Semester: m.semester,
            Hadir: m.hadir, Izin: m.izin, Alpha: m.alpha,
            'Total Jadwal': totalJadwal, 'Persentase (%)': pct.toFixed(1)
          }
        })
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rowsRekap), 'Rekap Kehadiran')

      } else {
        const data = await fetchKeuanganData()
        if (data.length === 0) {
          toast({ title: 'Perhatian', description: 'Tidak ada data keuangan yang sesuai dengan filter.', variant: 'destructive' })
          setLoading(false)
          return
        }

        const rows = data.map((s: any) => ({
          Nama: s.profiles?.nama, NIM: s.profiles?.nim, Unit: formatLabel(s.profiles?.unit),
          Semester: s.profiles?.semester ?? '-', Periode: s.master_tarif?.master_periode?.nama_periode ?? '-',
          Tagihan_Rp: s.master_tarif?.nominal ?? 0, Status: formatLabel(s.status),
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
      if (exportType === 'presensi') {
        const data = await fetchPresensiData()
        if (data.length === 0) {
          toast({ title: 'Perhatian', description: 'Tidak ada data presensi yang sesuai dengan filter.', variant: 'destructive' })
          setLoading(false)
          return
        }

        const jsPDF = (await import('jspdf')).default
        const autoTable = (await import('jspdf-autotable')).default
        const doc = new jsPDF()
        
        doc.setFontSize(16)
        doc.text(`Laporan Kehadiran Asrama`, 14, 20)
        doc.setFontSize(10)
        doc.text(`Periode: ${formatDate(startDate)} s/d ${formatDate(endDate)}`, 14, 28)
        doc.text(`Unit: ${filterUnit === 'all' ? 'Semua Unit' : formatLabel(filterUnit)}`, 14, 34)

        const summary = buildAttendanceSummary(data)
        const bodyRows = summary.map(m => {
          const totalJadwal = m.hadir + m.izin + m.alpha
          return [
            m.nama, formatLabel(m.unit), m.semester.toString(), 
            m.hadir.toString(), m.izin.toString(), m.alpha.toString(),
            totalJadwal.toString(), `${calcAttendancePercentage(m.hadir, m.izin, m.alpha).toFixed(1)}%`
          ]
        })

        autoTable(doc, {
          startY: 40, head: [['Nama', 'Unit', 'Smt', 'Hadir', 'Izin', 'Alpha', 'Jml Jadwal', 'Persentase']],
          body: bodyRows, headStyles: { fillColor: [34, 139, 34] },
        })

        doc.save(`Laporan_presensi_${formatDate(new Date())}.pdf`)
      } else {
        const data = await fetchKeuanganData()
        if (data.length === 0) {
          toast({ title: 'Perhatian', description: 'Tidak ada data keuangan yang sesuai dengan filter.', variant: 'destructive' })
          setLoading(false)
          return
        }

        const jsPDF = (await import('jspdf')).default
        const autoTable = (await import('jspdf-autotable')).default
        const doc = new jsPDF()

        doc.setFontSize(16)
        doc.text(`Laporan Pembayaran SPP`, 14, 20)
        doc.setFontSize(10)
        doc.text(`Unit: ${filterUnit === 'all' ? 'Semua Unit' : formatLabel(filterUnit)}`, 14, 28)
        doc.text(`Dicetak: ${formatDate(new Date())}`, 14, 34)

        const bodyRows = data.map((s: any) => [
          s.profiles?.nama, formatLabel(s.profiles?.unit), s.profiles?.semester?.toString() ?? '-', 
          s.master_tarif?.master_periode?.nama_periode ?? '-',
          formatCurrency(s.master_tarif?.nominal ?? 0), formatLabel(s.status)
        ])

        autoTable(doc, {
          startY: 40, head: [['Nama', 'Unit', 'Smt', 'Periode', 'Tagihan', 'Status']],
          body: bodyRows, headStyles: { fillColor: [34, 139, 34] },
        })

        doc.save(`Laporan_keuangan_${formatDate(new Date())}.pdf`)
      }

      toast({ title: 'Berhasil', description: 'File PDF berhasil diunduh', variant: 'success' })
    } catch { 
      toast({ title: 'Error', description: 'Gagal mengunduh PDF', variant: 'destructive' }) 
    } finally { setLoading(false) }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Laporan & Statistik" description="Pantau grafik kehadiran dan unduh laporan data asrama." />

      <Tabs defaultValue="grafik" className="w-full space-y-6">
        <TabsList className="grid w-full grid-cols-2 lg:w-[400px]">
          <TabsTrigger value="grafik" className="gap-2"><BarChart3 className="h-4 w-4" /> Grafik Presensi</TabsTrigger>
          <TabsTrigger value="export" className="gap-2"><Download className="h-4 w-4" /> Export Laporan</TabsTrigger>
        </TabsList>

        {/* ================= TAB 1: GRAFIK & STATISTIK ================= */}
        <TabsContent value="grafik" className="space-y-6 animate-in fade-in-50 duration-500">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle>Ringkasan Kehadiran Bulanan</CardTitle>
              <Input 
                type="month" 
                value={statsMonth} 
                onChange={(e) => setStatsMonth(e.target.value)} 
                className="w-40"
              />
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-4"><Skeleton className="h-24 w-full" /><Skeleton className="h-24 w-full" /><Skeleton className="h-24 w-full" /></div>
                  <Skeleton className="h-64 w-full" />
                </div>
              ) : statsOverview.total === 0 ? (
                <div className="py-12 text-center text-muted-foreground flex flex-col items-center">
                  <BarChart3 className="h-12 w-12 opacity-20 mb-3" />
                  <p>Tidak ada data kegiatan di bulan ini.</p>
                </div>
              ) : (
                <div className="space-y-8 mt-2">
                  
                  {/* Summary Cards */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="rounded-xl border bg-green-50/50 p-4 border-green-100 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-green-800">Total Hadir</p>
                        <p className="text-3xl font-bold text-green-600">{statsOverview.hadir}</p>
                      </div>
                      <CheckCircle2 className="h-10 w-10 text-green-200" />
                    </div>
                    <div className="rounded-xl border bg-yellow-50/50 p-4 border-yellow-100 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-yellow-800">Total Izin</p>
                        <p className="text-3xl font-bold text-yellow-600">{statsOverview.izin}</p>
                      </div>
                      <AlertTriangle className="h-10 w-10 text-yellow-200" />
                    </div>
                    <div className="rounded-xl border bg-red-50/50 p-4 border-red-100 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-red-800">Total Alpha</p>
                        <p className="text-3xl font-bold text-red-600">{statsOverview.alpha}</p>
                      </div>
                      <XCircle className="h-10 w-10 text-red-200" />
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-6">
                    {/* Perbandingan Unit */}
                    <div className="space-y-4 rounded-xl border p-5 bg-card">
                      <h4 className="font-semibold mb-4 text-sm text-muted-foreground uppercase tracking-wider">Perbandingan per Unit</h4>
                      
                      {/* Bar Mahad Aly */}
                      {(() => {
                        const t = statsByUnit.mahad_aly.hadir + statsByUnit.mahad_aly.izin + statsByUnit.mahad_aly.alpha;
                        const pct = calcAttendancePercentage(statsByUnit.mahad_aly.hadir, statsByUnit.mahad_aly.izin, statsByUnit.mahad_aly.alpha);
                        return (
                          <div className="space-y-1.5">
                            <div className="flex justify-between text-sm">
                              <span className="font-medium">Mahad Aly</span>
                              <span className="font-bold">{pct.toFixed(1)}% <span className="text-muted-foreground font-normal text-xs ml-1">({t} Sesi)</span></span>
                            </div>
                            <div className="h-3 w-full bg-muted rounded-full overflow-hidden">
                              <div className={`h-full rounded-full transition-all duration-1000 ${getAttendanceBgColor(pct)}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                            </div>
                          </div>
                        )
                      })()}

                      {/* Bar LKIM */}
                      {(() => {
                        const t = statsByUnit.lkim.hadir + statsByUnit.lkim.izin + statsByUnit.lkim.alpha;
                        const pct = calcAttendancePercentage(statsByUnit.lkim.hadir, statsByUnit.lkim.izin, statsByUnit.lkim.alpha);
                        return (
                          <div className="space-y-1.5 mt-4">
                            <div className="flex justify-between text-sm">
                              <span className="font-medium">LKIM</span>
                              <span className="font-bold">{pct.toFixed(1)}% <span className="text-muted-foreground font-normal text-xs ml-1">({t} Sesi)</span></span>
                            </div>
                            <div className="h-3 w-full bg-muted rounded-full overflow-hidden">
                              <div className={`h-full rounded-full transition-all duration-1000 ${getAttendanceBgColor(pct)}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                            </div>
                          </div>
                        )
                      })()}
                    </div>

                    {/* Top Kegiatan */}
                    <div className="space-y-4 rounded-xl border p-5 bg-card max-h-[300px] overflow-y-auto">
                      <h4 className="font-semibold mb-4 text-sm text-muted-foreground uppercase tracking-wider">Kehadiran per Kegiatan</h4>
                      <div className="space-y-4">
                        {statsByKegiatan.map((keg, idx) => {
                          const pct = calcAttendancePercentage(keg.hadir, keg.izin, keg.alpha);
                          return (
                            <div key={idx} className="space-y-1">
                              <div className="flex justify-between text-xs">
                                <span className="font-medium truncate pr-4">{keg.nama}</span>
                                <span className="font-bold shrink-0">{pct.toFixed(1)}%</span>
                              </div>
                              <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                                <div className={`h-full rounded-full transition-all duration-500 ${getAttendanceBgColor(pct)}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>

                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ================= TAB 2: EXPORT LAPORAN ================= */}
        <TabsContent value="export" className="space-y-6 animate-in fade-in-50 duration-500">
          <Card>
            <CardHeader><CardTitle>Pengaturan Laporan</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">

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

                {exportType === 'presensi' ? (
                  <>
                    <div className="space-y-2">
                      <Label>Dari Tanggal</Label>
                      <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Sampai Tanggal</Label>
                      <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
                    </div>
                  </>
                ) : (
                  <div className="space-y-2 xl:col-span-2">
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

          <Card>
            <CardHeader><CardTitle className="text-sm font-semibold">Preview Data Export (Max 10 baris)</CardTitle></CardHeader>
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
        </TabsContent>
      </Tabs>
    </div>
  )
}

export const dynamic = 'force-dynamic'
