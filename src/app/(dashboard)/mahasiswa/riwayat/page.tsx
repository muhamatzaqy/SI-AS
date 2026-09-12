'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PageHeader } from '@/components/shared/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { formatDate, formatLabel, calcAttendancePercentage } from '@/lib/utils'
import { toast } from 'sonner'
import { CalendarCheck, Filter } from 'lucide-react'

export default function RiwayatPage() {
  const [presensi, setPresensi] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState<string>('semua')
  const supabase = createClient()

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Hanya mengambil data presensi/kehadiran beserta relasi sesi & nama kegiatan
      const { data, error } = await supabase
        .from('presensi')
        .select('*, sesi(tanggal, jam_mulai, nama_kegiatan(nama_kegiatan))')
        .eq('mahasiswa_id', user.id)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching presensi:', error)
        toast.error('Gagal memuat data riwayat presensi')
      }

      setPresensi(data ?? [])
      setLoading(false)
    }
    
    fetchData()
  }, [supabase])

  // Kalkulasi statistik kehadiran
  const hadirCount = presensi.filter(p => p.status === 'hadir').length
  const izinCount = presensi.filter(p => p.status === 'izin').length
  const alphaCount = presensi.filter(p => p.status === 'alpha').length
  const overallPct = calcAttendancePercentage(hadirCount, izinCount, alphaCount)

  // Filter presensi berdasarkan pilihan tombol filter
  const filteredPresensi = useMemo(() => {
    if (filterStatus === 'semua') return presensi
    return presensi.filter(p => p.status === filterStatus)
  }, [presensi, filterStatus])

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Riwayat Kehadiran" description="Log catatan kehadiran dan izin kegiatan asrama Anda" />
      
      {/* KARTU STATISTIK 4 KOLOM */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
        <Card className="border-slate-100 shadow-sm">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-green-600">{hadirCount}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Hadir</p>
          </CardContent>
        </Card>
        <Card className="border-slate-100 shadow-sm">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-yellow-600">{izinCount}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Izin</p>
          </CardContent>
        </Card>
        <Card className="border-slate-100 shadow-sm">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-red-600">{alphaCount}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Alpha</p>
          </CardContent>
        </Card>
        <Card className="border-slate-100 shadow-sm col-span-2 sm:col-span-1">
          <CardContent className="p-4 text-center">
            <p className={`text-2xl font-bold ${overallPct >= 75 ? 'text-green-600' : overallPct >= 65 ? 'text-yellow-600' : 'text-red-600'}`}>
              {overallPct.toFixed(1)}%
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">Persentase</p>
          </CardContent>
        </Card>
      </div>

      {/* KONTROL FILTER & DAFTAR RIWAYAT */}
      <Card className="border-slate-100 shadow-sm">
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarCheck className="h-4 w-4 text-primary" /> Daftar Catatan Kehadiran
          </CardTitle>

          {/* Tombol Filter Status */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs text-muted-foreground mr-1 flex items-center gap-1">
              <Filter className="h-3 w-3" /> Filter:
            </span>
            {['semua', 'hadir', 'izin', 'alpha'].map((status) => (
              <Button
                key={status}
                variant={filterStatus === status ? 'default' : 'outline'}
                size="sm"
                className="h-7 text-xs capitalize rounded-lg px-3"
                onClick={() => setFilterStatus(status)}
              >
                {status}
              </Button>
            ))}
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-3 p-5">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}</div>
          ) : filteredPresensi.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center px-4">
              <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                <CalendarCheck className="h-6 w-6 text-slate-400" />
              </div>
              <p className="text-sm font-medium text-slate-700">Tidak ada catatan ditemukan</p>
              <p className="text-xs text-slate-500 mt-1">Belum ada riwayat presensi dengan filter status ini.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredPresensi.map((p: any) => {
                const namaKegiatan = p.sesi?.nama_kegiatan?.nama_kegiatan ?? 'Kegiatan Tidak Diketahui'
                const tanggalKegiatan = p.sesi?.tanggal ? formatDate(p.sesi.tanggal) : '-'
                const jamMulai = p.sesi?.jam_mulai ? p.sesi.jam_mulai.slice(0, 5) : ''
                
                return (
                  <div key={p.id} className="flex items-center justify-between p-4 hover:bg-slate-50/50 transition-colors">
                    <div className="space-y-1">
                      <p className="font-semibold text-slate-900 text-sm">{namaKegiatan}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-2">
                        <span>📅 {tanggalKegiatan}</span>
                        {jamMulai && <span>🕒 {jamMulai} WIB</span>}
                      </p>
                    </div>
                    <Badge variant={p.status === 'hadir' ? 'success' : p.status === 'izin' ? 'warning' : 'destructive'}>
                      {formatLabel(p.status)}
                    </Badge>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export const dynamic = 'force-dynamic'
