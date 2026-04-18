'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PageHeader } from '@/components/shared/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDate, formatLabel, calcAttendancePercentage, getAttendanceBgColor } from '@/lib/utils'

export default function RiwayatPage() {
  const [presensi, setPresensi] = useState<any[]>([])
  const [pelanggaran, setPelanggaran] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    const fetch = async () => {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const [{ data: p }, { data: pl }] = await Promise.all([
        supabase.from('presensi').select('*, jadwal_kegiatan(nama_kegiatan, tanggal)').eq('mahasiswa_id', user.id).order('created_at', { ascending: false }),
        supabase.from('pelanggaran').select('*').eq('mahasiswa_id', user.id).order('created_at', { ascending: false }),
      ])
      setPresensi(p ?? [])
      setPelanggaran(pl ?? [])
      setLoading(false)
    }
    fetch()
  }, []) // eslint-disable-line

  const totalPoin = pelanggaran.reduce((sum, p) => sum + p.poin, 0)
  const hadirCount = presensi.filter(p => p.status === 'hadir').length
  const izinCount = presensi.filter(p => p.status === 'izin').length
  const alphaCount = presensi.filter(p => p.status === 'alpha').length
  const overallPct = calcAttendancePercentage(hadirCount, izinCount, alphaCount)

  return (
    <div className="space-y-6">
      <PageHeader title="Riwayat Saya" description="Log kehadiran dan pelanggaran" />
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-5">
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-green-600">{hadirCount}</p><p className="text-xs text-muted-foreground">Hadir</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-yellow-600">{izinCount}</p><p className="text-xs text-muted-foreground">Izin</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-red-600">{alphaCount}</p><p className="text-xs text-muted-foreground">Alpha</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className={`text-2xl font-bold ${overallPct >= 75 ? 'text-green-600' : overallPct >= 65 ? 'text-yellow-600' : overallPct >= 50 ? 'text-orange-600' : 'text-red-600'}`}>{overallPct.toFixed(1)}%</p><p className="text-xs text-muted-foreground">Persentase</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-orange-600">{totalPoin}</p><p className="text-xs text-muted-foreground">Total Poin</p></CardContent></Card>
      </div>
      <Tabs defaultValue="presensi">
        <TabsList className="w-full sm:w-auto"><TabsTrigger value="presensi">Presensi</TabsTrigger><TabsTrigger value="pelanggaran">Pelanggaran</TabsTrigger></TabsList>
        <TabsContent value="presensi">
          <Card>
            <CardHeader><CardTitle>Riwayat Kehadiran</CardTitle></CardHeader>
            <CardContent className="p-0">
              {loading ? <div className="space-y-3 p-4">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
              : presensi.length === 0 ? <p className="p-6 text-center text-muted-foreground">Belum ada riwayat kehadiran.</p>
              : <div className="divide-y">{presensi.map((p: any) => (
                <div key={p.id} className="flex items-center justify-between p-4">
                  <div><p className="font-medium">{p.jadwal_kegiatan?.nama_kegiatan ?? '-'}</p><p className="text-sm text-muted-foreground">{p.jadwal_kegiatan?.tanggal ? formatDate(p.jadwal_kegiatan.tanggal) : '-'}</p></div>
                  <Badge variant={p.status === 'hadir' ? 'success' : p.status === 'izin' ? 'warning' : 'destructive'}>{formatLabel(p.status)}</Badge>
                </div>
              ))}</div>}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="pelanggaran">
          <Card>
            <CardHeader><CardTitle>Riwayat Pelanggaran — Total {totalPoin} Poin</CardTitle></CardHeader>
            <CardContent className="p-0">
              {loading ? <div className="space-y-3 p-4">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
              : pelanggaran.length === 0 ? <p className="p-6 text-center text-muted-foreground">Tidak ada pelanggaran. Bagus! 🎉</p>
              : <div className="divide-y">{pelanggaran.map((p: any) => (
                <div key={p.id} className="flex items-center justify-between p-4">
                  <div><p className="font-medium">{p.nama_pelanggaran}</p><p className="text-sm text-muted-foreground">{p.sanksi ?? '-'} · {formatDate(p.created_at)}</p></div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-destructive">{p.poin} poin</span>
                    <Badge variant={p.sudah_dijalankan ? 'success' : 'warning'}>{p.sudah_dijalankan ? 'Selesai' : 'Belum Dijalankan'}</Badge>
                  </div>
                </div>
              ))}</div>}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
export const dynamic = 'force-dynamic'
